"use server"

import { db } from "@/lib/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { sendEmail } from "@/lib/mailer"
import { requireSession } from "./_guard"
import { ok, fail, runAction, serialize, type ActionResult } from "./_result"

type Tier = 1 | 2 | 3

function getEmployeeTier(probationEndDate: Date | null, confirmationDate: Date | null): Tier {
  const now = new Date()
  const probationEnd = probationEndDate ?? confirmationDate
  if (!probationEnd || now < new Date(probationEnd)) return 1
  const sixMonthsAfter = new Date(probationEnd)
  sixMonthsAfter.setMonth(sixMonthsAfter.getMonth() + 6)
  if (now < sixMonthsAfter) return 2
  return 3
}

export async function getWfhEligibility(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const employee = await db.employee.findUnique({
      where: { id: session.user.id },
      select: { probationEndDate: true, confirmationDate: true, dateOfJoining: true },
    })

    const now = new Date()
    const probationEnd = employee?.probationEndDate ?? employee?.confirmationDate ?? null

    let tier: Tier = 1
    let eligibleFromDate: string | null = null
    let label = ""

    if (!probationEnd || now < new Date(probationEnd)) {
      tier = 1
      label = "On Probation - WFH allowed only in emergencies (Manager + HR approval required)"
      if (probationEnd) {
        const sixMonthsAfter = new Date(probationEnd)
        sixMonthsAfter.setMonth(sixMonthsAfter.getMonth() + 6)
        eligibleFromDate = sixMonthsAfter.toISOString().split("T")[0]
      }
    } else {
      const sixMonthsAfter = new Date(probationEnd)
      sixMonthsAfter.setMonth(sixMonthsAfter.getMonth() + 6)
      if (now < sixMonthsAfter) {
        tier = 2
        label =
          "Within 6 months of probation completion - WFH allowed only in emergencies (Manager + HR approval required)"
        eligibleFromDate = sixMonthsAfter.toISOString().split("T")[0]
      } else {
        tier = 3
        label = "Eligible for 1 WFH day per month"
      }
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
      joiningDate: employee?.dateOfJoining?.toISOString().split("T")[0] ?? null,
      probationEnd: probationEnd ? new Date(probationEnd).toISOString().split("T")[0] : null,
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

    const page = Math.max(1, Number(filters.page ?? 1))
    const limit = Math.min(100, Math.max(1, Number(filters.limit ?? 20)))
    const skip = (page - 1) * limit

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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNo: true,
              profilePhoto: true,
            },
          },
          managerApprover: { select: { id: true, firstName: true, lastName: true } },
          hrApprover: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.wfhRequest.count({ where }),
    ])

    return ok(
      serialize({
        data: requests,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
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

    const wfhDate = new Date(date)
    wfhDate.setUTCHours(0, 0, 0, 0)
    if (isNaN(wfhDate.getTime())) return fail("Invalid date format")

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    if (wfhDate < today) return fail("Cannot apply for WFH in the past")

    const dow = wfhDate.getUTCDay()
    if (dow === 0 || dow === 6) return fail("WFH cannot be applied for weekends")

    const holiday = await db.holiday.findFirst({ where: { date: wfhDate, isOptional: false } })
    if (holiday) return fail(`${wfhDate.toDateString()} is a holiday (${holiday.name})`)

    const employee = await db.employee.findUnique({
      where: { id: session.user.id },
      select: { probationEndDate: true, confirmationDate: true },
    })
    const tier = getEmployeeTier(
      employee?.probationEndDate ?? null,
      employee?.confirmationDate ?? null,
    )

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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
            profilePhoto: true,
          },
        },
      },
    })

    return ok(serialize({ data: request, tier }))
  })
}

export async function updateWfhRequest(
  id: string,
  action: "CANCEL" | "APPROVE" | "REJECT",
  rejectionReason?: string,
  approverRole?: "MANAGER" | "HR",
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    if (!action || !["CANCEL", "APPROVE", "REJECT"].includes(action))
      return fail("Action must be one of: CANCEL, APPROVE, REJECT")

    const request = await db.wfhRequest.findUnique({ where: { id } })
    if (!request) return fail("WFH request not found")
    if (request.status !== "PENDING")
      return fail(
        `Cannot ${action.toLowerCase()} a request that is already ${request.status.toLowerCase()}`,
      )

    const canApprove = hasPermission(session, PERMISSIONS.WFH_APPROVE)

    if (action === "CANCEL") {
      if (request.employeeId !== session.user.id)
        return fail("You can only cancel your own WFH requests")
      const updated = await db.wfhRequest.update({ where: { id }, data: { status: "CANCELLED" } })
      return ok(serialize({ data: updated }))
    }

    if (!canApprove) return fail("Forbidden: requires wfh:approve permission")
    if (action === "REJECT" && !rejectionReason?.trim()) return fail("Rejection reason is required")

    const role: "MANAGER" | "HR" = approverRole === "HR" ? "HR" : "MANAGER"

    let updated
    if (action === "APPROVE") {
      const setMgr =
        role === "MANAGER"
          ? { managerApproverId: session.user.id, managerApprovedAt: new Date() }
          : {}
      const setHr = role === "HR" ? { hrApproverId: session.user.id, hrApprovedAt: new Date() } : {}

      const afterStamp = await db.wfhRequest.update({
        where: { id },
        data: { ...setMgr, ...setHr },
      })

      const isFullyApproved = afterStamp.isEmergency
        ? !!afterStamp.managerApproverId && !!afterStamp.hrApproverId
        : !!afterStamp.managerApproverId

      if (isFullyApproved) {
        updated = await db.wfhRequest.update({
          where: { id },
          data: { status: "APPROVED" },
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, email: true, employeeNo: true },
            },
            managerApprover: { select: { id: true, firstName: true, lastName: true } },
            hrApprover: { select: { id: true, firstName: true, lastName: true } },
          },
        })
      } else {
        updated = afterStamp
      }
    } else {
      updated = await db.wfhRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: String(rejectionReason).trim(),
          ...(role === "MANAGER" && { managerApproverId: session.user.id }),
          ...(role === "HR" && { hrApproverId: session.user.id }),
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, email: true, employeeNo: true },
          },
        },
      })
    }

    if (updated.status === "APPROVED" || updated.status === "REJECTED") {
      try {
        const emp = await db.employee.findUnique({
          where: { id: request.employeeId },
          select: { firstName: true, email: true },
        })
        if (emp) {
          const dateStr = new Date(request.date).toDateString()
          const approved = updated.status === "APPROVED"
          await createNotification({
            employeeId: request.employeeId,
            title: approved ? "WFH Approved" : "WFH Rejected",
            message: approved
              ? `Your Work From Home request for ${dateStr} has been approved.`
              : `Your Work From Home request for ${dateStr} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
            type: approved ? "success" : "error",
            link: "/wfh",
          })
          await sendEmail({
            to: emp.email,
            subject: approved
              ? "Your WFH request has been approved"
              : "Your WFH request has been rejected",
            html: `
              <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
                <h2 style="color:${approved ? "#16a34a" : "#dc2626"};">WFH Request ${approved ? "Approved" : "Rejected"}</h2>
                <p>Hi ${emp.firstName},</p>
                <p>Your Work From Home request for <strong>${dateStr}</strong> has been <strong>${approved ? "approved" : "rejected"}</strong>.</p>
                ${!approved && rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ""}
                <p style="color:#666;font-size:14px;">Login to DNMS for details.</p>
              </div>
            `,
            text: `Hi ${emp.firstName}, your WFH request for ${dateStr} has been ${approved ? "approved" : "rejected"}.${!approved && rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
          })
        }
      } catch {
        // Non-blocking
      }
    }

    return ok(serialize({ data: updated }))
  })
}
