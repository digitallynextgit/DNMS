import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { VISIBLE_EMPLOYEE_FILTER, EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { Session } from "next-auth"

// Per-employee attendance roster for a date range (one row per employee).
// Default range is today. For a single day each row carries that day's punches;
// for a range it carries present / half / absent day counts + average hours.

type LogRow = {
  employeeId: string
  status: string
  checkIn: Date | null
  checkOut: Date | null
  workHours: number | null
}

// Did the employee actually attend? present = both punches, half = half day,
// missing = a lone punch / incomplete record.
function classify(l: LogRow): "present" | "half" | "missing" {
  if (l.status === "HALF_DAY") return "half"
  if (l.checkIn && l.checkOut) return "present"
  return "missing"
}

export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const sp = req.nextUrl.searchParams
      const today = new Date().toISOString().slice(0, 10)
      const from = sp.get("from") || today
      const to = sp.get("to") || from
      const isSingleDay = from === to

      const start = new Date(`${from}T00:00:00.000Z`)
      const end = new Date(`${to}T23:59:59.999Z`)
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
      }

      const [employees, logs] = await Promise.all([
        db.employee.findMany({
          where: { isActive: true, status: "ACTIVE", ...VISIBLE_EMPLOYEE_FILTER },
          select: { ...EMPLOYEE_SUMMARY_SELECT, department: { select: { name: true } } },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        }),
        db.attendanceLog.findMany({
          where: { date: { gte: start, lte: end } },
          select: {
            employeeId: true,
            status: true,
            checkIn: true,
            checkOut: true,
            workHours: true,
          },
        }),
      ])

      // Mon-Fri count in the range, used for the per-employee "absent" day count.
      let workingDays = 0
      for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dow = d.getUTCDay()
        if (dow !== 0 && dow !== 6) workingDays++
      }

      const logsByEmp = new Map<string, LogRow[]>()
      for (const l of logs) {
        const arr = logsByEmp.get(l.employeeId)
        if (arr) arr.push(l)
        else logsByEmp.set(l.employeeId, [l])
      }

      let present = 0
      let halfDay = 0
      let notPresent = 0

      const rows = employees.map((e) => {
        const empLogs = logsByEmp.get(e.id) ?? []
        let presentDays = 0
        let halfDays = 0
        let missingDays = 0
        let totalHours = 0
        let hoursDays = 0
        for (const l of empLogs) {
          const c = classify(l)
          if (c === "present") presentDays++
          else if (c === "half") halfDays++
          else missingDays++
          if (l.workHours != null) {
            totalHours += l.workHours
            hoursDays++
          }
        }
        const avgHours = hoursDays > 0 ? Math.round((totalHours / hoursDays) * 100) / 100 : 0
        const absentDays = Math.max(0, workingDays - (presentDays + halfDays + missingDays))

        // Single-day snapshot for the roster columns.
        let checkIn: string | null = null
        let checkOut: string | null = null
        let workHours: number | null = null
        let status: "PRESENT" | "HALF_DAY" | "MISSING_PUNCH" | "ABSENT" = "ABSENT"
        if (isSingleDay && empLogs[0]) {
          const l = empLogs[0]
          checkIn = l.checkIn ? l.checkIn.toISOString() : null
          checkOut = l.checkOut ? l.checkOut.toISOString() : null
          workHours = l.workHours
          const c = classify(l)
          status = c === "present" ? "PRESENT" : c === "half" ? "HALF_DAY" : "MISSING_PUNCH"
        }

        // Summary tally.
        const came = isSingleDay
          ? status === "PRESENT" || status === "MISSING_PUNCH"
          : presentDays > 0 || missingDays > 0
        const onHalf = isSingleDay ? status === "HALF_DAY" : halfDays > 0
        if (came) present++
        else if (onHalf) halfDay++
        else notPresent++

        return {
          employeeId: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          employeeNo: e.employeeNo,
          profilePhoto: e.profilePhoto,
          department: e.department?.name ?? null,
          checkIn,
          checkOut,
          workHours,
          status,
          presentDays,
          halfDays,
          missingDays,
          absentDays,
          avgHours,
        }
      })

      return NextResponse.json({
        data: {
          isSingleDay,
          from,
          to,
          summary: { totalEmployees: employees.length, present, halfDay, notPresent },
          rows,
        },
      })
    } catch (error) {
      console.error("[ATTENDANCE_DIRECTORY]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
