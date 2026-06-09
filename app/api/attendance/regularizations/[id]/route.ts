import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession, hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { computeAttendanceStatus } from "@/lib/attendance"
import { createNotification } from "@/lib/notifications"
import { actorStampId } from "@/lib/audit"
import type { Session } from "next-auth"

export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      const { action, reviewNote } = await req.json()

      if (!action || !["CANCEL", "APPROVE", "REJECT"].includes(action)) {
        return NextResponse.json(
          { error: "Action must be one of: CANCEL, APPROVE, REJECT" },
          { status: 400 },
        )
      }

      const reg = await db.attendanceRegularization.findUnique({ where: { id } })
      if (!reg) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 })
      }
      if (reg.status !== "PENDING") {
        return NextResponse.json(
          { error: `Request is already ${reg.status.toLowerCase()}` },
          { status: 409 },
        )
      }

      // ── CANCEL: only the requester ──
      if (action === "CANCEL") {
        if (reg.employeeId !== session.user.id) {
          return NextResponse.json(
            { error: "You can only cancel your own requests" },
            { status: 403 },
          )
        }
        const updated = await db.attendanceRegularization.update({
          where: { id },
          data: { status: "CANCELLED" },
        })
        return NextResponse.json({ data: updated })
      }

      // ── APPROVE / REJECT: requires attendance:write ──
      if (!hasPermission(session, PERMISSIONS.ATTENDANCE_WRITE)) {
        return NextResponse.json(
          { error: "Forbidden: requires attendance:write permission" },
          { status: 403 },
        )
      }

      if (action === "APPROVE") {
        // Apply the corrected punches to the attendance log for that day.
        let workHours: number | null = null
        if (
          reg.requestedCheckIn &&
          reg.requestedCheckOut &&
          reg.requestedCheckOut.getTime() > reg.requestedCheckIn.getTime()
        ) {
          workHours =
            Math.round(
              ((reg.requestedCheckOut.getTime() - reg.requestedCheckIn.getTime()) /
                (1000 * 60 * 60)) *
                100,
            ) / 100
        }
        const status = computeAttendanceStatus({ checkIn: reg.requestedCheckIn, workHours })

        await db.attendanceLog.upsert({
          where: { employeeId_date: { employeeId: reg.employeeId, date: reg.date } },
          create: {
            employeeId: reg.employeeId,
            date: reg.date,
            checkIn: reg.requestedCheckIn,
            checkOut: reg.requestedCheckOut,
            workHours,
            status,
            isManual: true,
            source: "REGULARIZATION",
            notes: `Regularized: ${reg.reason}`,
          },
          update: {
            checkIn: reg.requestedCheckIn,
            checkOut: reg.requestedCheckOut,
            workHours,
            status,
            isManual: true,
            source: "REGULARIZATION",
            notes: `Regularized: ${reg.reason}`,
          },
        })
      }

      const updated = await db.attendanceRegularization.update({
        where: { id },
        data: {
          status: action === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewerId: actorStampId(session),
          reviewedAt: new Date(),
          reviewNote: reviewNote ? String(reviewNote).trim() : null,
        },
      })

      // Notify the employee of the decision.
      const approved = action === "APPROVE"
      await createNotification({
        employeeId: reg.employeeId,
        title: approved ? "Regularization approved" : "Regularization rejected",
        message: approved
          ? `Your attendance correction for ${reg.date.toDateString()} was approved and applied.`
          : `Your attendance correction for ${reg.date.toDateString()} was rejected.${reviewNote ? ` Reason: ${reviewNote}` : ""}`,
        type: approved ? "success" : "error",
        link: "/attendance/regularizations",
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[REGULARIZATION_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
