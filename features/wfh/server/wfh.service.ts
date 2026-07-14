import "server-only"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import { createNotification, notifyApprovers } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { requireSession } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import { startOfDayUTC, toDateOnly } from "@/lib/dates"
import { renderDecisionEmail } from "@/lib/email-layout"
import { isOnProbation, getProbationEndDate } from "@/features/employees/probation"

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
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
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
}): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const { date, reason, isEmergency } = body
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
      const monthStart = new Date(wfhDate.getUTCFullYear(), wfhDate.getUTCMonth(), 1)
      const monthEnd = new Date(wfhDate.getUTCFullYear(), wfhDate.getUTCMonth() + 1, 0)
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

    const request = await db.wfhRequest.create({
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

    // Route to the employee's manager (advisory) + HR (final), like leave.
    await notifyApprovers({
      requesterId: session.user.id,
      title: "WFH request",
      message: `${request.employee.firstName} ${request.employee.lastName} requested Work From Home on ${wfhDate.toDateString()}.`,
      link: "/wfh",
    })

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
      const updated = await db.wfhRequest.update({ where: { id }, data: { status: "CANCELLED" } })
      return ok(serialize({ data: updated }))
    }

    // HR (final) or the employee's own manager (advisory) may act. A manager's
    // decision is recorded but keeps the request PENDING; HR makes the final call
    // and can approve even over a manager's rejection.
    const roles = session.user.roles ?? []
    const isHr = roles.some((r) => HR_ROLE_NAMES.includes(r))
    const isManager = request.employee.managerId === session.user.id
    if (!isHr && !isManager) return fail("You can only act on your own team's WFH requests.")
    if (action === "REJECT" && !rejectionReason?.trim()) return fail("Rejection reason is required")
    const reason = rejectionReason?.trim()

    const updated = isHr
      ? await db.wfhRequest.update({
          where: { id },
          data:
            action === "APPROVE"
              ? { status: "APPROVED", hrApproverId: session.user.id, hrApprovedAt: new Date() }
              : { status: "REJECTED", rejectionReason: reason, hrApproverId: session.user.id },
          include: WFH_INCLUDE,
        })
      : await db.wfhRequest.update({
          where: { id },
          // Manager review is advisory - stays PENDING for HR's final call.
          data:
            action === "APPROVE"
              ? {
                  managerDecision: "APPROVED",
                  managerApproverId: session.user.id,
                  managerApprovedAt: new Date(),
                }
              : {
                  managerDecision: "REJECTED",
                  managerApproverId: session.user.id,
                  rejectionReason: reason,
                },
          include: WFH_INCLUDE,
        })

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
      } else {
        // Manager decided; HR still has the final call.
        const approved = updated.managerDecision === "APPROVED"
        await createNotification({
          employeeId: request.employeeId,
          title: approved ? "WFH - manager approved" : "WFH - manager declined",
          message: approved
            ? `Your Work From Home request for ${dateStr} was approved by your manager and is awaiting HR's final call.`
            : `Your manager declined your Work From Home request for ${dateStr} - it's awaiting HR's final call.`,
          type: "info",
          link: "/wfh",
        })
      }
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
