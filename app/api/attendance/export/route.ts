import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { toCsv } from "@/lib/export-csv"
import type { Session } from "next-auth"

const isoDate = (d: Date) => new Date(d).toISOString().slice(0, 10)
const isoTime = (d: Date | null) => (d ? new Date(d).toISOString().slice(11, 16) : "")

// Every filter here is optional, so a bare call used to mean `where: {}` - i.e.
// every attendance log ever recorded, joined per row, materialised in Node and
// string-concatenated into one response. Against the 10-connection pool that is
// an app-wide stall triggerable by a single GET.
//
// A bounded range is now mandatory. The cap is wider than the directory view's
// 92 days (attendance-directory.queries.ts) because a yearly export is a
// legitimate use of THIS endpoint, where it is not of that one.
const MAX_RANGE_DAYS = 366
const MS_PER_DAY = 86_400_000

/**
 * GET /api/attendance/export?dateFrom=&dateTo=&status=&employeeId=
 * Streams the matching attendance logs as a CSV download (monthly report).
 * `dateFrom` and `dateTo` are REQUIRED and span at most a year.
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

      if (!dateFrom || !dateTo) {
        return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 })
      }

      const start = new Date(`${dateFrom}T00:00:00.000Z`)
      const end = new Date(`${dateTo}T23:59:59.999Z`)
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
      }

      const rangeDays = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1
      if (rangeDays > MAX_RANGE_DAYS) {
        return NextResponse.json(
          { error: `Date range too large - maximum ${MAX_RANGE_DAYS} days` },
          { status: 400 },
        )
      }

      const where: Record<string, unknown> = { date: { gte: start, lte: end } }
      if (employeeId) where.employeeId = employeeId
      if (status) where.status = status

      const logs = await db.attendanceLog.findMany({
        where,
        // `select`, not `include`: the CSV needs 9 scalar columns, and `include`
        // shipped every column of every log row to build them.
        select: {
          date: true,
          checkIn: true,
          checkOut: true,
          workHours: true,
          status: true,
          source: true,
          isManual: true,
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
      const filename = `attendance_${dateFrom}_to_${dateTo}.csv`

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
