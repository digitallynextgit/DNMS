import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// Per-day attendance calendar for a SPECIFIC employee (HR view, opened from the
// attendance directory). Same day-status logic as /api/attendance/me/calendar,
// but keyed by the employeeId in the path and gated by attendance:write.

const SINGLE_PUNCH_SPLIT_IST_HOUR = 14

function istHour(d: Date): number {
  return Math.floor(((d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440) / 60)
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const employeeId = ctx.params.employeeId
      const monthParam = req.nextUrl.searchParams.get("month") // "YYYY-MM"
      const now = new Date()
      let year = now.getUTCFullYear()
      let month0 = now.getUTCMonth()
      if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
        const [y, m] = monthParam.split("-").map(Number)
        year = y
        month0 = m - 1
      }

      const monthStart = new Date(Date.UTC(year, month0, 1))
      const monthEnd = new Date(Date.UTC(year, month0 + 1, 0))
      const daysInMonth = monthEnd.getUTCDate()
      const todayStr = ymd(new Date())

      const [logs, fixedHolidays, floatingSelections, leaves, wfh] = await Promise.all([
        db.attendanceLog.findMany({
          where: { employeeId, date: { gte: monthStart, lte: monthEnd } },
          select: { date: true, status: true, checkIn: true, checkOut: true, workHours: true },
        }),
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
        const dow = d.getUTCDay()
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
          status = isHalf ? "HALF_DAY" : "PRESENT"
          checkIn = log!.checkIn!.toISOString()
          checkOut = log!.checkOut!.toISOString()
          workHours = log?.workHours ?? null
        } else if (hasIn !== hasOut) {
          status = "MISSING_PUNCH"
          const only = (log!.checkIn ?? log!.checkOut)!
          if (istHour(only) < SINGLE_PUNCH_SPLIT_IST_HOUR) {
            checkIn = only.toISOString()
          } else {
            checkOut = only.toISOString()
          }
        } else if (beforeStart) {
          status = "UPCOMING"
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
          status = "UPCOMING"
        } else {
          status = "NONE"
        }

        days.push({ date: ds, day, dow, status, label, checkIn, checkOut, workHours })
      }

      return NextResponse.json({
        data: { year, month: month0 + 1, firstPunchDate: firstStr, days },
      })
    } catch (error) {
      console.error("[ATTENDANCE_EMP_CALENDAR]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
