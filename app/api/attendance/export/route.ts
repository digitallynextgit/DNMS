import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { toCsv } from "@/lib/export-csv"
import type { Session } from "next-auth"

const isoDate = (d: Date) => new Date(d).toISOString().slice(0, 10)
const isoTime = (d: Date | null) => (d ? new Date(d).toISOString().slice(11, 16) : "")

/**
 * GET /api/attendance/export?dateFrom=&dateTo=&status=&employeeId=
 * Streams the matching attendance logs as a CSV download (monthly report).
 */
export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const sp = new URL(req.url).searchParams
      const employeeId = sp.get("employeeId") ?? undefined
      const status = sp.get("status") ?? undefined
      const dateFrom = sp.get("dateFrom") ?? undefined
      const dateTo = sp.get("dateTo") ?? undefined

      const where: Record<string, unknown> = {}
      if (employeeId) where.employeeId = employeeId
      if (status) where.status = status
      if (dateFrom || dateTo) {
        const range: Record<string, Date> = {}
        if (dateFrom) range.gte = new Date(dateFrom)
        if (dateTo) range.lte = new Date(dateTo)
        where.date = range
      }

      const logs = await db.attendanceLog.findMany({
        where,
        include: {
          employee: {
            select: {
              employeeNo: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ date: "asc" }, { employee: { employeeNo: "asc" } }],
      })

      const header = [
        "Employee No",
        "Name",
        "Department",
        "Date",
        "Check In",
        "Check Out",
        "Work Hours",
        "Status",
        "Source",
      ]
      const rows = logs.map((l) => [
        l.employee.employeeNo,
        `${l.employee.firstName} ${l.employee.lastName}`.trim(),
        l.employee.department?.name ?? "",
        isoDate(l.date),
        isoTime(l.checkIn),
        isoTime(l.checkOut),
        l.workHours ?? "",
        l.status,
        l.source ?? (l.isManual ? "Manual" : ""),
      ])

      const csv = toCsv(rows, header)
      const filename = `attendance_${dateFrom ?? "all"}_to_${dateTo ?? "all"}.csv`

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    } catch (error) {
      console.error("[ATTENDANCE_EXPORT]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
