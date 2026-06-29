import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import type { Session } from "next-auth"

// Per-day attendance calendar for the signed-in employee. Combines attendance
// logs + company holidays + approved leaves + weekends into one status per day.
//   PRESENT / HALF_DAY  → from the attendance log (with check-in/out)
//   HOLIDAY / LEAVE     → company holiday or approved leave (yellow)
//   WEEKEND             → Sat/Sun (grey)
//   ABSENT             → a past working day with no presence (red)
//   UPCOMING           → today onward with no record yet (blank)

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

      const [logs, fixedHolidays, floatingSelections, leaves] = await Promise.all([
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

      // The employee's first-ever punch: don't show anything before they started
      // using the machine (e.g. someone who joined in Feb stays blank for Jan).
      const firstPunch = await db.attendanceLog.findFirst({
        where: { employeeId },
        orderBy: { date: "asc" },
        select: { date: true },
      })
      const firstStr = firstPunch ? ymd(firstPunch.date) : null

      const days = []
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(Date.UTC(year, month0, day))
        const ds = ymd(d)
        const dow = d.getUTCDay() // 0=Sun … 6=Sat
        const isWeekend = dow === 0 || dow === 6
        const future = ds > todayStr
        const beforeStart = !firstStr || ds < firstStr
        const log = logByDay.get(ds)
        const cameIn = !!log?.checkIn && (log.status === "PRESENT" || log.status === "LATE")
        const isHalf = log?.status === "HALF_DAY"

        let status: "PRESENT" | "HALF_DAY" | "ABSENT" | "WEEKEND" | "HOLIDAY" | "LEAVE" | "UPCOMING"
        let label: string | null = null
        let checkIn: string | null = null
        let checkOut: string | null = null
        let workHours: number | null = null

        if (cameIn || isHalf) {
          // Actual presence is ground truth.
          status = isHalf ? "HALF_DAY" : "PRESENT"
          checkIn = log?.checkIn ? log.checkIn.toISOString() : null
          checkOut = log?.checkOut ? log.checkOut.toISOString() : null
          workHours = log?.workHours ?? null
        } else if (beforeStart || future) {
          // Before the employee started punching, or a future date → blank.
          status = "UPCOMING"
        } else if (holidayByDay.has(ds)) {
          status = "HOLIDAY"
          label = holidayByDay.get(ds) ?? null
        } else if (leaveByDay.has(ds)) {
          status = "LEAVE"
          label = leaveByDay.get(ds) ?? null
        } else if (isWeekend) {
          status = "WEEKEND"
        } else {
          status = "ABSENT"
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
