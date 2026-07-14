import "server-only"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import { addEmailJob } from "@/lib/queue"
import { createNotification } from "@/lib/notifications"
import { createAuditLog } from "@/lib/audit"
import { requireSession, requirePermission } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import { startOfDayUTC } from "@/lib/dates"
import { renderDecisionEmail } from "@/lib/email-layout"
import { recomputeAccrued } from "./leave-accrual.service"
// Canonical probation rule (pure helpers) - keep leave eligibility in lockstep
// with how the rest of the app decides who is on probation.
import { isOnProbation } from "@/features/employees/probation"

const REQUEST_INCLUDE = {
  employee: {
    select: EMPLOYEE_SUMMARY_SELECT,
  },
  leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
  approver: { select: { id: true, firstName: true, lastName: true } },
} as const

// Calendar days inclusive - sandwich rule (weekends between leave days are counted)
function countCalendarDays(start: Date, end: Date): number {
  const s = startOfDayUTC(start)
  const e = startOfDayUTC(end)
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

// Probation completion (confirmed early → recorded date; else joining + months).
// Mirrors the accrual engine so leave eligibility stays in lockstep.
function probationDone(e: {
  confirmationDate: Date | null
  dateOfJoining: Date | null
  probationMonths: number
}): Date | null {
  if (e.confirmationDate) return e.confirmationDate
  if (e.dateOfJoining) {
    const d = new Date(e.dateOfJoining)
    d.setMonth(d.getMonth() + (e.probationMonths || 6))
    return d
  }
  return null
}
function addMonths(d: Date, n: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

// ─── Approval routing ─────────────────────────────────────────────────────────
// Who must approve a request depends on who applied:
//   employee -> their manager · manager -> HR · HR -> Admin · admin_ -> auto.
type ApprovalStage = "MANAGER" | "HR" | "ADMIN"
type ApprovalRoute = {
  stage: ApprovalStage | null
  currentApproverId: string | null
  autoApprove: boolean
}

async function resolveApprovalRoute(
  applicantId: string,
  roles: string[],
  permissions: string[],
): Promise<ApprovalRoute> {
  const has = (r: string) => roles.includes(r)
  // admin_ self-grants; admin and HR escalate their own leave to the Admin tier.
  if (has(SYSTEM_ROLES.ADMIN_)) return { stage: null, currentApproverId: null, autoApprove: true }
  if (has(SYSTEM_ROLES.ADMIN))
    return { stage: "ADMIN", currentApproverId: null, autoApprove: false }
  if (has(SYSTEM_ROLES.HR_MANAGER) || has(SYSTEM_ROLES.HR_EMPLOYEE))
    return { stage: "ADMIN", currentApproverId: null, autoApprove: false }
  // Everyone else: HR makes the FINAL call (stage "HR"). A manager applying for
  // their own leave has no advisory reviewer; a regular employee with an active
  // manager gets that manager as an advisory reviewer (currentApproverId) whose
  // decision HR can still override - mirroring floating-holiday requests.
  if (permissions.includes(PERMISSIONS.LEAVE_APPROVE))
    return { stage: "HR", currentApproverId: null, autoApprove: false }
  const emp = await db.employee.findUnique({
    where: { id: applicantId },
    select: { manager: { select: { id: true, isActive: true } } },
  })
  const advisoryManagerId = emp?.manager?.isActive ? emp.manager.id : null
  return { stage: "HR", currentApproverId: advisoryManagerId, autoApprove: false }
}

/**
 * Whether the session can make the FINAL decision on a request (sets it
 * APPROVED/REJECTED). HR owns the "HR" stage; Admin owns "ADMIN" and any stage.
 * The legacy "MANAGER" stage and un-routed requests keep their old single-
 * approver behaviour so any in-flight requests still resolve.
 */
function canFinalizeRequest(
  roles: string[],
  permissions: string[],
  request: { approvalStage: string | null; currentApproverId: string | null },
  userId: string,
): boolean {
  if (roles.includes(SYSTEM_ROLES.ADMIN_) || roles.includes(SYSTEM_ROLES.ADMIN)) return true
  switch (request.approvalStage) {
    case "HR":
      return roles.includes(SYSTEM_ROLES.HR_MANAGER) || roles.includes(SYSTEM_ROLES.HR_EMPLOYEE)
    case "ADMIN":
      return false // admins handled above
    case "MANAGER":
      return request.currentApproverId === userId // legacy single-approver
    default:
      return permissions.includes(PERMISSIONS.LEAVE_APPROVE)
  }
}

/**
 * Whether the session is the advisory reporting manager for a request still
 * awaiting HR's final call. Their decision is recorded but non-final - HR can
 * approve even over a manager's rejection (mirrors floating-holiday requests).
 */
function canAdviseRequest(
  roles: string[],
  request: { approvalStage: string | null; currentApproverId: string | null },
  userId: string,
): boolean {
  const isHrOrAdmin =
    roles.includes(SYSTEM_ROLES.ADMIN_) ||
    roles.includes(SYSTEM_ROLES.ADMIN) ||
    roles.includes(SYSTEM_ROLES.HR_MANAGER) ||
    roles.includes(SYSTEM_ROLES.HR_EMPLOYEE)
  return !isHrOrAdmin && request.approvalStage === "HR" && request.currentApproverId === userId
}

/** Notify the routed approver(s) on apply (in-app + best-effort email). */
async function notifyApprovers(
  route: ApprovalRoute,
  request: { id: string; startDate: Date; endDate: Date; totalDays: number },
  applicantName: string,
  leaveTypeName: string,
): Promise<void> {
  // Notify BOTH the advisory reporting manager (if any) AND the role queue that
  // makes the final call (HR or Admin), deduped - so a regular employee's
  // request reaches their manager and HR at the same time.
  const byId = new Map<string, { id: string; email: string; firstName: string }>()
  if (route.currentApproverId) {
    const m = await db.employee.findUnique({
      where: { id: route.currentApproverId },
      select: { id: true, email: true, firstName: true },
    })
    if (m) byId.set(m.id, m)
  }
  if (route.stage) {
    const roleNames = route.stage === "HR" ? [SYSTEM_ROLES.HR_MANAGER] : [SYSTEM_ROLES.ADMIN]
    const staff = await db.employee.findMany({
      where: {
        isActive: true,
        employeeRoles: { some: { role: { name: { in: roleNames } } } },
      },
      select: { id: true, email: true, firstName: true },
    })
    for (const s of staff) byId.set(s.id, s)
  }
  const recipients = Array.from(byId.values())

  const start = new Date(request.startDate).toDateString()
  const end = new Date(request.endDate).toDateString()
  const detail = `${applicantName} · ${leaveTypeName} · ${start} – ${end} (${request.totalDays} day${request.totalDays !== 1 ? "s" : ""})`

  for (const r of recipients) {
    try {
      await createNotification({
        employeeId: r.id,
        title: "Leave approval needed",
        message: `${detail} is awaiting your approval.`,
        type: "info",
        link: "/leave/leave-directory",
      })
      addEmailJob({
        to: r.email,
        subject: "Leave request awaiting your approval",
        html: `<p>Hi ${r.firstName},</p><p>A leave request needs your review:</p><p><strong>${detail}</strong></p><p>Please review it in DNMS.</p>`,
        text: `Hi ${r.firstName}, a leave request needs your review: ${detail}. Please review it in DNMS.`,
      })
    } catch {
      // Non-blocking - notifications/email must not fail the request.
    }
  }
}

// ─── Leave types ────────────────────────────────────────────────────────────
export async function getLeaveTypes(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requireSession()
    const types = await db.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    })
    return ok(serialize({ data: types }))
  })
}

// Leave types the CURRENT user may actually apply for - same gates as applyLeave:
// during probation only unpaid leave is available, and Maternity is female-only.
export async function getEligibleLeaveTypes(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const year = new Date().getFullYear()
    const [types, balances] = await Promise.all([
      db.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      db.leaveBalance.findMany({
        where: { employeeId: session.user.id, year },
        select: { leaveTypeId: true, allocated: true },
      }),
    ])
    // A PAID leave type is applicable only when the employee actually has an
    // allocation for it this year. The accrual engine already encodes every rule
    // (probation, intern/contract policy, ML gender, prorated entitlement), so a
    // positive `allocated` is the single source of truth - no separate probation
    // flag to drift out of sync. Unpaid types (e.g. LWP) are always available, so
    // interns/probationers can still take unpaid time off.
    const entitled = new Set(
      balances.filter((b) => Number(b.allocated) > 0).map((b) => b.leaveTypeId),
    )
    const eligible = types.filter((t) => (t.isPaid ? entitled.has(t.id) : true))
    return ok(serialize({ data: eligible }))
  })
}

export async function createLeaveType(
  body: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.LEAVE_APPROVE)
    const {
      name,
      code,
      description,
      isPaid,
      maxDaysPerYear,
      carryForward,
      maxCarryDays,
      requiresApproval,
    } = body as Record<string, unknown>
    if (!name || !code) return fail("Name and code are required")
    try {
      const leaveType = await db.leaveType.create({
        data: {
          name: String(name).trim(),
          code: String(code).trim().toUpperCase(),
          description: description ? String(description).trim() : null,
          isPaid: Boolean(isPaid ?? true),
          maxDaysPerYear: Number(maxDaysPerYear ?? 0),
          carryForward: Boolean(carryForward ?? false),
          maxCarryDays: Number(maxCarryDays ?? 0),
          requiresApproval: Boolean(requiresApproval ?? true),
          isActive: true,
        },
      })
      await createAuditLog(session, {
        action: "CREATE",
        module: "leave",
        entityType: "LeaveType",
        entityId: leaveType.id,
      })
      return ok(serialize({ data: leaveType }))
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        return fail("A leave type with that name or code already exists")
      throw e
    }
  })
}

export async function updateLeaveType(
  id: string,
  body: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.LEAVE_APPROVE)
    const existing = await db.leaveType.findUnique({ where: { id } })
    if (!existing) return fail("Leave type not found")

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = String(body.name).trim()
    if (body.code !== undefined) updateData.code = String(body.code).trim().toUpperCase()
    if (body.description !== undefined)
      updateData.description = body.description ? String(body.description).trim() : null
    if (body.isPaid !== undefined) updateData.isPaid = Boolean(body.isPaid)
    if (body.maxDaysPerYear !== undefined) updateData.maxDaysPerYear = Number(body.maxDaysPerYear)
    if (body.carryForward !== undefined) updateData.carryForward = Boolean(body.carryForward)
    if (body.maxCarryDays !== undefined) updateData.maxCarryDays = Number(body.maxCarryDays)
    if (body.requiresApproval !== undefined)
      updateData.requiresApproval = Boolean(body.requiresApproval)
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)

    try {
      const leaveType = await db.leaveType.update({ where: { id }, data: updateData })
      await createAuditLog(session, {
        action: "UPDATE",
        module: "leave",
        entityType: "LeaveType",
        entityId: id,
        changes: updateData as object,
      })
      return ok(serialize({ data: leaveType }))
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        return fail("A leave type with that name or code already exists")
      throw e
    }
  })
}

export async function deleteLeaveType(
  id: string,
  permanent = false,
): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.LEAVE_APPROVE)
    const existing = await db.leaveType.findUnique({ where: { id } })
    if (!existing) return fail("Leave type not found")

    if (permanent) {
      // Permanent (hard) delete is far more destructive than deactivation, so it's
      // restricted to HR Managers and Admins - other leave:approve holders can only
      // deactivate.
      const roles = session.user.roles ?? []
      const canHardDelete =
        roles.includes(SYSTEM_ROLES.ADMIN_) ||
        roles.includes(SYSTEM_ROLES.ADMIN) ||
        roles.includes(SYSTEM_ROLES.HR_MANAGER)
      if (!canHardDelete)
        return fail(
          "Only HR Managers and Admins can permanently delete a leave type. You can deactivate it instead.",
        )
      // Remove the type and everything tied to it. Balances & policy rows cascade
      // on delete; leave requests are Restrict-guarded, so clear them first.
      await db.$transaction([
        db.leaveRequest.deleteMany({ where: { leaveTypeId: id } }),
        db.leaveType.delete({ where: { id } }),
      ])
      await createAuditLog(session, {
        action: "HARD_DELETE",
        module: "leave",
        entityType: "LeaveType",
        entityId: id,
        changes: { name: existing.name, code: existing.code, permanent: true },
      })
      return ok({ message: "Leave type permanently deleted" })
    }

    await db.leaveType.update({ where: { id }, data: { isActive: false } })
    await createAuditLog(session, {
      action: "DELETE",
      module: "leave",
      entityType: "LeaveType",
      entityId: id,
      changes: { softDeleted: true },
    })
    return ok({ message: "Leave type deactivated successfully" })
  })
}

// ─── Balances ───────────────────────────────────────────────────────────────
export async function getLeaveBalances(
  employeeId?: string,
  year?: number,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const resolvedYear = year ?? new Date().getFullYear()

    let targetId: string
    if (!employeeId || employeeId === session.user.id) {
      targetId = session.user.id
    } else {
      if (!hasPermission(session, PERMISSIONS.LEAVE_APPROVE)) return fail("Forbidden")
      targetId = employeeId
    }

    const balances = await db.leaveBalance.findMany({
      // Only surface balances for still-active leave types; a deleted/deactivated
      // type (e.g. Maternity) must disappear from the employee's view.
      where: { employeeId: targetId, year: resolvedYear, leaveType: { isActive: true } },
      include: { leaveType: true },
      orderBy: { leaveType: { name: "asc" } },
    })
    return ok(serialize({ data: balances }))
  })
}

// HR view: every active employee with their leave balances by type for a year.
// Gated by leave:approve. Excludes the hidden admin_ watch account, like the
// rest of the app.
export async function getAllLeaveBalances(year?: number): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.LEAVE_APPROVE)
    const resolvedYear = year ?? new Date().getFullYear()

    const employees = await db.employee.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        // Admins (and the hidden admin_ watch account) don't take leave - hide them.
        NOT: {
          employeeRoles: {
            some: { role: { name: { in: [SYSTEM_ROLES.ADMIN_, SYSTEM_ROLES.ADMIN] } } },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
        profilePhoto: true,
        department: { select: { id: true, name: true } },
        leaveBalances: {
          where: { year: resolvedYear, leaveType: { isActive: true } },
          // Explicit select: `include: { leaveType: true }` repeated the ENTIRE
          // leave-type row on every balance of every employee.
          select: {
            id: true,
            employeeId: true,
            leaveTypeId: true,
            year: true,
            allocated: true,
            accrued: true,
            used: true,
            pending: true,
            carried: true,
            leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
          },
          orderBy: { leaveType: { name: "asc" } },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    })

    return ok(serialize({ data: employees, year: resolvedYear }))
  })
}

export async function allocateLeave(body: {
  employeeId: string
  leaveTypeId: string
  year: number
  allocated: number
  carried?: number
}): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.LEAVE_APPROVE)
    const { employeeId, leaveTypeId, year, allocated, carried } = body
    if (!employeeId || !leaveTypeId || !year)
      return fail("employeeId, leaveTypeId, and year are required")

    const [employee, leaveType] = await Promise.all([
      db.employee.findUnique({ where: { id: employeeId } }),
      db.leaveType.findUnique({ where: { id: leaveTypeId } }),
    ])
    if (!employee) return fail("Employee not found")
    if (!leaveType) return fail("Leave type not found")

    await db.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: Number(year) } },
      update: { allocated: Number(allocated ?? 0), carried: Number(carried ?? 0) },
      create: {
        employeeId,
        leaveTypeId,
        year: Number(year),
        allocated: Number(allocated ?? 0),
        accrued: 0,
        used: 0,
        pending: 0,
        carried: Number(carried ?? 0),
      },
    })
    // Recompute accrued from the new allocation so availability reflects it.
    await recomputeAccrued(employeeId, Number(year))
    const balance = await db.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: Number(year) } },
      include: { leaveType: true },
    })
    if (!balance) return fail("Failed to allocate leave balance")

    await createAuditLog(session, {
      action: "ALLOCATE",
      module: "leave",
      entityType: "LeaveBalance",
      entityId: balance.id,
      changes: { employeeId, leaveTypeId, year, allocated, carried },
    })
    return ok(serialize({ data: balance }))
  })
}

// ─── Requests ───────────────────────────────────────────────────────────────
type RequestFilters = {
  status?: string
  employeeId?: string
  leaveTypeId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export async function getLeaveRequests(
  filters: RequestFilters = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const canApprove = hasPermission(session, PERMISSIONS.LEAVE_APPROVE)

    const { page, limit, skip, take } = resolvePagination(filters, 20)

    const where: Record<string, unknown> = {}
    if (canApprove) {
      if (filters.status) where.status = filters.status
      if (filters.employeeId) where.employeeId = filters.employeeId
      if (filters.leaveTypeId) where.leaveTypeId = filters.leaveTypeId
      if (filters.from || filters.to) {
        where.startDate = {}
        if (filters.from) (where.startDate as Record<string, unknown>).gte = new Date(filters.from)
        if (filters.to) (where.startDate as Record<string, unknown>).lte = new Date(filters.to)
      }
    } else {
      where.employeeId = session.user.id
      if (filters.status) where.status = filters.status
      if (filters.leaveTypeId) where.leaveTypeId = filters.leaveTypeId
    }

    const [requests, total] = await Promise.all([
      db.leaveRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.leaveRequest.count({ where }),
    ])
    return ok(
      serialize({
        data: requests,
        pagination: paginationMeta(total, page, limit),
      }),
    )
  })
}

export async function getTeamLeaveRequests(
  filters: { status?: string; page?: number; limit?: number } = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.LEAVE_APPROVE)
    const { page, limit, skip, take } = resolvePagination(filters, 20)

    const directReports = await db.employee.findMany({
      where: { managerId: session.user.id, isActive: true },
      select: { id: true },
    })
    const directReportIds = directReports.map((e) => e.id)

    // An approver sees: requests routed directly to them, their direct reports'
    // requests, and the role queue they own (HR -> HR stage, Admin -> ADMIN stage).
    const roles = session.user.roles ?? []
    const orConds: Record<string, unknown>[] = [{ currentApproverId: session.user.id }]
    if (directReportIds.length) orConds.push({ employeeId: { in: directReportIds } })
    if (roles.includes(SYSTEM_ROLES.HR_MANAGER) || roles.includes(SYSTEM_ROLES.HR_EMPLOYEE))
      orConds.push({ approvalStage: "HR" })
    if (roles.includes(SYSTEM_ROLES.ADMIN) || roles.includes(SYSTEM_ROLES.ADMIN_))
      orConds.push({ approvalStage: "ADMIN" })

    const where: Record<string, unknown> = {
      OR: orConds,
      NOT: { employeeId: session.user.id }, // never your own request in an approval queue
    }
    if (filters.status) where.status = filters.status

    const [requests, total] = await Promise.all([
      db.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              ...EMPLOYEE_SUMMARY_SELECT,
              department: { select: { id: true, name: true } },
            },
          },
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.leaveRequest.count({ where }),
    ])
    return ok(
      serialize({
        data: requests,
        pagination: paginationMeta(total, page, limit),
      }),
    )
  })
}

/**
 * The logged-in user's team leave requests - their direct reports' requests.
 * Available to any manager identified by the reporting relationship (NOT a
 * permission), so a line manager without leave:approve still sees their team.
 * Returns `isManager` so the My Leave page shows the tab only when the person
 * actually manages someone. Their decision here is advisory; HR makes the final
 * call (see updateLeaveRequest).
 */
export async function getMyTeamLeaveRequests(
  filters: { status?: string; page?: number; limit?: number } = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const reports = await db.employee.findMany({
      where: { managerId: session.user.id, isActive: true },
      select: { id: true },
    })
    const reportIds = reports.map((r) => r.id)
    const { page, limit, skip, take } = resolvePagination(filters, 10)

    if (reportIds.length === 0) {
      return ok(
        serialize({
          data: { requests: [], isManager: false, pagination: paginationMeta(0, page, limit) },
        }),
      )
    }

    const where: Record<string, unknown> = { employeeId: { in: reportIds } }
    if (filters.status) where.status = filters.status

    const [requests, total] = await Promise.all([
      db.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              ...EMPLOYEE_SUMMARY_SELECT,
              department: { select: { id: true, name: true } },
            },
          },
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.leaveRequest.count({ where }),
    ])

    return ok(
      serialize({
        data: { requests, isManager: true, pagination: paginationMeta(total, page, limit) },
      }),
    )
  })
}

export async function applyLeave(body: {
  leaveTypeId: string
  startDate: string
  endDate: string
  reason?: string
  isHalfDay?: boolean
}): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const { leaveTypeId, startDate, endDate, reason, isHalfDay } = body
    if (!leaveTypeId || !startDate || !endDate)
      return fail("leaveTypeId, startDate, and endDate are required")

    const start = startOfDayUTC(startDate)
    const end = startOfDayUTC(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return fail("Invalid date format")
    if (end < start) return fail("End date must be on or after start date")

    const leaveType = await db.leaveType.findUnique({ where: { id: leaveTypeId } })
    if (!leaveType || !leaveType.isActive) return fail("Leave type not found or inactive")

    const employee = await db.employee.findUnique({
      where: { id: session.user.id },
      select: {
        onProbation: true,
        probationMonths: true,
        dateOfJoining: true,
        confirmationDate: true,
        gender: true,
      },
    })

    // Paid leave is blocked during probation; unpaid leave (e.g. LWP) is always
    // available - this is how interns/probationers can still take unpaid time off.
    if (leaveType.isPaid && employee && isOnProbation(employee))
      return fail(
        "Paid leave is not available during probation. You may apply for unpaid leave (LWP) instead.",
      )

    // No leave during the notice period (after an accepted resignation). Any
    // exception is at management's discretion, handled offline by HR.
    const acceptedResignation = await db.resignation.findFirst({
      where: { employeeId: session.user.id, status: "APPROVED" },
      select: { id: true },
    })
    if (acceptedResignation)
      return fail(
        "You can't apply for leave during your notice period. Any exception is at management's discretion - please contact HR.",
      )

    let totalDays = isHalfDay ? 0.5 : countCalendarDays(start, end)
    if (leaveType.code === "SHORT") totalDays = 0.5
    if (totalDays === 0) return fail("Selected date range results in zero leave days")

    // #2 Advance-notice windows: EL 60 days (else not approved), CL/LWP 2 days.
    const noticeDays = Math.floor(
      (start.getTime() - startOfDayUTC(new Date()).getTime()) / 86_400_000,
    )
    if (leaveType.code === "EL" && noticeDays < 60)
      return fail("Earned Leave must be applied at least 60 days in advance.")
    if ((leaveType.code === "CL" || leaveType.code === "LWP") && noticeDays < 2)
      return fail(`${leaveType.name} must be applied at least 2 days in advance.`)

    // EL no longer has an extra post-probation wait - being paid leave, it is
    // already blocked during probation above and becomes available right at
    // probation end (matching the accrual engine).

    if (leaveType.code === "ML") {
      // Maternity Leave: female employees only, after 2 years of service.
      if (employee?.gender !== "FEMALE")
        return fail("Maternity Leave is available to female employees only.")
      if (employee.dateOfJoining) {
        const twoYearsAfter = new Date(employee.dateOfJoining)
        twoYearsAfter.setFullYear(twoYearsAfter.getFullYear() + 2)
        if (new Date() < twoYearsAfter)
          return fail("Maternity Leave is only available after completing 2 years of service.")
      }
    }

    if (leaveType.code === "EL") {
      if (totalDays < 3)
        return fail("Earned Leave requires a minimum of 3 consecutive days per application.")
      if (totalDays > 7) return fail("Earned Leave allows a maximum of 7 days per application.")
      // #1 Eligible only after probation is COMPLETED plus 6 months of service.
      const done = employee ? probationDone(employee) : null
      const elEligibleFrom = done ? addMonths(done, 6) : null
      if (elEligibleFrom && new Date() < elEligibleFrom)
        return fail(
          "Earned Leave is available only after completing probation plus 6 months of service.",
        )
      // #3 Half-year cap: max 7 EL in Jan–Jun and 7 in Jul–Dec.
      const y = start.getUTCFullYear()
      const firstHalf = start.getUTCMonth() < 6
      const halfStart = new Date(Date.UTC(y, firstHalf ? 0 : 6, 1))
      const halfEnd = new Date(Date.UTC(y, firstHalf ? 5 : 11, firstHalf ? 30 : 31))
      const elInHalf = await db.leaveRequest.findMany({
        where: {
          employeeId: session.user.id,
          leaveTypeId,
          status: { in: ["PENDING", "APPROVED"] },
          startDate: { gte: halfStart, lte: halfEnd },
        },
        select: { totalDays: true },
      })
      const usedThisHalf = elInHalf.reduce((s, r) => s + r.totalDays, 0)
      if (usedThisHalf + totalDays > 7)
        return fail(
          `Earned Leave is capped at 7 days per half-year (${firstHalf ? "Jan–Jun" : "Jul–Dec"}). You've already used/pending ${usedThisHalf} day(s) this half.`,
        )
    }

    if (leaveType.code === "CL") {
      const monthStart = new Date(start.getUTCFullYear(), start.getUTCMonth(), 1)
      const monthEnd = new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)
      const existing = await db.leaveRequest.findMany({
        where: {
          employeeId: session.user.id,
          leaveTypeId,
          status: { in: ["PENDING", "APPROVED"] },
          startDate: { gte: monthStart, lte: monthEnd },
        },
      })
      const usedThisMonth = existing.reduce((sum, r) => sum + r.totalDays, 0)
      if (usedThisMonth + totalDays > 2)
        return fail(
          `Casual Leave limit exceeded: maximum 2 days per month. You have already used/pending ${usedThisMonth} day(s) this month.`,
        )
    }

    if (leaveType.code === "SHORT") {
      const monthStart = new Date(start.getUTCFullYear(), start.getUTCMonth(), 1)
      const monthEnd = new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)
      const usedCount = await db.leaveRequest.count({
        where: {
          employeeId: session.user.id,
          leaveTypeId,
          status: { in: ["PENDING", "APPROVED"] },
          startDate: { gte: monthStart, lte: monthEnd },
        },
      })
      if (usedCount >= 2) {
        const lwpType = await db.leaveType.findUnique({ where: { code: "LWP" } })
        if (lwpType)
          return fail(
            "You have already used 2 Short Leaves this month. A 3rd Short Leave will be treated as a half-day Leave Without Pay. Please apply for 0.5 days of Leave Without Pay instead.",
          )
      }
    }

    if (leaveType.code === "CL" || leaveType.code === "SL") {
      const elType = await db.leaveType.findUnique({ where: { code: "EL" } })
      if (elType) {
        const dayBefore = new Date(start)
        dayBefore.setDate(dayBefore.getDate() - 1)
        const dayAfter = new Date(end)
        dayAfter.setDate(dayAfter.getDate() + 1)
        const adjacent = await db.leaveRequest.findFirst({
          where: {
            employeeId: session.user.id,
            leaveTypeId: elType.id,
            status: { in: ["PENDING", "APPROVED"] },
            OR: [
              { endDate: { gte: dayBefore, lte: start } },
              { startDate: { gte: end, lte: dayAfter } },
            ],
          },
        })
        if (adjacent)
          return fail(
            `${leaveType.name} cannot be combined with Earned Leave as per company policy.`,
          )
      }
    }

    if (leaveType.code === "EL") {
      const clType = await db.leaveType.findFirst({ where: { code: { in: ["CL", "SL"] } } })
      if (clType) {
        const dayBefore = new Date(start)
        dayBefore.setDate(dayBefore.getDate() - 1)
        const dayAfter = new Date(end)
        dayAfter.setDate(dayAfter.getDate() + 1)
        const adjacent = await db.leaveRequest.findFirst({
          where: {
            employeeId: session.user.id,
            leaveType: { code: { in: ["CL", "SL"] } },
            status: { in: ["PENDING", "APPROVED"] },
            OR: [
              { endDate: { gte: dayBefore, lte: start } },
              { startDate: { gte: end, lte: dayAfter } },
            ],
          },
        })
        if (adjacent)
          return fail(
            "Earned Leave cannot be combined with Casual Leave or Sick Leave as per company policy.",
          )
      }
    }

    const overlapping = await db.leaveRequest.findFirst({
      where: {
        employeeId: session.user.id,
        status: { in: ["PENDING", "APPROVED"] },
        AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
      },
    })
    if (overlapping)
      return fail("You already have a leave request that overlaps with the selected dates.")

    const year = start.getUTCFullYear()
    const balance = await db.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: session.user.id, leaveTypeId, year } },
    })
    if (leaveType.isPaid && leaveType.maxDaysPerYear > 0) {
      // Paid, quota-based leave needs an allocation. No balance (or a zero
      // allocation) means the employee isn't entitled to it this year - e.g.
      // interns, or anyone still on probation. The balance is the source of
      // truth, so this can't be bypassed by a stale probation flag.
      if (!balance || balance.allocated <= 0)
        return fail(
          `You don't have any ${leaveType.name} allocated this year. You may apply for unpaid leave (LWP) instead.`,
        )
      // Availability is what has ACCRUED so far (+ carry), not the full annual cap.
      const available = balance.accrued + balance.carried - balance.used - balance.pending
      if (available < totalDays)
        return fail(
          `Insufficient leave balance. Available: ${available} day(s), Requested: ${totalDays} day(s).`,
        )
    }

    const route = await resolveApprovalRoute(
      session.user.id,
      session.user.roles ?? [],
      session.user.permissions ?? [],
    )

    const result = await db.$transaction(async (tx) => {
      const request = await tx.leaveRequest.create({
        data: {
          employeeId: session.user.id,
          leaveTypeId,
          startDate: start,
          endDate: end,
          totalDays,
          reason: reason ? String(reason).trim() : null,
          // admin_'s own leave is auto-granted; everyone else is routed.
          status: route.autoApprove ? "APPROVED" : "PENDING",
          approvedAt: route.autoApprove ? new Date() : null,
          approverId: route.autoApprove ? session.user.id : null,
          approvalStage: route.autoApprove ? null : route.stage,
          currentApproverId: route.autoApprove ? null : route.currentApproverId,
        },
        include: {
          employee: {
            select: EMPLOYEE_SUMMARY_SELECT,
          },
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
        },
      })
      await tx.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId: session.user.id, leaveTypeId, year } },
        // Auto-approved => straight to used; otherwise hold as pending.
        update: route.autoApprove
          ? { used: { increment: totalDays } }
          : { pending: { increment: totalDays } },
        create: {
          employeeId: session.user.id,
          leaveTypeId,
          year,
          allocated: 0,
          accrued: 0,
          used: route.autoApprove ? totalDays : 0,
          pending: route.autoApprove ? 0 : totalDays,
          carried: 0,
        },
      })
      return request
    })

    if (!route.autoApprove) {
      await notifyApprovers(
        route,
        result,
        `${result.employee.firstName} ${result.employee.lastName}`,
        result.leaveType.name,
      )
    }

    return ok(serialize({ data: result }))
  })
}

export async function updateLeaveRequest(
  id: string,
  action: "CANCEL" | "APPROVE" | "REJECT",
  rejectionReason?: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    if (!action || !["CANCEL", "APPROVE", "REJECT"].includes(action))
      return fail("Action must be one of: CANCEL, APPROVE, REJECT")

    const request = await db.leaveRequest.findUnique({ where: { id } })
    if (!request) return fail("Leave request not found")
    if (request.status !== "PENDING")
      return fail(
        `Cannot ${action.toLowerCase()} a request that is already ${request.status.toLowerCase()}`,
      )

    const roles = session.user.roles ?? []
    const permissions = session.user.permissions ?? []
    const isFinalizer = canFinalizeRequest(roles, permissions, request, session.user.id)
    const isAdvisor = canAdviseRequest(roles, request, session.user.id)

    if (action === "CANCEL") {
      if (request.employeeId !== session.user.id)
        return fail("You can only cancel your own leave requests")
    } else {
      if (!isFinalizer && !isAdvisor)
        return fail("Forbidden: this request is awaiting a different approver")
      if (action === "REJECT" && !rejectionReason?.trim())
        return fail("Rejection reason is required")
    }

    const year = new Date(request.startDate).getUTCFullYear()
    const balanceKey = {
      employeeId_leaveTypeId_year: {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
      },
    }

    const updatedRequest = await db.$transaction(async (tx) => {
      let updatedReq
      if (action === "CANCEL") {
        updatedReq = await tx.leaveRequest.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: REQUEST_INCLUDE,
        })
        await tx.leaveBalance.updateMany({
          where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year },
          data: { pending: { decrement: request.totalDays } },
        })
      } else if (!isFinalizer && isAdvisor) {
        // Advisory reporting-manager decision - recorded, but the request stays
        // PENDING so HR can still make (or override) the final call. The balance
        // is untouched (it remains held as pending until HR finalises).
        updatedReq = await tx.leaveRequest.update({
          where: { id },
          data:
            action === "APPROVE"
              ? { managerDecision: "APPROVED" }
              : { managerDecision: "REJECTED", rejectionReason: String(rejectionReason).trim() },
          include: REQUEST_INCLUDE,
        })
      } else if (action === "APPROVE") {
        updatedReq = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            approverId: session.user.id,
            approvedAt: new Date(),
            approvalStage: null,
            currentApproverId: null,
          },
          include: REQUEST_INCLUDE,
        })
        await tx.leaveBalance.upsert({
          where: balanceKey,
          update: {
            pending: { decrement: request.totalDays },
            used: { increment: request.totalDays },
          },
          create: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
            allocated: 0,
            used: request.totalDays,
            pending: 0,
            carried: 0,
          },
        })
      } else {
        updatedReq = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: "REJECTED",
            approverId: session.user.id,
            rejectionReason: String(rejectionReason).trim(),
            approvalStage: null,
            currentApproverId: null,
          },
          include: REQUEST_INCLUDE,
        })
        await tx.leaveBalance.updateMany({
          where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year },
          data: { pending: { decrement: request.totalDays } },
        })
      }
      return updatedReq
    })

    try {
      const emp = await db.employee.findUnique({
        where: { id: request.employeeId },
        select: { firstName: true, email: true },
      })
      const leaveType = await db.leaveType.findUnique({
        where: { id: request.leaveTypeId },
        select: { name: true },
      })
      if (emp && action !== "CANCEL") {
        if (!isFinalizer && isAdvisor) {
          // Advisory manager decision - the request still needs HR's final call.
          const approved = action === "APPROVE"
          await createNotification({
            employeeId: request.employeeId,
            title: approved ? "Leave - manager approved" : "Leave - manager declined",
            message: approved
              ? `Your ${leaveType?.name ?? "leave"} request was approved by your manager and is awaiting HR's final approval.`
              : `Your manager declined your ${leaveType?.name ?? "leave"} request - it is awaiting HR's final call.`,
            type: "info",
            link: "/leave",
          })
        } else {
          const isApproved = action === "APPROVE"
          const startDate = new Date(request.startDate).toDateString()
          await createNotification({
            employeeId: request.employeeId,
            title: isApproved ? "Leave Approved" : "Leave Rejected",
            message: isApproved
              ? `Your ${leaveType?.name ?? "leave"} request from ${startDate} has been approved.`
              : `Your ${leaveType?.name ?? "leave"} request from ${startDate} was rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : ""}`,
            type: isApproved ? "success" : "error",
            link: "/leave",
          })
          const endDate = new Date(request.endDate).toDateString()
          const detailLine = `${leaveType?.name ?? "Leave"} · ${startDate} – ${endDate} (${request.totalDays} day${request.totalDays !== 1 ? "s" : ""})`
          const email = renderDecisionEmail({
            kind: "Leave request",
            approved: isApproved,
            firstName: emp.firstName,
            detailLine,
            reason: !isApproved && rejectionReason ? rejectionReason : null,
          })
          addEmailJob({
            to: emp.email,
            subject: email.subject,
            html: email.html,
            text: email.text,
          })
        }
      }
    } catch {
      // Non-blocking - don't fail the request if email fails
    }

    return ok(serialize({ data: updatedRequest }))
  })
}
