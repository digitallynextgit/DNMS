// Presentation helpers for a WFH request's date range. A request covers
// `date`..`endDate` inclusive (equal for a single day), so every surface that
// shows one - the list, the approver inbox, the letter preview - needs the same
// wording. Keeping it here means the three can't drift apart.

/** Parse a "yyyy-MM-dd" (or ISO) day as a LOCAL date. `new Date("2026-09-23")`
 *  is UTC midnight, which renders as the 22nd for anyone behind UTC. */
export function parseWfhDay(value: string): Date | null {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "2-digit",
  month: "short",
}

/** "Wed, 23 Sep" - one day, as the tables have always shown it. */
export function formatWfhDay(value: string): string {
  const day = parseWfhDay(value)
  return day ? day.toLocaleDateString("en-IN", DAY_FORMAT) : "-"
}

/** "Wed, 23 Sep" for a single day, "Wed, 23 Sep - Thu, 24 Sep" for a range. */
export function formatWfhRangeLabel(date: string, endDate?: string | null): string {
  const start = formatWfhDay(date)
  if (!endDate || endDate.slice(0, 10) === date.slice(0, 10)) return start
  return `${start} - ${formatWfhDay(endDate)}`
}

/** "2 days", or null for a single-day request (where it would just be noise). */
export function formatWfhDaysCount(totalDays?: number | null): string | null {
  return totalDays && totalDays > 1 ? `${totalDays} days` : null
}
