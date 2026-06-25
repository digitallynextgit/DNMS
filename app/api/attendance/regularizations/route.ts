import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { notifyApprovers } from "@/lib/notifications"
import type { Session } from "next-auth"

const employeeSelect = {
  select: { id: true, firstName: true, lastName: true, employeeNo: true, profilePhoto: true },
}

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const sp = new URL(req.url).searchParams
      const statusParam = sp.get("status") ?? undefined
      const canApprove = hasPermission(session, PERMISSIONS.ATTENDANCE_WRITE)

      const page = Math.max(1, Number(sp.get("page") ?? "1"))
      const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? "10")))
      const skip = (page - 1) * limit

      const where: Record<string, unknown> = {}
      // Non-approvers only ever see their own requests.
      if (!canApprove) where.employeeId = session.user.id
      else if (sp.get("employeeId")) where.employeeId = sp.get("employeeId")
      if (statusParam) where.status = statusParam

      const [requests, total] = await Promise.all([
        db.attendanceRegularization.findMany({
          where,
          include: { employee: employeeSelect, reviewer: employeeSelect },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        db.attendanceRegularization.count({ where }),
      ])

      return NextResponse.json({
        data: requests,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      console.error("[REGULARIZATIONS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { date, checkIn, checkOut, reason } = await req.json()

      if (!date || !reason || !String(reason).trim()) {
        return NextResponse.json({ error: "Date and reason are required" }, { status: 400 })
      }
      if (!checkIn && !checkOut) {
        return NextResponse.json(
          { error: "Provide at least one corrected time (check-in or check-out)" },
          { status: 400 },
        )
      }

      // Times arrive as "HH:MM"; store as UTC datetimes on the given date.
      const buildTime = (t?: string) =>
        t ? new Date(`${date}T${t.length === 5 ? `${t}:00` : t}.000Z`) : null
      const dateObj = new Date(`${date}T00:00:00.000Z`)
      if (isNaN(dateObj.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 })
      }

      const request = await db.attendanceRegularization.create({
        data: {
          employeeId: session.user.id,
          date: dateObj,
          requestedCheckIn: buildTime(checkIn),
          requestedCheckOut: buildTime(checkOut),
          reason: String(reason).trim(),
          status: "PENDING",
        },
        include: { employee: employeeSelect },
      })

      await notifyApprovers({
        requesterId: session.user.id,
        title: "Attendance regularization request",
        message: `${request.employee.firstName} ${request.employee.lastName} requested an attendance correction for ${dateObj.toDateString()}.`,
        link: "/attendance/regularizations",
      })

      return NextResponse.json({ data: request }, { status: 201 })
    } catch (error) {
      console.error("[REGULARIZATIONS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
