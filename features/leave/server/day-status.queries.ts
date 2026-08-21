import "server-only"

import { db } from "@/server/db"

// =============================================================================
// "Is this person available on this day?"
//
// Built for the weekly task sheet, which otherwise shows an empty column with no
// explanation - and invites a manager to plan work into a day nobody is there.
//
// What counts as away, and what deliberately does NOT:
//
//   FULL-DAY LEAVE   away. Zero capacity.
//   HALF DAY         partly away. Work IS still expected, just less of it, so it
//                    is marked differently rather than as a day off.
//   PUBLIC HOLIDAY   away - nobody is in, which explains an empty column for the
//                    whole team at once.
//   OPTIONAL HOLIDAY only when this person actually chose to take it. A floating
//                    holiday most people work through is not an absence.
//   BIRTHDAY         away - the company gives it as an optional day off, so the
//                    sheet should not ask why the column is quiet. Nothing
//                    records whether it was actually taken, so it is marked for
//                    everyone and any work done that day still shows in the row.
//   WFH              NOT away. They are working a normal day from a different
//                    desk. Flagging it as absence would be wrong, and would make
//                    the sheet look like people vanish whenever they work from
//                    home.
//
// The leave TYPE is never returned. "Mridul is off on Thursday" is ordinary team
// information; "Mridul is off on Thursday on SICK leave" is medical detail that
// has no business on a task board.
// =============================================================================

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

/**
 * Away days for one employee across an inclusive date range.
 *
 * A holiday wins over leave on the same date: nobody is in either way, and
 * "Independence Day" tells the reader more than "On leave" does.
 */
export async function getAwayDays(
  employeeId: string,
  from: string,
  to: string,
): Promise<AwayDay[]> {
  const byEmployee = await getAwayDaysForMany([employeeId], from, to)
  return byEmployee[employeeId] ?? []
}

/**
 * The same question asked about a whole team at once.
 *
 * The project sheet plans a WEEK PER PERSON - a row each, five columns - so it
 * needs this for everyone on the board before it can dim the days nobody is in.
 * One set of queries for the group rather than one round trip per person, and
 * the single-employee call above goes through it too, so the rules below have
 * exactly one implementation.
 *
 * Every requested id comes back, mapping to an empty list when there is nothing
 * to report - a caller can look up any row without checking for a hole.
 */
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
        // Any overlap with the window, not just requests that start inside it -
        // a week-long leave straddling Monday must still mark Monday.
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { employeeId: true, startDate: true, endDate: true, totalDays: true },
    }),
    // Not per employee: a public holiday is the company's, and reading it once
    // is what makes the batched version cheaper than a call per person.
    db.holiday.findMany({
      where: { date: { gte: start, lte: end } },
      select: { id: true, name: true, date: true, isOptional: true },
    }),
    db.floatingHolidaySelection.findMany({
      where: { employeeId: { in: ids }, holiday: { date: { gte: start, lte: end } } },
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

/**
 * One person's away days, from data already read. Split out so the single and
 * the batched entry points cannot drift on what counts as an absence.
 *
 * A holiday wins over leave on the same date: nobody is in either way, and
 * "Independence Day" tells the reader more than "On leave" does.
 */
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

  // Birthday FIRST, so a real leave request or a public holiday overwrites it
  // below. Those are the stronger statement about why somebody is not here; the
  // birthday is the softer "they may well have taken it".
  if (dob) {
    // Compared as month + day, not as a date: the year is their birth year.
    // A 29 Feb birthday simply finds no match in a non-leap year, which is the
    // right answer for a day that does not exist.
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCMonth() === dob.getUTCMonth() && d.getUTCDate() === dob.getUTCDate()) {
        out.set(toKey(d), { date: toKey(d), status: "birthday", label: "Birthday" })
      }
    }
  }

  // Leave next, so a holiday can overwrite it below.
  for (const l of leaves) {
    // A single-day request of less than a full day is a half day. Multi-day
    // requests are treated as full days throughout - the model records only a
    // total, so which end was the half is not knowable.
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
