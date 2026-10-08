import "server-only"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import { createNotification, notifyApprovers } from "@/lib/notifications"
import { addEmailJob, addEmailAsJob } from "@/lib/queue"
import { requireSession } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import {
  startOfDayUTC,
  toDateOnly,
  daysBetween,
  isWeekend,
  monthRange,
  workingDaysBetween,
} from "@/lib/dates"
import { renderDecisionEmail, renderWfhRequestEmail, signatureLogoUrl } from "@/lib/email-layout"
import { isOnProbation, getProbationEndDate } from "@/features/employees/probation"
import { getConfig, getConfigSync, warmConfig } from "@/server/app-config"

type Tier = 1 | 2 | 3

interface TierInput {
  onProbation?: boolean | null
  probationMonths?: number | null
  dateOfJoining?: Date | null
  confirmationDate?: Date | null
}

/** Early-confirmation date if set, else joining date + probationMonths. */
function probationCompletionDate(emp: TierInput): Date | null {
  if (emp.confirmationDate) return new Date(emp.confirmationDate)
  return getProbationEndDate(emp)
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d)
  out.setMonth(out.getMonth() + n)
  return out
}

function getEmployeeTier(emp: TierInput, now: Date = new Date()): Tier {
  if (isOnProbation(emp, now)) return 1
  const completed = probationCompletionDate(emp)
  // No joining date: treat as fully eligible rather than "On Probation".
  if (!completed) return 3
  return now < addMonths(completed, 6) ? 2 : 3
}

const WFH_INCLUDE = {
  employee: { select: EMPLOYEE_SUMMARY_SELECT },
  managerApprover: { select: { id: true, firstName: true, lastName: true } },
  hrApprover: { select: { id: true, firstName: true, lastName: true } },
} as const

// HR/admin roles that may decide any WFH request.
const HR_ROLE_NAMES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

/** Active = still occupying the calendar. Rejected/cancelled rows free their days. */
const ACTIVE_WFH_STATUSES = ["PENDING", "APPROVED"] as const

/** Max CALENDAR days per request, so a slipped date-picker click can't book a month. */
const MAX_WFH_RANGE_DAYS = 14

/** Ordinary (non-emergency) WFH days a fully-eligible employee gets per month. */
const TIER_3_MONTHLY_QUOTA = 1

/** Non-optional holidays as YYYY-MM-DD keys (WFH may be applied for on floating ones). */
async function loadHolidayKeys(start: Date, end: Date): Promise<Set<string>> {
  const holidays = await db.holiday.findMany({
    where: { isOptional: false, date: { gte: start, lte: end } },
    select: { date: true },
  })
  return new Set(holidays.map((h) => toDateOnly(h.date)))
}

/** "Wed Sep 23 2026", or "Wed Sep 23 2026 - Thu Sep 24 2026" for a real range. */
function formatWfhRange(date: Date | string, endDate: Date | string): string {
  const start = new Date(date).toDateString()
  const end = new Date(endDate).toDateString()
  return start === end ? start : `${start} - ${end}`
}

/** Ordinary WFH DAYS (not rows) held in the month; emergencies don't consume the quota. */
async function countOrdinaryWfhDaysInMonth(
  employeeId: string,
  monthStart: Date,
  monthEnd: Date,
  holidays: Set<string>,
): Promise<number> {
  const rows = await db.wfhRequest.findMany({
    where: {
      employeeId,
      status: { in: [...ACTIVE_WFH_STATUSES] },
      isEmergency: false,
      // Overlap, not containment: a range can span two months.
      date: { lte: monthEnd },
      endDate: { gte: monthStart },
    },
    select: { date: true, endDate: true },
  })

  let used = 0
  for (const row of rows) {
    const from = row.date > monthStart ? row.date : monthStart
    const to = row.endDate < monthEnd ? row.endDate : monthEnd
    used += workingDaysBetween(from, to, holidays).length
  }
  return used
}

export interface WfhMailEnvelope {
  to: { id: string; name: string; firstName: string; email: string } | null
  ccHr: string | null
}

/** Used by both the sender and the preview so they never disagree. To = active manager, else first HR/admin. */
export async function resolveWfhMailEnvelope(applicantId: string): Promise<WfhMailEnvelope> {
  const applicant = await db.employee.findUnique({
    where: { id: applicantId },
    select: {
      manager: {
        select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
      },
    },
  })
  const mgr = applicant?.manager?.isActive ? applicant.manager : null

  const queue = mgr
    ? []
    : await db.employee.findMany({
        where: {
          isActive: true,
          id: { not: applicantId },
          employeeRoles: { some: { role: { name: { in: HR_ROLE_NAMES } } } },
        },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { createdAt: "asc" },
      })

  const pick = mgr ?? queue[0] ?? null
  const to = pick
    ? {
        id: pick.id,
        name: `${pick.firstName} ${pick.lastName}`.trim(),
        firstName: pick.firstName,
        email: pick.email,
      }
    : null

  const hrInbox = (await getConfig("HR_EMAIL"))?.trim() || null
  const ccHr = hrInbox && (!to || hrInbox.toLowerCase() !== to.email.toLowerCase()) ? hrInbox : null

  return { to, ccHr }
}

/** `<key@host>` using the app's own host, so every id we mint looks local. */
function buildWfhMessageId(key: string): string {
  let host = "dnms.digitallynext.com"
  try {
    if (process.env.NEXTAUTH_URL) host = new URL(process.env.NEXTAUTH_URL).host
  } catch {
    // keep the fallback host
  }
  return `<${key}@${host}>`
}

export async function getWfhMailPreview(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const me = session.user.id
    const envelope = await resolveWfhMailEnvelope(me)

    const applicant = await db.employee.findUnique({
      where: { id: me },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobRole: { select: { name: true } },
        designation: { select: { title: true } },
      },
    })
    // Must run before the getConfigSync() reads below, or they only see process.env.
    await warmConfig()

    return ok({
      to: envelope.to ? { name: envelope.to.name, email: envelope.to.email } : null,
      ccHr: envelope.ccHr,
      signature: applicant
        ? {
            name: `${applicant.firstName} ${applicant.lastName}`.trim(),
            designation: applicant.jobRole?.name ?? applicant.designation?.title ?? null,
            email: applicant.email,
            phone: applicant.phone,
            website: getConfigSync("COMPANY_WEBSITE") ?? null,
            address: getConfigSync("COMPANY_ADDRESS") ?? null,
            logoUrl: signatureLogoUrl(),
            socials: [
              { label: "LinkedIn", url: getConfigSync("SOCIAL_LINKEDIN") ?? "" },
              { label: "Instagram", url: getConfigSync("SOCIAL_INSTAGRAM") ?? "" },
              { label: "YouTube", url: getConfigSync("SOCIAL_YOUTUBE") ?? "" },
            ].filter((s) => s.url),
          }
        : null,
    })
  })
}

/** Sent AS the employee via their Gmail App Password (falls back to the system mailer). Never throws. */
async function sendWfhRequestLetter(
  applicantId: string,
  request: {
    id: string
    date: Date
    endDate: Date
    totalDays: number
    reason: string | null
    isEmergency: boolean
  },
  applicantName: string,
  employeeNo: string | null,
  /** Null = auto-composed. */
  customBody: string | null,
  customSubject: string | null,
): Promise<void> {
  try {
    const envelope = await resolveWfhMailEnvelope(applicantId)
    if (!envelope.to) return

    const appUrl = (await getConfig("APP_URL")) ?? process.env.NEXTAUTH_URL ?? ""
    const applicant = await db.employee.findUnique({
      where: { id: applicantId },
      select: {
        email: true,
        phone: true,
        jobRole: { select: { name: true } },
        designation: { select: { title: true } },
        department: { select: { name: true } },
      },
    })

    const email = renderWfhRequestEmail({
      approverFirstName: envelope.to.firstName,
      applicantName,
      employeeNo,
      designation: applicant?.jobRole?.name ?? applicant?.designation?.title ?? null,
      department: applicant?.department?.name ?? null,
      applicantEmail: applicant?.email ?? null,
      applicantPhone: applicant?.phone ?? null,
      date: toDateOnly(request.date),
      endDate: toDateOnly(request.endDate),
      totalDays: request.totalDays,
      reason: request.reason,
      isEmergency: request.isEmergency,
      bodyText: customBody,
      subjectText: customSubject,
      // /wfh, not /wfh/requests (HR-only): managers approve from the /wfh tab.
      reviewUrl: appUrl ? `${appUrl.replace(/\/$/, "")}/wfh` : undefined,
    })

    const cc = [envelope.ccHr, applicant?.email].filter(
      (v): v is string => Boolean(v) && v !== envelope.to!.email,
    )

    addEmailAsJob(applicantId, {
      to: envelope.to.email,
      cc: cc.length ? cc : undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: applicant?.email ?? undefined,
      messageId: buildWfhMessageId(`wfh-${request.id}`),
      // Phantom thread root, so replies still thread when Gmail rewrites the Message-ID.
      references: buildWfhMessageId(`wfh-thread-${request.id}`),
      profile: "notifications",
    })
  } catch {
    // Non-blocking - email must never fail the request.
  }
}

export async function getWfhEligibility(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const employee = await db.employee.findUnique({
      where: { id: session.user.id },
      select: {
        onProbation: true,
        probationMonths: true,
        dateOfJoining: true,
        confirmationDate: true,
      },
    })

    const now = new Date()
    const emp: TierInput = employee ?? {}
    const completed = probationCompletionDate(emp)
    const tier = getEmployeeTier(emp, now)

    let eligibleFromDate: string | null = null
    let label = ""

    if (tier === 1) {
      label = "On Probation - WFH allowed only in emergencies (Manager + HR approval required)"
      if (completed) eligibleFromDate = toDateOnly(addMonths(completed, 6))
    } else if (tier === 2) {
      label =
        "Within 6 months of probation completion - WFH allowed only in emergencies (Manager + HR approval required)"
      if (completed) eligibleFromDate = toDateOnly(addMonths(completed, 6))
    } else {
      label = "Eligible for 1 WFH day per month"
    }

    let usedThisMonth = 0
    if (tier === 3) {
      // UTC bounds: rows are stored at UTC midnight; IST bounds would drop the last day.
      const { start: monthStart, end: monthEnd } = monthRange(
        now.getUTCFullYear(),
        now.getUTCMonth(),
      )
      usedThisMonth = await countOrdinaryWfhDaysInMonth(
        session.user.id,
        monthStart,
        monthEnd,
        await loadHolidayKeys(monthStart, monthEnd),
      )
    }

    return ok({
      tier,
      label,
      eligibleFromDate,
      monthlyQuota: tier === 3 ? TIER_3_MONTHLY_QUOTA : 0,
      usedThisMonth,
      maxRangeDays: MAX_WFH_RANGE_DAYS,
      canApplyEmergencyOnly: tier !== 3,
      joiningDate: employee?.dateOfJoining ? toDateOnly(employee.dateOfJoining) : null,
      probationEnd: completed ? toDateOnly(completed) : null,
    })
  })
}

type WfhFilters = {
  status?: string
  employeeId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export async function getWfhRequests(filters: WfhFilters = {}): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const canApprove = hasPermission(session, PERMISSIONS.WFH_APPROVE)

    const { page, limit, skip, take } = resolvePagination(filters, 20)

    const where: Record<string, unknown> = {}
    if (canApprove) {
      if (filters.status) where.status = filters.status
      if (filters.employeeId) where.employeeId = filters.employeeId
      // Overlap, not containment.
      if (filters.to) where.date = { lte: startOfDayUTC(filters.to) }
      if (filters.from) where.endDate = { gte: startOfDayUTC(filters.from) }
    } else {
      where.employeeId = session.user.id
      if (filters.status) where.status = filters.status
    }

    const [requests, total] = await Promise.all([
      db.wfhRequest.findMany({
        where,
        include: {
          employee: {
            select: EMPLOYEE_SUMMARY_SELECT,
          },
          managerApprover: { select: { id: true, firstName: true, lastName: true } },
          hrApprover: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.wfhRequest.count({ where }),
    ])

    return ok(
      serialize({
        data: requests,
        pagination: paginationMeta(total, page, limit),
      }),
    )
  })
}

export async function applyWfh(body: {
  date: string
  /** Omitted = single-day request. */
  endDate?: string
  reason?: string
  isEmergency?: boolean
  emailSubject?: string
  emailBody?: string
}): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const { date, endDate, reason, isEmergency, emailSubject, emailBody } = body
    if (!date) return fail("date is required")

    const wfhDate = startOfDayUTC(date)
    if (isNaN(wfhDate.getTime())) return fail("Invalid date format")

    const wfhEnd = endDate ? startOfDayUTC(endDate) : wfhDate
    if (isNaN(wfhEnd.getTime())) return fail("Invalid end date format")
    if (wfhEnd < wfhDate) return fail("The end date cannot be before the start date")

    const spanDays = daysBetween(wfhDate, wfhEnd) + 1
    if (spanDays > MAX_WFH_RANGE_DAYS)
      return fail(
        `A WFH request can cover at most ${MAX_WFH_RANGE_DAYS} days. Please split it into separate requests.`,
      )

    const today = startOfDayUTC(new Date())
    if (wfhDate < today) return fail("Cannot apply for WFH in the past")

    // Days inside a range may be weekends/holidays (skipped), but both ends must be working days.
    if (isWeekend(wfhDate) || isWeekend(wfhEnd)) return fail("WFH cannot be applied for weekends")

    const { start: spanFrom } = monthRange(wfhDate.getUTCFullYear(), wfhDate.getUTCMonth())
    const { end: spanTo } = monthRange(wfhEnd.getUTCFullYear(), wfhEnd.getUTCMonth())
    const holidayKeys = await loadHolidayKeys(spanFrom, spanTo)

    for (const bound of wfhEnd > wfhDate ? [wfhDate, wfhEnd] : [wfhDate]) {
      if (!holidayKeys.has(toDateOnly(bound))) continue
      const holiday = await db.holiday.findFirst({ where: { date: bound, isOptional: false } })
      return fail(`${bound.toDateString()} is a holiday (${holiday?.name ?? "company holiday"})`)
    }

    // Weekends and holidays inside the range don't count, so Fri-Mon is 2 days.
    const workingDays = workingDaysBetween(wfhDate, wfhEnd, holidayKeys)
    if (workingDays.length === 0)
      return fail("That range has no working days - every day in it is a weekend or a holiday.")

    // Same tier rule as getWfhEligibility, so the banner and this check always agree.
    const employee = await db.employee.findUnique({
      where: { id: session.user.id },
      select: {
        onProbation: true,
        probationMonths: true,
        dateOfJoining: true,
        confirmationDate: true,
      },
    })
    const tier = getEmployeeTier(employee ?? {})

    if ((tier === 1 || tier === 2) && !isEmergency) {
      const tierMsg =
        tier === 1
          ? "You are currently on probation. WFH is only available in emergencies and requires both Manager and HR approval."
          : "You are within 6 months of probation completion. WFH is only available in emergencies and requires both Manager and HR approval."
      return fail(tierMsg)
    }

    // The quota is per calendar month, so a range is checked against each month it touches.
    // Emergencies are exempt (they need Manager + HR sign-off instead).
    if (tier === 3 && !isEmergency) {
      const newDaysPerMonth = new Map<string, { year: number; month: number; count: number }>()
      for (const day of workingDays) {
        const year = day.getUTCFullYear()
        const month = day.getUTCMonth()
        const key = `${year}-${month}`
        const bucket = newDaysPerMonth.get(key) ?? { year, month, count: 0 }
        bucket.count += 1
        newDaysPerMonth.set(key, bucket)
      }

      for (const { year, month, count } of newDaysPerMonth.values()) {
        const { start: monthStart, end: monthEnd } = monthRange(year, month)
        const used = await countOrdinaryWfhDaysInMonth(
          session.user.id,
          monthStart,
          monthEnd,
          holidayKeys,
        )
        if (used + count <= TIER_3_MONTHLY_QUOTA) continue

        const monthLabel = monthStart.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
        return fail(
          used >= TIER_3_MONTHLY_QUOTA
            ? `You have already used or applied for your ${TIER_3_MONTHLY_QUOTA} WFH day in ${monthLabel}.`
            : `This request needs ${count} WFH days in ${monthLabel}, but you get ${TIER_3_MONTHLY_QUOTA} per month. Mark it as an emergency if it cannot wait - that needs both Manager and HR approval.`,
        )
      }
    }

    const overlappingLeave = await db.leaveRequest.findFirst({
      where: {
        employeeId: session.user.id,
        status: { in: ["PENDING", "APPROVED"] },
        AND: [{ startDate: { lte: wfhEnd } }, { endDate: { gte: wfhDate } }],
      },
    })
    if (overlappingLeave)
      return fail(
        spanDays > 1
          ? "WFH cannot be clubbed with a leave. One of these days already has a leave request."
          : "WFH cannot be clubbed with a leave on the same day.",
      )

    const duplicate = await db.wfhRequest.findFirst({
      where: {
        employeeId: session.user.id,
        status: { in: [...ACTIVE_WFH_STATUSES] },
        date: { lte: wfhEnd },
        endDate: { gte: wfhDate },
      },
      select: { date: true, endDate: true },
    })
    if (duplicate)
      return fail(
        `You already have a WFH request covering ${formatWfhRange(duplicate.date, duplicate.endDate)}.`,
      )

    // Concurrent submits can both pass the pre-check; the DB guard catches them. P2002 = older
    // partial UNIQUE, 23P01 = the btree_gist EXCLUDE (raw SQLSTATE, Prisma doesn't map it).
    let request
    try {
      request = await db.wfhRequest.create({
        data: {
          employeeId: session.user.id,
          date: wfhDate,
          endDate: wfhEnd,
          totalDays: workingDays.length,
          reason: reason ? String(reason).trim() : null,
          status: "PENDING",
          isEmergency: !!isEmergency,
        },
        include: {
          employee: {
            select: EMPLOYEE_SUMMARY_SELECT,
          },
        },
      })
    } catch (e) {
      const err = e as { code?: string; meta?: { code?: string } }
      if (err.code === "P2002" || err.code === "23P01" || err.meta?.code === "23P01") {
        return fail("You already have a WFH request covering one of these dates.")
      }
      throw e
    }

    const rangeLabel = formatWfhRange(wfhDate, wfhEnd)
    await notifyApprovers({
      requesterId: session.user.id,
      title: "WFH request",
      message: `${request.employee.firstName} ${request.employee.lastName} requested Work From Home ${
        workingDays.length > 1
          ? `for ${rangeLabel} (${workingDays.length} working days)`
          : `on ${rangeLabel}`
      }.`,
      link: "/wfh",
    })

    await sendWfhRequestLetter(
      session.user.id,
      request,
      `${request.employee.firstName} ${request.employee.lastName}`.trim(),
      request.employee.employeeNo ?? null,
      emailBody?.trim() || null,
      emailSubject?.trim() || null,
    )

    return ok(serialize({ data: request, tier }))
  })
}

export async function updateWfhRequest(
  id: string,
  action: "CANCEL" | "APPROVE" | "REJECT",
  rejectionReason?: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    if (!action || !["CANCEL", "APPROVE", "REJECT"].includes(action))
      return fail("Action must be one of: CANCEL, APPROVE, REJECT")

    const request = await db.wfhRequest.findUnique({
      where: { id },
      include: { employee: { select: { managerId: true, firstName: true, email: true } } },
    })
    if (!request) return fail("WFH request not found")
    if (request.status !== "PENDING")
      return fail(
        `Cannot ${action.toLowerCase()} a request that is already ${request.status.toLowerCase()}`,
      )

    if (action === "CANCEL") {
      if (request.employeeId !== session.user.id)
        return fail("You can only cancel your own WFH requests")
      // Re-assert PENDING so a cancel racing an approval can't overwrite the decision.
      const claimed = await db.wfhRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "CANCELLED" },
      })
      if (claimed.count === 0) return fail("This request has already been decided.")
      const updated = await db.wfhRequest.findUnique({ where: { id } })
      return ok(serialize({ data: updated }))
    }

    // HR or the employee's own manager may act; the FIRST decision is final.
    const roles = session.user.roles ?? []
    const isHr = roles.some((r) => HR_ROLE_NAMES.includes(r))
    const isManager = request.employee.managerId === session.user.id
    if (!isHr && !isManager) return fail("You can only act on your own team's WFH requests.")
    if (action === "REJECT" && !rejectionReason?.trim()) return fail("Rejection reason is required")
    const reason = rejectionReason?.trim()

    // Conditional claim, so two near-simultaneous deciders can't both settle it and double-notify.
    const decisionData = isHr
      ? action === "APPROVE"
        ? { status: "APPROVED" as const, hrApproverId: session.user.id, hrApprovedAt: new Date() }
        : { status: "REJECTED" as const, rejectionReason: reason, hrApproverId: session.user.id }
      : action === "APPROVE"
        ? {
            status: "APPROVED" as const,
            managerDecision: "APPROVED",
            managerApproverId: session.user.id,
            managerApprovedAt: new Date(),
          }
        : {
            status: "REJECTED" as const,
            managerDecision: "REJECTED",
            managerApproverId: session.user.id,
            rejectionReason: reason,
          }
    const claimed = await db.wfhRequest.updateMany({
      where: { id, status: "PENDING" },
      data: decisionData,
    })
    if (claimed.count === 0) return fail("This request has already been decided.", undefined, 409)
    const updated = await db.wfhRequest.findUnique({ where: { id }, include: WFH_INCLUDE })
    if (!updated) return fail("WFH request not found", undefined, 404)

    const dateStr = formatWfhRange(request.date, request.endDate)
    const daysSuffix = request.totalDays > 1 ? ` (${request.totalDays} working days)` : ""
    try {
      if (updated.status === "APPROVED" || updated.status === "REJECTED") {
        const approved = updated.status === "APPROVED"
        await createNotification({
          employeeId: request.employeeId,
          title: approved ? "WFH Approved" : "WFH Rejected",
          message: approved
            ? `Your Work From Home request for ${dateStr}${daysSuffix} has been approved.`
            : `Your Work From Home request for ${dateStr}${daysSuffix} was rejected.${reason ? ` Reason: ${reason}` : ""}`,
          type: approved ? "success" : "error",
          link: "/wfh",
        })
        if (request.employee.email) {
          const email = renderDecisionEmail({
            kind: "WFH request",
            approved,
            firstName: request.employee.firstName,
            detailLine: `Work From Home · ${dateStr}${daysSuffix}`,
            reason: !approved && reason ? reason : null,
          })
          addEmailJob({
            to: request.employee.email,
            subject: email.subject,
            html: email.html,
            text: email.text,
          })
        }
      }
    } catch {
      // Non-blocking
    }

    return ok(serialize({ data: updated }))
  })
}

/** scope "team" = my direct reports; "all" = everyone (HR / wfh:approve). */
export async function getWfhInbox(
  scope: "team" | "all",
  filters: { status?: string; page?: number; limit?: number } = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const roles = session.user.roles ?? []
    const { page, limit, skip, take } = resolvePagination(filters, 10)
    const where: Record<string, unknown> = {}
    if (filters.status) where.status = filters.status

    let isApprover: boolean
    if (scope === "all") {
      isApprover =
        roles.some((r) => HR_ROLE_NAMES.includes(r)) ||
        hasPermission(session, PERMISSIONS.WFH_APPROVE)
    } else {
      const reports = await db.employee.findMany({
        where: { managerId: session.user.id, isActive: true },
        select: { id: true },
      })
      isApprover = reports.length > 0
      where.employeeId = { in: reports.map((r) => r.id) }
    }

    if (!isApprover) {
      return ok(
        serialize({
          data: { requests: [], isApprover: false, pagination: paginationMeta(0, page, limit) },
        }),
      )
    }

    const [requests, total] = await Promise.all([
      db.wfhRequest.findMany({
        where,
        include: WFH_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.wfhRequest.count({ where }),
    ])

    return ok(
      serialize({
        data: { requests, isApprover: true, pagination: paginationMeta(total, page, limit) },
      }),
    )
  })
}
