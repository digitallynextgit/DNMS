// =============================================================================
// Attendance: device punches for everyone from the start of the month two
// months back up to today.
//
// Mirrors how the app stores and reads them (features/attendance):
//   - only days somebody actually punched have a row; weekends, holidays,
//     leave, WFH, floating holidays and absences are DERIVED by the calendar,
//     so no row is written for them (ctx.away says which days those are)
//   - date = the IST day as a UTC midnight; checkIn/checkOut are real instants
//   - workHours = decimal hours; status PRESENT (8h+), HALF_DAY (4-8h); LATE is
//     stored for a few late arrivals (the employee dashboard counts it)
//   - source "device" + notes "Synced from device", like the device sync
//   - today: punched in if the time has passed, punched out only after 18:30
// =============================================================================

import { DEMO_FORMER_PEOPLE, DEMO_PEOPLE } from "@/features/help/demo/dataset"
import {
  addDays,
  at,
  awayOn,
  dayKey,
  firstOfMonth,
  idOf,
  make,
  makeMany,
  shiftWorkingDays,
  workingDays,
  type DemoContext,
} from "./context"
import { priyaAnchors } from "./timeoff"

const MODULE = "Attendance"

/** "HH:MM" from minutes after midnight. */
const hhmm = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`

export async function seedAttendance(ctx: DemoContext): Promise<void> {
  const { db } = await import("@/server/db")
  const r = ctx.rand

  await make(ctx, "attendancePolicy", {
    name: "Standard Policy",
    workHoursPerDay: 8,
    workDaysPerWeek: 5,
    checkInTime: "09:30",
    checkOutTime: "18:30",
    lateGraceMins: 15,
    isDefault: true,
  })

  const from = firstOfMonth(ctx.today, -2)
  const days = workingDays(ctx, from, ctx.today)
  const nowIstMins = Math.floor(((ctx.now.getTime() + 330 * 60_000) % 86_400_000) / 60_000)

  // A couple of forgotten punch-outs and one HR correction, by working-days-ago.
  // Priya's previous-month half day and missing punch are fixed (guide shots).
  const priya = priyaAnchors(ctx)
  const forcedHalfDay = new Map([["priya", dayKey(priya.halfDay)]])
  const missingPunch = new Map([
    ["priya", dayKey(priya.missingPunch)],
    ["karthik", dayKey(shiftWorkingDays(ctx, ctx.today, -7))],
  ])
  const corrected = new Map([["vikram", dayKey(shiftWorkingDays(ctx, ctx.today, -9))]])

  const rows: Record<string, unknown>[] = []
  const counts: Record<string, number> = {}
  for (const p of [...DEMO_PEOPLE, ...DEMO_FORMER_PEOPLE]) {
    const left = ctx.ref[`left:${p.key}`] // a leaver punches up to their last day
    const emp = await db.employee.findUnique({
      where: { id: idOf(ctx, p.key) },
      select: { dateOfJoining: true, dateOfBirth: true },
    })
    const joined = emp?.dateOfJoining ?? from
    const bday = emp?.dateOfBirth ? dayKey(emp.dateOfBirth).slice(5) : null
    const statuses = (ctx.attendance[p.key] ??= new Map())

    for (const day of days) {
      if (day < joined) continue
      if (left && dayKey(day) > left) continue
      if (awayOn(ctx, p.key, day)) continue
      // The calendar treats a birthday as a day off.
      if (bday && dayKey(day).slice(5) === bday) continue

      let inMins: number
      let outMins: number
      let status = "PRESENT"
      const roll = r()
      const forcedHalf = forcedHalfDay.get(p.key) === dayKey(day)
      const forcedMissing = missingPunch.get(p.key) === dayKey(day)
      if (p.key === "aarav") {
        inMins = r.int(590, 640)
        outMins = inMins + r.int(510, 600)
      } else if (
        forcedHalf ||
        (roll >= 0.07 && roll < 0.105 && p.key !== "priya" && !forcedMissing)
      ) {
        inMins = r.int(570, 590)
        outMins = inMins + r.int(250, 290) // ~4.5h
        status = "HALF_DAY"
      } else if (roll < 0.07 && !forcedMissing) {
        inMins = r.int(612, 648) // 10:12 - 10:48
        outMins = inMins + r.int(512, 560)
        status = "LATE"
      } else {
        inMins = r.int(542, 598) // 09:02 - 09:58
        outMins = inMins + r.int(505, 575)
      }

      const isToday = day.getTime() === ctx.today.getTime()
      if (isToday && nowIstMins < inMins) continue // not in yet
      let checkOut: Date | null = at(day, hhmm(outMins))
      if (isToday && nowIstMins < outMins) checkOut = null // still in the office
      if (missingPunch.get(p.key) === dayKey(day)) checkOut = null

      const checkIn = at(day, hhmm(inMins))
      const workHours = checkOut
        ? Math.round(((checkOut.getTime() - checkIn.getTime()) / 3.6e6) * 100) / 100
        : null
      if (!checkOut) status = status === "HALF_DAY" ? "PRESENT" : status

      const fixed = corrected.get(p.key) === dayKey(day)
      rows.push({
        employeeId: idOf(ctx, p.key),
        date: day,
        checkIn,
        checkOut,
        workHours,
        status,
        isManual: fixed,
        checkInManual: fixed,
        source: fixed ? "manual" : "device",
        notes: fixed
          ? "Check-in corrected by HR - the device was offline that morning."
          : "Synced from device",
        createdAt: checkIn,
        updatedAt: checkOut ?? checkIn,
      })
      statuses.set(dayKey(day), status)
      counts[status] = (counts[status] ?? 0) + 1
    }
  }

  await makeMany(ctx, "attendanceLog", rows)
  ctx.summary.add(MODULE, `punch rows since ${dayKey(from)}`, rows.length)
  for (const [s, n] of Object.entries(counts)) ctx.summary.add(MODULE, `  ${s}`, n)
  ctx.summary.add(
    MODULE,
    "missing punch-outs (incl. today's open punches)",
    rows.filter((x) => !x.checkOut).length,
  )
  const away = Object.values(ctx.away).reduce(
    (n, m) => n + [...m.values()].filter((k) => k === "ABSENT").length,
    0,
  )
  ctx.summary.add(MODULE, "unplanned absences (no punch, no request)", away)
  ctx.summary.add(MODULE, "default attendance policy", 1)
  void addDays
}
