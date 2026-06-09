import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { searchParams } = new URL(req.url)

      const employeeId = searchParams.get("employeeId")
      const month = Number(searchParams.get("month"))
      const year = Number(searchParams.get("year"))

      if (!employeeId) {
        return NextResponse.json({ error: "employeeId is required" }, { status: 400 })
      }
      if (!month || month < 1 || month > 12) {
        return NextResponse.json({ error: "month must be between 1 and 12" }, { status: 400 })
      }
      if (!year || year < 2000 || year > 2100) {
        return NextResponse.json({ error: "year is invalid" }, { status: 400 })
      }

      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, firstName: true, lastName: true, employeeNo: true },
      })
      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 })
      }

      // Build date range for the month (UTC)
      const dateFrom = new Date(Date.UTC(year, month - 1, 1))
      const dateTo = new Date(Date.UTC(year, month, 0)) // last day of month

      const logs = await db.attendanceLog.findMany({
        where: {
          employeeId,
          date: { gte: dateFrom, lte: dateTo },
        },
        select: {
          status: true,
          workHours: true,
        },
      })

      const presentDays = logs.filter((l) => l.status === "PRESENT").length
      const absentDays = logs.filter((l) => l.status === "ABSENT").length
      const lateDays = logs.filter((l) => l.status === "LATE").length
      const halfDays = logs.filter((l) => l.status === "HALF_DAY").length
      const onLeaveDays = logs.filter((l) => l.status === "ON_LEAVE").length
      const holidayDays = logs.filter((l) => l.status === "HOLIDAY").length
      const weekendDays = logs.filter((l) => l.status === "WEEKEND").length

      const workingLogs = logs.filter(
        (l) => l.workHours !== null && l.workHours !== undefined && l.workHours > 0,
      )
      const totalWorkHours = workingLogs.reduce((sum, l) => sum + (l.workHours ?? 0), 0)
      const avgHoursPerDay =
        workingLogs.length > 0 ? Math.round((totalWorkHours / workingLogs.length) * 100) / 100 : 0

      return NextResponse.json({
        data: {
          employee,
          month,
          year,
          presentDays,
          absentDays,
          lateDays,
          halfDays,
          onLeaveDays,
          holidayDays,
          weekendDays,
          totalWorkHours: Math.round(totalWorkHours * 100) / 100,
          avgHoursPerDay,
          totalRecords: logs.length,
        },
      })
    } catch (error) {
      console.error("[ATTENDANCE_SUMMARY_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
