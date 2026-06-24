import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { fetchAttendanceEvents } from "@/features/attendance/server/hikvision"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params

      const device = await db.hikvisionDevice.findUnique({ where: { id } })
      if (!device) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 })
      }

      const days = parseInt(req.nextUrl.searchParams.get("days") ?? "7")
      const major = parseInt(req.nextUrl.searchParams.get("major") ?? "0")

      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { events, error } = await fetchAttendanceEvents(
        {
          ipAddress: device.ipAddress,
          port: device.port,
          username: device.username,
          password: device.password,
        },
        startDate,
        endDate,
        major,
      )

      const employees = await db.employee.findMany({
        where: { isActive: true },
        select: { id: true, employeeNo: true, firstName: true, lastName: true },
      })
      const employeeByNo = new Map(employees.map((e) => [e.employeeNo, e]))

      const enriched = events.map((ev) => ({
        employeeNo: ev.employeeNo,
        timestamp: ev.timestamp,
        direction: ev.direction,
        matchedEmployee: employeeByNo.get(ev.employeeNo)
          ? {
              id: employeeByNo.get(ev.employeeNo)!.id,
              name: `${employeeByNo.get(ev.employeeNo)!.firstName} ${employeeByNo.get(ev.employeeNo)!.lastName}`,
            }
          : null,
      }))

      const unmatchedNos = [
        ...new Set(enriched.filter((e) => !e.matchedEmployee).map((e) => e.employeeNo)),
      ]

      return NextResponse.json({
        totalEvents: events.length,
        majorFilter: major,
        dateRange: { from: startDate, to: endDate },
        unmatchedEmployeeNos: unmatchedNos,
        matchedCount: enriched.filter((e) => e.matchedEmployee).length,
        events: enriched,
        deviceError: error ?? null,
      })
    } catch (error) {
      console.error("[DEVICE_EVENTS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
