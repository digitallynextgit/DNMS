// Day-boundary math is UTC so leave/WFH/attendance ranges don't shift with the server timezone.

export function startOfDayUTC(date: Date | string): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function endOfDayUTC(date: Date | string): Date {
  const d = new Date(date)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

/** "YYYY-MM-DD" for the given date (UTC). */
export function toDateOnly(date: Date | string): string {
  return new Date(date).toISOString().split("T")[0]
}

/** `month` is 0-indexed (0 = January). */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  }
}

export function isWeekend(date: Date | string): boolean {
  const day = new Date(date).getUTCDay()
  return day === 0 || day === 6
}

/** Today as a UTC midnight - the anchor for every DATE-column comparison. */
export function todayUtc(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

/** Whole days from `a` to `b` (b - a). Negative when `b` is earlier. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDayUTC(b).getTime() - startOfDayUTC(a).getTime()) / 86_400_000)
}

/**
 * Working days from `start` to `end` inclusive, skipping weekends and `holidays` ("YYYY-MM-DD" keys).
 * Shared by WFH costing and the attendance calendars so they always agree.
 */
export function workingDaysBetween(
  start: Date,
  end: Date,
  holidays: Set<string> = new Set(),
): Date[] {
  const days: Date[] = []
  const last = startOfDayUTC(end)
  for (let d = startOfDayUTC(start); d <= last; d = addDays(d, 1)) {
    if (isWeekend(d) || holidays.has(toDateOnly(d))) continue
    days.push(d)
  }
  return days
}

/**
 * Latest calendar day in progress anywhere (UTC+14). Use it as the "not in the future" bound: plain
 * UTC-today rejects valid dates from Auckland, or from Kolkata after 18:30 UTC.
 */
export function latestCalendarDay(today: Date = todayUtc()): Date {
  return addDays(today, 1)
}
