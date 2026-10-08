import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { FLOATING_HOLIDAY_LIMIT, SYSTEM_ROLES } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { actorStampId } from "@/lib/audit"
import type { Session } from "next-auth"

// Their approval is final; a manager's approval is only the first step.
const HR_ROLES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: { id: string } }, session: Session) => {
    try {
      const { id } = ctx.params
      const { action, rejectionReason } = (await req.json()) as {
        action: "APPROVE" | "REJECT"
        rejectionReason?: string
      }
      if (!action || !["APPROVE", "REJECT"].includes(action)) {
        return NextResponse.json({ error: "Action must be APPROVE or REJECT" }, { status: 400 })
      }

      const reqRow = await db.floatingHolidaySelection.findUnique({
        where: { id },
        include: {
          holiday: { select: { name: true, date: true } },
          employee: { select: { managerId: true } },
        },
      })
      if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 })
      if (reqRow.status !== "PENDING") {
        return NextResponse.json(
          { error: `Request is already ${reqRow.status.toLowerCase()}` },
          { status: 409 },
        )
      }

      const isHr = (session.user.roles ?? []).some((r) => HR_ROLES.includes(r))
      const isManager = reqRow.employee.managerId === session.user.id
      if (!isHr && !isManager) {
        return NextResponse.json(
          { error: "You can only act on your own team's floating-holiday requests." },
          { status: 403 },
        )
      }
      // Nobody reviews their own request, even as HR or as their own manager.
      if (reqRow.employeeId === session.user.id) {
        return NextResponse.json(
          { error: "You cannot review your own floating-holiday request." },
          { status: 403 },
        )
      }
      if (action === "REJECT" && !rejectionReason?.trim()) {
        return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
      }
      const approverId = actorStampId(session)
      const reason = rejectionReason?.trim()

      // Pending requests don't use the allowance, so the limit is enforced when HR approves.
      if (isHr && action === "APPROVE") {
        const approvedCount = await db.floatingHolidaySelection.count({
          where: { employeeId: reqRow.employeeId, year: reqRow.year, status: "APPROVED" },
        })
        if (approvedCount >= FLOATING_HOLIDAY_LIMIT) {
          return NextResponse.json(
            {
              error: `This employee already has ${FLOATING_HOLIDAY_LIMIT} approved floating holidays for ${reqRow.year}.`,
            },
            { status: 422 },
          )
        }
      }

      let updated
      if (isHr) {
        // HR's call is final, even over a manager rejection.
        updated = await db.floatingHolidaySelection.update({
          where: { id },
          data:
            action === "APPROVE"
              ? {
                  status: "APPROVED",
                  hrApproverId: approverId,
                  hrApprovedAt: new Date(),
                  reviewedAt: new Date(),
                }
              : {
                  status: "REJECTED",
                  rejectionReason: reason,
                  hrApproverId: approverId,
                  reviewedAt: new Date(),
                },
        })
      } else {
        // Manager review is recorded but stays PENDING for HR's final call.
        updated = await db.floatingHolidaySelection.update({
          where: { id },
          data:
            action === "APPROVE"
              ? {
                  managerDecision: "APPROVED",
                  managerApproverId: approverId,
                  managerApprovedAt: new Date(),
                }
              : {
                  managerDecision: "REJECTED",
                  managerApproverId: approverId,
                  rejectionReason: reason,
                },
        })
      }

      const holidayLabel = `${reqRow.holiday.name} (${new Date(reqRow.holiday.date).toDateString()})`
      if (updated.status === "APPROVED") {
        await createNotification({
          employeeId: reqRow.employeeId,
          title: "Floating holiday approved",
          message: `Your floating holiday - ${holidayLabel} - has been approved.`,
          type: "success",
          link: "/calendar?view=holidays",
        })
      } else if (updated.status === "REJECTED") {
        await createNotification({
          employeeId: reqRow.employeeId,
          title: "Floating holiday rejected",
          message: `Your floating holiday request - ${holidayLabel} - was rejected.${reason ? ` Reason: ${reason}` : ""}`,
          type: "error",
          link: "/calendar?view=holidays",
        })
      } else {
        const approved = updated.managerDecision === "APPROVED"
        await createNotification({
          employeeId: reqRow.employeeId,
          title: approved
            ? "Floating holiday - manager approved"
            : "Floating holiday - manager declined",
          message: approved
            ? `Your floating holiday - ${holidayLabel} - was approved by your manager and is awaiting HR's final call.`
            : `Your manager declined your floating holiday - ${holidayLabel} - it's awaiting HR's final call.`,
          type: "info",
          link: "/calendar?view=holidays",
        })
      }

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[FLOATING_HOLIDAY_REQUEST_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
