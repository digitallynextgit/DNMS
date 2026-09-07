/**
 * Shared date helpers. The app standardizes day-boundary math on UTC so that
 * leave/wfh/attendance ranges don't shift by the server's timezone. (Previously
 * some actions used local `setHours` and others `setUTCHours`, causing
 * off-by-one risk near midnight.)
 */

/** Start of the given day in UTC (00:00:00.000Z). */
export function startOfDayUTC(date: Date | string): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** End of the given day in UTC (23:59:59.999Z). */
export function endOfDayUTC(date: Date | string): Date {
  const d = new Date(date)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

/** "YYYY-MM-DD" for the given date (UTC). */
export function toDateOnly(date: Date | string): string {
  return new Date(date).toISOString().split("T")[0]
}

/** UTC [start, end] for a calendar month. `month` is 0-indexed (0 = January). */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  }
}

/** True if the date falls on Saturday or Sunday (UTC). */
export function isWeekend(date: Date | string): boolean {
  const day = new Date(date).getUTCDay()
  return day === 0 || day === 6
}

/** Today as a UTC midnight - the anchor for every DATE-column comparison. */
export function todayUtc(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

/** `date` shifted by `days` (may be negative). Does not mutate. */
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
 * The latest calendar day currently in progress anywhere on Earth (UTC+14 is
 * a day ahead of UTC for ten hours). A date picker is local; a "not in the
 * future" check against plain UTC-today rejects a valid entry from Auckland
 * or, after 18:30 UTC, from Kolkata. Use this as the upper bound instead.
 */
export function latestCalendarDay(today: Date = todayUtc()): Date {
  return addDays(today, 1)
}
