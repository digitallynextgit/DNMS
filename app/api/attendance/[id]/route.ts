import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth, withSession } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { computeAttendanceStatus } from "@/features/attendance/attendance"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { Session } from "next-auth"

export const GET = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params

      const log = await db.attendanceLog.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              ...EMPLOYEE_SUMMARY_SELECT,
              department: { select: { id: true, name: true } },
            },
          },
        },
      })

      if (!log) {
        return NextResponse.json({ error: "Attendance log not found" }, { status: 404 })
      }

      return NextResponse.json({ data: log })
    } catch (error) {
      console.error("[ATTENDANCE_ID_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const PATCH = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params
      const body = await req.json()

      const existing = await db.attendanceLog.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Attendance log not found" }, { status: 404 })
      }

      const updateData: Record<string, unknown> = {}

      if (body.checkIn !== undefined) {
        updateData.checkIn = body.checkIn ? new Date(body.checkIn) : null
      }
      if (body.checkOut !== undefined) {
        updateData.checkOut = body.checkOut ? new Date(body.checkOut) : null
      }
      if (body.status !== undefined) updateData.status = body.status
      if (body.notes !== undefined) updateData.notes = body.notes ?? null

      // Recalculate work hours
      const resolvedCheckIn =
        body.checkIn !== undefined
          ? body.checkIn
            ? new Date(body.checkIn)
            : null
          : existing.checkIn
      const resolvedCheckOut =
        body.checkOut !== undefined
          ? body.checkOut
            ? new Date(body.checkOut)
            : null
          : existing.checkOut

      let resolvedWorkHours: number | null = null
      if (resolvedCheckIn && resolvedCheckOut) {
        const diff = resolvedCheckOut.getTime() - resolvedCheckIn.getTime()
        if (diff > 0) {
          resolvedWorkHours = Math.round((diff / (1000 * 60 * 60)) * 100) / 100
        }
      }
      updateData.workHours = resolvedWorkHours

      // When the times changed but no explicit status was sent, re-derive the
      // status from hours worked (half-day / absent). Late-mark not applied yet.
      if (
        body.status === undefined &&
        (body.checkIn !== undefined || body.checkOut !== undefined)
      ) {
        updateData.status = computeAttendanceStatus({
          checkIn: resolvedCheckIn,
          workHours: resolvedWorkHours,
        })
      }

      const updated = await db.attendanceLog.update({
        where: { id },
        data: updateData,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNo: true,
            },
          },
        },
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[ATTENDANCE_ID_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params

      const existing = await db.attendanceLog.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Attendance log not found" }, { status: 404 })
      }

      if (!existing.isManual) {
        return NextResponse.json(
          { error: "Only manually created attendance logs can be deleted" },
          { status: 400 },
        )
      }

      await db.attendanceLog.delete({ where: { id } })

      return NextResponse.json({ message: "Attendance log deleted successfully" })
    } catch (error) {
      console.error("[ATTENDANCE_ID_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
