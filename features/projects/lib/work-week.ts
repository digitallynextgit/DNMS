// Shared by the allocation sheet and the weekly hours roll-up so they agree on the week.

/** Local calendar day, e.g. "2026-08-03". Never an ISO instant - a week is days. */
export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y!, m! - 1, d!)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** The Monday of the week `d` falls in. Weeks are planned Monday-first. */
export function mondayOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  // getDay() is Sunday-first; shift so Monday is 0 and Sunday closes the week.
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/** Mon-Fri of the week starting at `monday`. The sheet's five columns. */
export function weekdaysFrom(monday: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => addDays(monday, i))
}

export type DayOff = "leave" | "holiday" | null

export interface DayCapacity {
  key: string
  off: DayOff
  hours: number
}

export interface WeekCapacity {
  days: DayCapacity[]
  /** Hours available across the week once leave and holidays are removed. */
  available: number
}

/**
 * What one person could have worked this week. Leave and holidays remove whole days (leave is
 * recorded in whole days); a holiday on a leave day counts once.
 */
export function weekCapacity(args: {
  monday: Date
  hoursPerDay: number
  leaveDayKeys: Set<string>
  holidayKeys: Set<string>
}): WeekCapacity {
  const days = weekdaysFrom(args.monday).map((d) => {
    const key = toDayKey(d)
    const off: DayOff = args.leaveDayKeys.has(key)
      ? "leave"
      : args.holidayKeys.has(key)
        ? "holiday"
        : null
    return { key, off, hours: off ? 0 : args.hoursPerDay }
  })
  return { days, available: days.reduce((sum, d) => sum + d.hours, 0) }
}

/** Logged / available as a %, or null when nothing was available (a week of leave isn't 0%). */
export function utilisation(logged: number, available: number): number | null {
  if (available <= 0) return null
  return Math.round((logged / available) * 100)
}
