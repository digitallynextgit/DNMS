import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import type { Session } from "next-auth"

// Per-day attendance calendar for the signed-in employee. Combines attendance
// logs + company holidays + approved leaves + WFH + weekends into one status/day.
//   PRESENT        → both punches present (green)
//   HALF_DAY       → present but < a full day (orange)
//   MISSING_PUNCH  → only one punch (forgot to punch in OR out) - purple
//   LEAVE          → approved leave (red)
//   WFH            → approved work-from-home (yellow)
//   HOLIDAY        → company holiday (blue) · WEEKEND → Sat/Sun (grey)
//   UPCOMING/NONE  → future / before-start / a past working day with no record (blank)
// This is an office where everyone attends, so there is no "absent" state.

// A lone punch before this IST hour reads as a forgotten check-OUT (i.e. the punch
// is the morning check-in); at/after it, the punch reads as a forgotten check-IN.
const SINGLE_PUNCH_SPLIT_IST_HOUR = 14

function istHour(d: Date): number {
  return Math.floor(((d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440) / 60)
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const monthParam = req.nextUrl.searchParams.get("month") // "YYYY-MM"
      const now = new Date()
      let year = now.getUTCFullYear()
      let month0 = now.getUTCMonth() // 0-based
      if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
        const [y, m] = monthParam.split("-").map(Number)
        year = y
        month0 = m - 1
      }

      const monthStart = new Date(Date.UTC(year, month0, 1))
      const monthEnd = new Date(Date.UTC(year, month0 + 1, 0)) // last day of month
      const daysInMonth = monthEnd.getUTCDate()
      const todayStr = ymd(new Date())
      const employeeId = session.user.id

      const [logs, fixedHolidays, floatingSelections, leaves, wfh] = await Promise.all([
        db.attendanceLog.findMany({
          where: { employeeId, date: { gte: monthStart, lte: monthEnd } },
          select: { date: true, status: true, checkIn: true, checkOut: true, workHours: true },
        }),
        // Fixed holidays apply to everyone; floating ones only when the employee
        // has availed (and HR approved) them.
        db.holiday.findMany({
          where: { date: { gte: monthStart, lte: monthEnd }, isOptional: false },
          select: { date: true, name: true },
        }),
        db.floatingHolidaySelection.findMany({
          where: {
            employeeId,
            year,
            status: "APPROVED",
            holiday: { date: { gte: monthStart, lte: monthEnd } },
          },
          select: { holiday: { select: { date: true, name: true } } },
        }),
        db.leaveRequest.findMany({
          where: {
            employeeId,
            status: "APPROVED",
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart },
          },
          select: { startDate: true, endDate: true, leaveType: { select: { name: true } } },
        }),
        db.wfhRequest.findMany({
          where: { employeeId, status: "APPROVED", date: { gte: monthStart, lte: monthEnd } },
          select: { date: true },
        }),
      ])

      const logByDay = new Map(logs.map((l) => [ymd(l.date), l]))
      const holidayByDay = new Map(fixedHolidays.map((h) => [ymd(h.date), h.name]))
      for (const sel of floatingSelections) {
        if (sel.holiday) holidayByDay.set(ymd(sel.holiday.date), sel.holiday.name)
      }
      const leaveByDay = new Map<string, string>()
      for (const lv of leaves) {
        const cursor = new Date(lv.startDate)
        const end = new Date(lv.endDate)
        while (cursor <= end) {
          leaveByDay.set(ymd(cursor), lv.leaveType?.name ?? "Leave")
          cursor.setUTCDate(cursor.getUTCDate() + 1)
        }
      }
      const wfhByDay = new Set(wfh.map((w) => ymd(w.date)))

      // The employee's first-ever punch: don't show anything before they started
      // using the machine (e.g. someone who joined in Feb stays blank for Jan).
      const firstPunch = await db.attendanceLog.findFirst({
        where: { employeeId },
        orderBy: { date: "asc" },
        select: { date: true },
      })
      const firstStr = firstPunch ? ymd(firstPunch.date) : null

      // An employee's birthday is a paid day off (their choice to come in or
      // not) - shown as a holiday when they don't punch, so it never reads as a
      // missed working day.
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { dateOfBirth: true },
      })
      const dob = employee?.dateOfBirth
      const birthdayStr = dob
        ? `${year}-${String(dob.getUTCMonth() + 1).padStart(2, "0")}-${String(dob.getUTCDate()).padStart(2, "0")}`
        : null

      const days = []
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(Date.UTC(year, month0, day))
        const ds = ymd(d)
        const dow = d.getUTCDay() // 0=Sun … 6=Sat
        const isWeekend = dow === 0 || dow === 6
        const future = ds > todayStr
        const beforeStart = !firstStr || ds < firstStr
        const log = logByDay.get(ds)
        const hasIn = !!log?.checkIn
        const hasOut = !!log?.checkOut
        const isHalf = log?.status === "HALF_DAY"

        let status:
          | "PRESENT"
          | "HALF_DAY"
          | "MISSING_PUNCH"
          | "WEEKEND"
          | "HOLIDAY"
          | "LEAVE"
          | "WFH"
          | "UPCOMING"
          | "NONE"
        let label: string | null = null
        let checkIn: string | null = null
        let checkOut: string | null = null
        let workHours: number | null = null

        if (hasIn && hasOut) {
          // Both punches → real presence (half-day when short of a full day).
          status = isHalf ? "HALF_DAY" : "PRESENT"
          checkIn = log!.checkIn!.toISOString()
          checkOut = log!.checkOut!.toISOString()
          workHours = log?.workHours ?? null
        } else if (hasIn !== hasOut) {
          // Exactly one punch → forgot to punch in OR out. Infer which side from
          // the time of day and show only the punch we have.
          status = "MISSING_PUNCH"
          const only = (log!.checkIn ?? log!.checkOut)!
          if (istHour(only) < SINGLE_PUNCH_SPLIT_IST_HOUR) {
            checkIn = only.toISOString() // morning punch → forgot the evening check-out
          } else {
            checkOut = only.toISOString() // evening punch → forgot the morning check-in
          }
        } else if (beforeStart) {
          status = "UPCOMING" // before they started punching → blank
        } else if (birthdayStr && ds === birthdayStr) {
          status = "HOLIDAY" // birthday → paid day off
          label = "Birthday 🎂"
        } else if (holidayByDay.has(ds)) {
          status = "HOLIDAY"
          label = holidayByDay.get(ds) ?? null
        } else if (leaveByDay.has(ds)) {
          status = "LEAVE"
          label = leaveByDay.get(ds) ?? null
        } else if (wfhByDay.has(ds)) {
          status = "WFH"
          label = "Work from home"
        } else if (isWeekend) {
          status = "WEEKEND"
        } else if (future) {
          status = "UPCOMING" // future working day → blank
        } else {
          status = "NONE" // past working day with no record (office → not flagged absent)
        }

        days.push({ date: ds, day, dow, status, label, checkIn, checkOut, workHours })
      }

      return NextResponse.json({
        data: { year, month: month0 + 1, firstPunchDate: firstStr, days },
      })
    } catch (error) {
      console.error("[ATTENDANCE_ME_CALENDAR]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
