import "server-only"

import { db } from "@/server/db"
import { VISIBLE_EMPLOYEE_FILTER, EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import { ok, fail, type ActionResult } from "@/server/action-result"

// Per-employee attendance roster for a date range (one row per employee).
// Default range is today. For a single day each row carries that day's punches;
// for a range it carries present / half / absent day counts + average hours.
//
// Extracted from GET /api/attendance/directory so the route handler AND the
// server-side prefetch in app/(dashboard)/attendance/attendance-directory/page.tsx
// run the exact same query - the prefetched React Query cache entry must be
// byte-identical to the API body the client would otherwise have fetched.

type LogRow = {
  employeeId: string
  status: string
  checkIn: Date | null
  checkOut: Date | null
  workHours: number | null
}

export interface AttendanceDirectoryRow {
  employeeId: string
  firstName: string
  lastName: string
  employeeNo: string
  profilePhoto: string | null
  department: string | null
  checkIn: string | null
  checkOut: string | null
  workHours: number | null
  status: "PRESENT" | "HALF_DAY" | "MISSING_PUNCH" | "ABSENT"
  presentDays: number
  halfDays: number
  missingDays: number
  absentDays: number
  avgHours: number
}

export interface AttendanceDirectoryPayload {
  isSingleDay: boolean
  from: string
  to: string
  summary: { totalEmployees: number; present: number; halfDay: number; notPresent: number }
  rows: AttendanceDirectoryRow[]
}

// The caller supplies from/to, so the range is clamped server-side: a wide range
// would pull every attendance log in it (unbounded, no pagination downstream).
const MAX_RANGE_DAYS = 92
const MS_PER_DAY = 86_400_000

/** Today in YYYY-MM-DD, matching the route's previous default. */
export function attendanceDirectoryToday(): string {
  return new Date().toISOString().slice(0, 10)
}

// Did the employee actually attend? present = both punches, half = half day,
// missing = a lone punch / incomplete record.
function classify(l: LogRow): "present" | "half" | "missing" {
  if (l.status === "HALF_DAY") return "half"
  if (l.checkIn && l.checkOut) return "present"
  return "missing"
}

export async function getAttendanceDirectory(
  fromParam?: string | null,
  toParam?: string | null,
): Promise<ActionResult<AttendanceDirectoryPayload>> {
  const today = attendanceDirectoryToday()
  const from = fromParam || today
  const to = toParam || from
  const isSingleDay = from === to

  const start = new Date(`${from}T00:00:00.000Z`)
  const end = new Date(`${to}T23:59:59.999Z`)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return fail("Invalid date range", undefined, 400)
  }

  const rangeDays = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1
  if (rangeDays > MAX_RANGE_DAYS) {
    return fail(`Date range too large - maximum ${MAX_RANGE_DAYS} days`, undefined, 400)
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

  return ok({
    isSingleDay,
    from,
    to,
    summary: { totalEmployees: employees.length, present, halfDay, notPresent },
    rows,
  })
}
