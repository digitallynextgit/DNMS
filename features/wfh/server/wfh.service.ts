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
import { startOfDayUTC, toDateOnly } from "@/lib/dates"
import { renderDecisionEmail, renderWfhRequestEmail, signatureLogoUrl } from "@/lib/email-layout"
import { isOnProbation, getProbationEndDate } from "@/features/employees/probation"
import { getConfig, getConfigSync, warmConfig } from "@/server/app-config"

type Tier = 1 | 2 | 3

/**
 * Fields needed to place an employee in a WFH tier. Probation is decided by the SAME
 * rule the rest of the app uses (features/employees/probation.ts) - the `onProbation`
 * toggle plus dateOfJoining + probationMonths.
 *
 * This used to be derived from `probationEndDate ?? confirmationDate` alone, so an
 * employee with neither column set (which is nearly everyone - those fields are only
 * populated on early confirmation) fell into `!probationEnd` and was declared TIER 1
 * "On Probation". 9 of 16 active employees were being shown the probation banner and
 * blocked from ordinary WFH despite having `onProbation: false`.
 */
interface TierInput {
  onProbation?: boolean | null
  probationMonths?: number | null
  dateOfJoining?: Date | null
  confirmationDate?: Date | null
}

/** When probation ended (or is scheduled to end): the early-confirmation date if HR
 *  recorded one, else joiningDate + probationMonths. Null when there is no joining date. */
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
  // TIER 1 = genuinely on probation, per the shared rule.
  if (isOnProbation(emp, now)) return 1
  const completed = probationCompletionDate(emp)
  // No joining date at all -> we cannot place them in a window; treat as fully
  // eligible rather than falsely branding them "On Probation".
  if (!completed) return 3
  return now < addMonths(completed, 6) ? 2 : 3
}

const WFH_INCLUDE = {
  employee: { select: EMPLOYEE_SUMMARY_SELECT },
  managerApprover: { select: { id: true, firstName: true, lastName: true } },
  hrApprover: { select: { id: true, firstName: true, lastName: true } },
} as const

// HR/admin roles whose decision is FINAL on a WFH request. A manager's call is
// advisory (mirrors leave / floating-holiday requests).
const HR_ROLE_NAMES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

// ─── Application letter (to the manager, HR on Cc) ────────────────────────────

export interface WfhMailEnvelope {
  /** The manager the letter is addressed to (null when nobody is set up). */
  to: { id: string; name: string; firstName: string; email: string } | null
  /** The HR mailbox on Cc, or null. */
  ccHr: string | null
}

/**
 * Who a WFH request's letter actually goes to. ONE function, used by both the
 * sender and the apply-screen preview, so the preview can never promise a
 * different recipient than we send to (same contract as leave).
 *
 * Addressed to the applicant's REPORTING MANAGER whenever they have an active
 * one; otherwise the first HR/admin approver, since those are exactly the people
 * `updateWfhRequest` lets decide. Never the applicant themselves.
 */
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

  // Fallback queue: the HR/admin roles whose decision is final on WFH.
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

/**
 * The envelope + signature the apply screen previews. Read-only - nothing is
 * created. It calls resolveWfhMailEnvelope(), the SAME function the send path
 * uses, so a preview can't show a recipient we don't mail.
 */
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
    // Populate the config cache so the sync getConfigSync() reads below see the
    // DB-stored company/social values, not just process.env.
    await warmConfig()

    return ok({
      to: envelope.to ? { name: envelope.to.name, email: envelope.to.email } : null,
      ccHr: envelope.ccHr,
      signature: applicant
        ? {
            name: `${applicant.firstName} ${applicant.lastName}`.trim(),
            // Job role first; fall back to the L-grade designation.
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

/**
 * Send the application letter for a freshly-created request: TO the manager, Cc
 * HR and the applicant. Sent AS the employee from their own Gmail (via their
 * stored App Password) so it genuinely comes from them, falling back to the
 * system mailer when they have none on file.
 *
 * Always non-blocking - a mail failure must never fail the request.
 */
async function sendWfhRequestLetter(
  applicantId: string,
  request: { id: string; date: Date; reason: string | null; isEmergency: boolean },
  applicantName: string,
  employeeNo: string | null,
  /** The employee's edited letter/subject from the preview; null = auto-composed. */
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
      reason: request.reason,
      isEmergency: request.isEmergency,
      bodyText: customBody,
      subjectText: customSubject,
      // /wfh, not /wfh/requests: the letter goes to the MANAGER, and approvals
      // live on the "WFH Requests" tab of that page for managers and HR alike
      // (/wfh/requests is the HR-only view, gated on wfh:approve).
      reviewUrl: appUrl ? `${appUrl.replace(/\/$/, "")}/wfh` : undefined,
    })

    // Cc the applicant so the letter lands in their mailbox too.
    const cc = [envelope.ccHr, applicant?.email].filter(
      (v): v is string => Boolean(v) && v !== envelope.to!.email,
    )

    addEmailAsJob(applicantId, {
      to: envelope.to.email,
      cc: cc.length ? cc : undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      // It reads as the employee's letter, so Reply should reach the employee.
      replyTo: applicant?.email ?? undefined,
      messageId: buildWfhMessageId(`wfh-${request.id}`),
      // Shared phantom root, so a later reply threads onto this conversation even
      // when Gmail rewrites the Message-ID above.
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
      // Ordinary WFH unlocks 6 months AFTER probation completes.
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
      // UTC boundaries (API-09): rows are stored at UTC midnight; local-midnight
      // bounds on a TZ ahead of UTC (e.g. IST) push the last calendar day out of
      // the window, undercounting the monthly quota.
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const monthEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
      )
      usedThisMonth = await db.wfhRequest.count({
        where: {
          employeeId: session.user.id,
          status: { in: ["PENDING", "APPROVED"] },
          date: { gte: monthStart, lte: monthEnd },
        },
      })
    }

    return ok({
      tier,
      label,
      eligibleFromDate,
      monthlyQuota: tier === 3 ? 1 : 0,
      usedThisMonth,
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
      if (filters.from || filters.to) {
        where.date = {}
        if (filters.from) (where.date as Record<string, unknown>).gte = new Date(filters.from)
        if (filters.to) (where.date as Record<string, unknown>).lte = new Date(filters.to)
      }
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
  reason?: string
  isEmergency?: boolean
  /** Subject + letter exactly as composed/edited in the apply-screen preview. */
  emailSubject?: string
  emailBody?: string
}): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const { date, reason, isEmergency, emailSubject, emailBody } = body
    if (!date) return fail("date is required")

    const wfhDate = startOfDayUTC(date)
    if (isNaN(wfhDate.getTime())) return fail("Invalid date format")

    const today = startOfDayUTC(new Date())
    if (wfhDate < today) return fail("Cannot apply for WFH in the past")

    const dow = wfhDate.getUTCDay()
    if (dow === 0 || dow === 6) return fail("WFH cannot be applied for weekends")

    const holiday = await db.holiday.findFirst({ where: { date: wfhDate, isOptional: false } })
    if (holiday) return fail(`${wfhDate.toDateString()} is a holiday (${holiday.name})`)

    // Same tier rule as getWfhEligibility - the banner the employee is shown and the
    // rule enforced here MUST come from one place, or the UI says "you may apply" and
    // the server refuses (or vice-versa).
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

    if (tier === 3) {
      // UTC boundaries (API-09) - match the UTC-midnight stored dates.
      const monthStart = new Date(Date.UTC(wfhDate.getUTCFullYear(), wfhDate.getUTCMonth(), 1))
      const monthEnd = new Date(
        Date.UTC(wfhDate.getUTCFullYear(), wfhDate.getUTCMonth() + 1, 0, 23, 59, 59, 999),
      )
      const usedThisMonth = await db.wfhRequest.count({
        where: {
          employeeId: session.user.id,
          status: { in: ["PENDING", "APPROVED"] },
          date: { gte: monthStart, lte: monthEnd },
        },
      })
      if (usedThisMonth >= 1)
        return fail("You have already used or applied for your 1 WFH day this month.")
    }

    const overlappingLeave = await db.leaveRequest.findFirst({
      where: {
        employeeId: session.user.id,
        status: { in: ["PENDING", "APPROVED"] },
        AND: [{ startDate: { lte: wfhDate } }, { endDate: { gte: wfhDate } }],
      },
    })
    if (overlappingLeave) return fail("WFH cannot be clubbed with a leave on the same day.")

    const duplicate = await db.wfhRequest.findFirst({
      where: {
        employeeId: session.user.id,
        date: wfhDate,
        status: { in: ["PENDING", "APPROVED"] },
      },
    })
    if (duplicate) return fail("You already have a WFH request for this date.")

    // The `duplicate` check above is a friendly pre-check, not a guarantee: two
    // concurrent submissions both pass it. The partial unique index
    // `wfh_requests_employee_id_date_active_key` (PENDING/APPROVED only, so
    // re-applying after a rejection still works) is what actually enforces it,
    // and P2002 is that race surfacing - report it as the same user-facing
    // message rather than a 500.
    let request
    try {
      request = await db.wfhRequest.create({
        data: {
          employeeId: session.user.id,
          date: wfhDate,
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
      if ((e as { code?: string }).code === "P2002") {
        return fail("You already have a WFH request for this date.")
      }
      throw e
    }

    // Route to the employee's manager (advisory) + HR (final), like leave.
    await notifyApprovers({
      requesterId: session.user.id,
      title: "WFH request",
      message: `${request.employee.firstName} ${request.employee.lastName} requested Work From Home on ${wfhDate.toDateString()}.`,
      link: "/wfh",
    })

    // …and the letter itself, so an approver who isn't in the app still hears
    // about it. This is the mail the apply screen previews, sent verbatim.
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
      // Claim the row the same way APPROVE/REJECT do: the status check above is
      // a read from before this write, so a cancel racing an approval would
      // otherwise silently overwrite the decision. Re-asserting PENDING in the
      // WHERE makes the loser a no-op we can report.
      const claimed = await db.wfhRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "CANCELLED" },
      })
      if (claimed.count === 0) return fail("This request has already been decided.")
      const updated = await db.wfhRequest.findUnique({ where: { id } })
      return ok(serialize({ data: updated }))
    }

    // HR or the employee's own manager may act, and the FIRST decision is final.
    // A manager's call used to be advisory - the request stayed PENDING until HR
    // repeated it, which meant every WFH day needed two people. Either can now
    // settle it; the record still stores which of them did.
    const roles = session.user.roles ?? []
    const isHr = roles.some((r) => HR_ROLE_NAMES.includes(r))
    const isManager = request.employee.managerId === session.user.id
    if (!isHr && !isManager) return fail("You can only act on your own team's WFH requests.")
    if (action === "REJECT" && !rejectionReason?.trim()) return fail("Rejection reason is required")
    const reason = rejectionReason?.trim()

    // Build the transition, then claim it atomically so two near-simultaneous
    // deciders (manager + HR under "first decision wins") can't both settle it
    // and fire duplicate notifications/emails (API-01). updateMany with the
    // status guard is a single conditional UPDATE; the loser matches 0 rows.
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

    const dateStr = new Date(request.date).toDateString()
    try {
      if (updated.status === "APPROVED" || updated.status === "REJECTED") {
        const approved = updated.status === "APPROVED"
        await createNotification({
          employeeId: request.employeeId,
          title: approved ? "WFH Approved" : "WFH Rejected",
          message: approved
            ? `Your Work From Home request for ${dateStr} has been approved.`
            : `Your Work From Home request for ${dateStr} was rejected.${reason ? ` Reason: ${reason}` : ""}`,
          type: approved ? "success" : "error",
          link: "/wfh",
        })
        if (request.employee.email) {
          const email = renderDecisionEmail({
            kind: "WFH request",
            approved,
            firstName: request.employee.firstName,
            detailLine: `Work From Home · ${dateStr}`,
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
      // No "awaiting HR" branch any more: a decision by either party is final,
      // so the request always leaves PENDING here.
    } catch {
      // Non-blocking
    }

    return ok(serialize({ data: updated }))
  })
}

/**
 * WFH requests inbox.
 *   scope "team" - the current user's direct reports' requests (the manager tab
 *     on the My WFH page; advisory). isApprover = the user manages someone.
 *   scope "all"  - every employee's requests for HR / admin / wfh:approve (the
 *     HR Work From Home section; final decision).
 * Returns `isApprover` so the caller can show the surface only when applicable.
 */
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
