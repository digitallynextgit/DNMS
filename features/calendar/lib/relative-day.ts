// "Today" / "Tomorrow" / "in 12 days" / "in 3 months" / "Passed" for a calendar
// date, measured from the viewer's own today. Shared by the calendars' tables.

const pad = (n: number) => String(n).padStart(2, "0")

/** Today as "YYYY-MM-DD" in the viewer's own calendar. */
export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Whole days from today to a "YYYY-MM-DD" date (negative = already passed). */
export function daysFromToday(date: string, now = new Date()): number {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number)
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((Date.UTC(y!, m! - 1, d!) - start) / 86_400_000)
}

export function relativeDayLabel(date: string, now = new Date()): string {
  const days = daysFromToday(date, now)
  if (days === 0) return "Today"
  if (days < 0) return "Passed"
  if (days === 1) return "Tomorrow"
  if (days <= 60) return `in ${days} days`
  return `in ${Math.round(days / 30)} months`
}
