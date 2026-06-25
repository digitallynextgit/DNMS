"use server"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { sendEmail } from "@/lib/mailer"
import { createNotification } from "@/lib/notifications"
import { requireSession, requirePermission } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import { startOfDayUTC } from "@/lib/dates"
import { renderDecisionEmail } from "@/lib/email-layout"

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

function daysFromToday(date: Date): number {
  const today = startOfDayUTC(new Date())
  const d = startOfDayUTC(date)
  return Math.floor((d.getTime() - today.getTime()) / 86400000)
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
      await db.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "CREATE",
          module: "leave",
          entityType: "LeaveType",
          entityId: leaveType.id,
        },
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
      await db.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "UPDATE",
          module: "leave",
          entityType: "LeaveType",
          entityId: id,
          changes: updateData as object,
        },
      })
      return ok(serialize({ data: leaveType }))
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        return fail("A leave type with that name or code already exists")
      throw e
    }
  })
}

export async function deleteLeaveType(id: string): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.LEAVE_APPROVE)
    const existing = await db.leaveType.findUnique({ where: { id } })
    if (!existing) return fail("Leave type not found")

    await db.leaveType.update({ where: { id }, data: { isActive: false } })
    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "DELETE",
        module: "leave",
        entityType: "LeaveType",
        entityId: id,
        changes: { softDeleted: true },
      },
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
      where: { employeeId: targetId, year: resolvedYear },
      include: { leaveType: true },
      orderBy: { leaveType: { name: "asc" } },
    })
    return ok(serialize({ data: balances }))
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

    const balance = await db.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: Number(year) } },
      update: { allocated: Number(allocated ?? 0), carried: Number(carried ?? 0) },
      create: {
        employeeId,
        leaveTypeId,
        year: Number(year),
        allocated: Number(allocated ?? 0),
        used: 0,
        pending: 0,
        carried: Number(carried ?? 0),
      },
      include: { leaveType: true },
    })

    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ALLOCATE",
        module: "leave",
        entityType: "LeaveBalance",
        entityId: balance.id,
        changes: { employeeId, leaveTypeId, year, allocated, carried },
      },
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

    const where: Record<string, unknown> = { employeeId: { in: directReportIds } }
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
      select: { probationEndDate: true, confirmationDate: true, dateOfJoining: true },
    })

    if (employee?.probationEndDate && new Date() < new Date(employee.probationEndDate))
      return fail("Employees are not eligible for leaves during the probation period.")

    let totalDays = isHalfDay ? 0.5 : countCalendarDays(start, end)
    if (leaveType.code === "SHORT") totalDays = 0.5
    if (totalDays === 0) return fail("Selected date range results in zero leave days")

    if (leaveType.code === "EL") {
      const probationEnd = employee?.probationEndDate ?? employee?.confirmationDate
      if (probationEnd) {
        const eligibleFrom = new Date(probationEnd)
        eligibleFrom.setMonth(eligibleFrom.getMonth() + 6)
        if (new Date() < eligibleFrom)
          return fail(
            "Earned Leave is available only after completing probation period plus 6 months.",
          )
      }
    }

    if (leaveType.code === "ML" && employee?.dateOfJoining) {
      const twoYearsAfter = new Date(employee.dateOfJoining)
      twoYearsAfter.setFullYear(twoYearsAfter.getFullYear() + 2)
      if (new Date() < twoYearsAfter)
        return fail("Maternity Leave is only available after completing 2 years of service.")
    }

    let lateNoticePenalty = false
    if ((leaveType.code === "CL" || leaveType.code === "LWP") && daysFromToday(start) < 2)
      lateNoticePenalty = true

    if (leaveType.code === "EL" && daysFromToday(start) < 60)
      return fail("Earned Leave requires at least 60 days advance notice. Please plan ahead.")

    if (leaveType.code === "EL") {
      if (totalDays < 3)
        return fail("Earned Leave requires a minimum of 3 consecutive days per application.")
      if (totalDays > 7) return fail("Earned Leave allows a maximum of 7 days per application.")
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
    if (balance && leaveType.maxDaysPerYear > 0) {
      const available = balance.allocated + balance.carried - balance.used - balance.pending
      if (available < totalDays)
        return fail(
          `Insufficient leave balance. Available: ${available} day(s), Requested: ${totalDays} day(s).`,
        )
    }

    const result = await db.$transaction(async (tx) => {
      const request = await tx.leaveRequest.create({
        data: {
          employeeId: session.user.id,
          leaveTypeId,
          startDate: start,
          endDate: end,
          totalDays,
          reason: reason ? String(reason).trim() : null,
          status: "PENDING",
          lateNoticePenalty,
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
        update: { pending: { increment: totalDays } },
        create: {
          employeeId: session.user.id,
          leaveTypeId,
          year,
          allocated: 0,
          used: 0,
          pending: totalDays,
          carried: 0,
        },
      })
      return request
    })

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

    const canApprove = hasPermission(session, PERMISSIONS.LEAVE_APPROVE)
    if (action === "CANCEL") {
      if (request.employeeId !== session.user.id)
        return fail("You can only cancel your own leave requests")
    } else {
      if (!canApprove) return fail("Forbidden: requires leave:approve permission")
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
      } else if (action === "APPROVE") {
        updatedReq = await tx.leaveRequest.update({
          where: { id },
          data: { status: "APPROVED", approverId: session.user.id, approvedAt: new Date() },
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
        await sendEmail({
          to: emp.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        })
      }
    } catch {
      // Non-blocking - don't fail the request if email fails
    }

    return ok(serialize({ data: updatedRequest }))
  })
}
