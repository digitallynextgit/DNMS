import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { computeAttendanceStatus } from "@/lib/attendance"
import type { Session } from "next-auth"

// Overview (all employees) is HR/admin-only. Employees use /attendance/me instead.
export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { searchParams } = new URL(req.url)

      const employeeId = searchParams.get("employeeId") ?? undefined
      const status = searchParams.get("status") ?? undefined
      const dateFrom = searchParams.get("dateFrom") ?? undefined
      const dateTo = searchParams.get("dateTo") ?? undefined
      const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
      const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")))
      const skip = (page - 1) * limit

      const where: Record<string, unknown> = {}

      if (employeeId) where.employeeId = employeeId
      if (status) where.status = status

      if (dateFrom || dateTo) {
        where.date = {}
        if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom)
        if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo)
      }

      const [logs, total] = await Promise.all([
        db.attendanceLog.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNo: true,
                profilePhoto: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          skip,
          take: limit,
        }),
        db.attendanceLog.count({ where }),
      ])

      return NextResponse.json({
        data: logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      console.error("[ATTENDANCE_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const { employeeId, date, checkIn, checkOut, status, notes } = body

      if (!employeeId || !date) {
        return NextResponse.json({ error: "employeeId and date are required" }, { status: 400 })
      }

      const employee = await db.employee.findUnique({ where: { id: employeeId } })
      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 })
      }

      const dateObj = new Date(date)
      dateObj.setUTCHours(0, 0, 0, 0)

      let workHours: number | null = null
      if (checkIn && checkOut) {
        const checkInMs = new Date(checkIn).getTime()
        const checkOutMs = new Date(checkOut).getTime()
        if (checkOutMs > checkInMs) {
          workHours = Math.round(((checkOutMs - checkInMs) / (1000 * 60 * 60)) * 100) / 100
        }
      }

      // If the caller doesn't pass an explicit status, derive it from hours worked
      // (half-day / absent rules). Late-mark detection is not applied yet.
      const resolvedStatus =
        status ??
        computeAttendanceStatus({ checkIn: checkIn ? new Date(checkIn) : null, workHours })

      const log = await db.attendanceLog.upsert({
        where: {
          employeeId_date: {
            employeeId,
            date: dateObj,
          },
        },
        create: {
          employeeId,
          date: dateObj,
          checkIn: checkIn ? new Date(checkIn) : null,
          checkOut: checkOut ? new Date(checkOut) : null,
          workHours,
          status: resolvedStatus,
          isManual: true,
          notes: notes ?? null,
        },
        update: {
          checkIn: checkIn ? new Date(checkIn) : null,
          checkOut: checkOut ? new Date(checkOut) : null,
          workHours,
          status: resolvedStatus,
          isManual: true,
          notes: notes ?? null,
        },
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

      return NextResponse.json({ data: log }, { status: 201 })
    } catch (error) {
      console.error("[ATTENDANCE_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
