import "server-only"

import { db } from "@/server/db"

// Away days for the task sheet. Full-day leave and public holidays = away; half day = partly
// away; an optional holiday only if this person's request was approved; birthday = away (an optional day off,
// marked for everyone); WFH is NOT away. The leave TYPE is never returned (it can be medical).

export type DayStatus = "leave" | "half-day" | "holiday" | "birthday"

export interface AwayDay {
  /** "yyyy-MM-dd", the local calendar day. */
  date: string
  status: DayStatus
  /** Neutral, safe to show anywhere: "On leave", "Half day", "Independence Day". */
  label: string
}

/** UTC midnight for a "yyyy-MM-dd" - @db.Date columns store that way. */
function dayUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Away days for one employee across an inclusive date range. */
export async function getAwayDays(
  employeeId: string,
  from: string,
  to: string,
): Promise<AwayDay[]> {
  const byEmployee = await getAwayDaysForMany([employeeId], from, to)
  return byEmployee[employeeId] ?? []
}

/** Away days for a whole team in one set of queries; every requested id is in the result
 *  (an empty list when there is nothing to report). */
export async function getAwayDaysForMany(
  employeeIds: string[],
  from: string,
  to: string,
): Promise<Record<string, AwayDay[]>> {
  const ids = [...new Set(employeeIds.filter(Boolean))]
  const out: Record<string, AwayDay[]> = Object.fromEntries(ids.map((id) => [id, []]))
  if (ids.length === 0) return out

  const start = dayUtc(from)
  const end = dayUtc(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out

  const [employees, leaves, holidays, floatingTaken] = await Promise.all([
    db.employee.findMany({ where: { id: { in: ids } }, select: { id: true, dateOfBirth: true } }),
    db.leaveRequest.findMany({
      where: {
        employeeId: { in: ids },
        status: "APPROVED",
        // Any overlap with the window, so leave straddling Monday still marks Monday.
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { employeeId: true, startDate: true, endDate: true, totalDays: true },
    }),
    db.holiday.findMany({
      where: { date: { gte: start, lte: end } },
      select: { id: true, name: true, date: true, isOptional: true },
    }),
    db.floatingHolidaySelection.findMany({
      where: {
        employeeId: { in: ids },
        status: "APPROVED",
        holiday: { date: { gte: start, lte: end } },
      },
      select: { employeeId: true, holidayId: true },
    }),
  ])

  const dobById = new Map(employees.map((e) => [e.id, e.dateOfBirth]))
  const leavesById = new Map<string, typeof leaves>()
  for (const l of leaves) {
    const list = leavesById.get(l.employeeId)
    if (list) list.push(l)
    else leavesById.set(l.employeeId, [l])
  }
  const takenById = new Map<string, Set<string>>()
  for (const f of floatingTaken) {
    const set = takenById.get(f.employeeId)
    if (set) set.add(f.holidayId)
    else takenById.set(f.employeeId, new Set([f.holidayId]))
  }

  for (const id of ids) {
    out[id] = assembleAwayDays({
      start,
      end,
      dateOfBirth: dobById.get(id) ?? null,
      leaves: leavesById.get(id) ?? [],
      holidays,
      takenFloating: takenById.get(id) ?? new Set(),
    })
  }
  return out
}

/** One person's away days from already-read data. A holiday wins over leave on the same date. */
function assembleAwayDays(input: {
  start: Date
  end: Date
  dateOfBirth: Date | null
  leaves: { startDate: Date; endDate: Date; totalDays: number }[]
  holidays: { id: string; name: string; date: Date; isOptional: boolean }[]
  takenFloating: Set<string>
}): AwayDay[] {
  const { start, end, dateOfBirth: dob, leaves, holidays, takenFloating } = input
  const out = new Map<string, AwayDay>()

  // Birthday first, so leave or a holiday on the same date overwrites it.
  if (dob) {
    // Month + day only; a 29 Feb birthday finds no match in a non-leap year.
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCMonth() === dob.getUTCMonth() && d.getUTCDate() === dob.getUTCDate()) {
        out.set(toKey(d), { date: toKey(d), status: "birthday", label: "Birthday" })
      }
    }
  }

  // Leave next, so a holiday can overwrite it below.
  for (const l of leaves) {
    // Half day = a single-day request under 1 day (multi-day requests only store a total).
    const isHalf = l.totalDays < 1 && toKey(l.startDate) === toKey(l.endDate)
    for (let d = new Date(l.startDate); d <= l.endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d < start || d > end) continue
      out.set(toKey(d), {
        date: toKey(d),
        status: isHalf ? "half-day" : "leave",
        label: isHalf ? "Half day" : "On leave",
      })
    }
  }

  for (const h of holidays) {
    // An optional holiday is a normal working day for anyone who did not take it.
    if (h.isOptional && !takenFloating.has(h.id)) continue
    out.set(toKey(h.date), { date: toKey(h.date), status: "holiday", label: h.name })
  }

  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date))
}
