import "server-only"

import { db } from "@/server/db"
import { getConfig } from "@/server/app-config"
import { createNotifications } from "@/lib/notifications"
import { indiaToday, isWeekend } from "@/lib/dates"
import {
  DEFAULT_OFFICE_START,
  buildEntrySummary,
  dueSlots,
  istClock,
  istMinutes,
  parseTimes,
  type EntryPerson,
} from "../lib/entry-summary"

// Entry summary to admins and HR managers at the configured times (09:30, 10:00 and 11:00 India
// by default; the last one is the present / absent list). Each slot is claimed per day in
// digest_runs, so the minute-tick and the cron route can both call this. When several slots are
// overdue at once (server was down), only the latest is sent; the earlier ones are claimed
// silently so they never fire late. Weekends and holidays go out only when someone came in.

const SUMMARY_ROLES = ["admin", "hr_manager"]

async function claim(kind: string, day: Date): Promise<boolean> {
  try {
    await db.digestRun.create({ data: { kind, periodStart: day } })
    return true
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return false
    throw err
  }
}

export async function runEntrySummary(
  now = new Date(),
): Promise<{ sent: number; slot: string | null }> {
  const today = indiaToday(now)
  const todayDate = new Date(`${today}T00:00:00.000Z`)
  const times = parseTimes(await getConfig("ATTENDANCE_SUMMARY_TIMES"))
  const due = dueSlots(times, istMinutes(now))
  if (due.length === 0) return { sent: 0, slot: null }

  const latest = due[due.length - 1]!
  for (const slot of due.slice(0, -1)) await claim(`entry-summary-${slot}`, todayDate)
  if (!(await claim(`entry-summary-${latest}`, todayDate))) return { sent: 0, slot: null }

  const holiday = await db.holiday.findFirst({
    where: { date: todayDate, isOptional: false },
    select: { name: true },
  })
  const offDay = holiday ? `holiday: ${holiday.name}` : isWeekend(todayDate) ? "weekend" : null

  const notHidden = { NOT: { employeeRoles: { some: { role: { name: "admin_" } } } } }
  const employees = await db.employee.findMany({
    where: { isActive: true, ...notHidden },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  })
  const ids = employees.map((e) => e.id)
  const [logs, leaves, wfh] = await Promise.all([
    db.attendanceLog.findMany({
      where: { date: todayDate, employeeId: { in: ids } },
      select: { employeeId: true, checkIn: true },
    }),
    db.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: todayDate }, endDate: { gte: todayDate } },
      select: { employeeId: true, totalDays: true },
    }),
    db.wfhRequest.findMany({
      where: { status: "APPROVED", date: { lte: todayDate }, endDate: { gte: todayDate } },
      select: { employeeId: true },
    }),
  ])
  const checkIn = new Map(logs.filter((l) => l.checkIn).map((l) => [l.employeeId, l.checkIn!]))
  // A quiet weekend or holiday is not worth a message; one person in the office is.
  if (offDay && checkIn.size === 0) return { sent: 0, slot: latest }

  const away = new Map<string, EntryPerson["away"]>()
  for (const w of wfh) away.set(w.employeeId, "wfh")
  for (const l of leaves) away.set(l.employeeId, l.totalDays < 1 ? "half-day" : "leave")

  const people: EntryPerson[] = employees.map((e) => {
    const at = checkIn.get(e.id)
    return {
      name: `${e.firstName} ${e.lastName}`.trim(),
      checkIn: at ? istClock(at) : null,
      away: away.get(e.id) ?? null,
    }
  })
  const officeStart = (await getConfig("OFFICE_START")) || DEFAULT_OFFICE_START
  const { title, message } = buildEntrySummary(latest, officeStart, people, {
    final: latest === times[times.length - 1],
    offDay,
  })

  const recipients = await db.employee.findMany({
    where: {
      isActive: true,
      employeeRoles: { some: { role: { name: { in: SUMMARY_ROLES } } } },
      ...notHidden,
    },
    select: { id: true },
  })
  if (recipients.length === 0) return { sent: 0, slot: latest }
  await createNotifications(
    recipients.map((r) => ({
      employeeId: r.id,
      title,
      message,
      type: "info" as const,
      link: "/attendance",
    })),
  )
  return { sent: recipients.length, slot: latest }
}
