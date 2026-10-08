/**
 * Month arithmetic for monthly calendars (one edition per month under a name). Parses by splitting
 * the string, never `new Date("2026-09-01").getMonth()` - that is August west of Greenwich.
 */

/** Month names, index 0-11. Matches components/shared/month-nav.tsx. */
export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

export const NO_MONTH_LABEL = "No month"

export interface YearMonth {
  year: number
  /** 0-11, so it drops straight into MONTH_LABELS and <MonthNav>. */
  month0: number
}

/** "2026-09-01" or a full timestamp -> { year: 2026, month0: 8 }. Null for anything else. */
export function parseMonth(iso: string | null | undefined): YearMonth | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return { year, month0: month - 1 }
}

/** { 2026, 8 } -> "2026-09-01": the first of the month, as the column stores it. */
export function monthISO(year: number, month0: number): string {
  const y = String(year).padStart(4, "0")
  const m = String(month0 + 1).padStart(2, "0")
  return `${y}-${m}-01`
}

/** "2026-09-01" -> "September 2026". Null -> "No month". */
export function formatMonth(iso: string | null | undefined): string {
  const ym = parseMonth(iso)
  return ym ? `${MONTH_LABELS[ym.month0]} ${ym.year}` : NO_MONTH_LABEL
}

/** "2026-09-01" -> "Sep 2026". For chips and dropdown rows. */
export function formatMonthShort(iso: string | null | undefined): string {
  const ym = parseMonth(iso)
  return ym ? `${MONTH_LABELS[ym.month0].slice(0, 3)} ${ym.year}` : NO_MONTH_LABEL
}

export function shiftMonth({ year, month0 }: YearMonth, by: number): YearMonth {
  const total = year * 12 + month0 + by
  return { year: Math.floor(total / 12), month0: ((total % 12) + 12) % 12 }
}

/** The month containing `d`, in the caller's local time. Used for "this month". */
export function currentMonth(d: Date = new Date()): YearMonth {
  return { year: d.getFullYear(), month0: d.getMonth() }
}

export interface CalendarEdition {
  id: string
  name: string
  /** First of the month, or null for an undated calendar. */
  periodMonth: string | null
}

export interface CalendarSeries<T extends CalendarEdition> {
  /** The calendar's name, with no month in it. */
  name: string
  /** Dated editions NEWEST FIRST, then undated ones. */
  editions: T[]
}

/** One entry per calendar name, sorted by name; editions newest first, undated last as-is. */
export function groupIntoSeries<T extends CalendarEdition>(
  rows: readonly T[],
): CalendarSeries<T>[] {
  const byName = new Map<string, T[]>()
  for (const row of rows) {
    const list = byName.get(row.name)
    if (list) list.push(row)
    else byName.set(row.name, [row])
  }

  return [...byName.entries()]
    .map(([name, editions]) => ({
      name,
      editions: editions.slice().sort((a, b) => {
        // Undated always last, in the order the project chose.
        if (!a.periodMonth && !b.periodMonth) return 0
        if (!a.periodMonth) return 1
        if (!b.periodMonth) return -1
        return b.periodMonth.localeCompare(a.periodMonth)
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Where a month sits in a series, or -1. Compares "YYYY-MM" so timestamps still match. */
export function editionIndexForMonth<T extends CalendarEdition>(
  series: CalendarSeries<T> | null,
  month: YearMonth | null,
): number {
  if (!series) return -1
  if (!month) return series.editions.findIndex((e) => !e.periodMonth)
  const want = monthISO(month.year, month.month0).slice(0, 7)
  return series.editions.findIndex((e) => e.periodMonth?.slice(0, 7) === want)
}

/**
 * Step through the months a calendar actually HAS (August -> October if there's no September).
 * `editions` is newest-first, so the previous month is the next index. Undated ones are skipped.
 */
export function stepEdition<T extends CalendarEdition>(
  series: CalendarSeries<T> | null,
  current: YearMonth | null,
  direction: -1 | 1,
): T | null {
  if (!series) return null
  const dated = series.editions.filter((e) => e.periodMonth)
  const at = dated.findIndex(
    (e) =>
      e.periodMonth?.slice(0, 7) ===
      (current ? monthISO(current.year, current.month0).slice(0, 7) : null),
  )
  if (at === -1) return null
  const next = direction === -1 ? at + 1 : at - 1
  return dated[next] ?? null
}

// Urgency only applies to a month that hasn't finished; past months go neutral so old history
// isn't permanently red.

export type DueTone = "overdue" | "today" | "soon" | "later" | "none"

/** Whole days from `from` to `to`, both "YYYY-MM-DD". Negative = in the past. */
function daysApart(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

export function dueTone(dueOn: string | null, periodMonth: string | null, today: string): DueTone {
  if (!dueOn) return "none"

  // Compare on "YYYY-MM" so the whole of the calendar's month counts as current.
  const month = parseMonth(periodMonth)
  if (month) {
    const now = parseMonth(today)
    if (now && (month.year < now.year || (month.year === now.year && month.month0 < now.month0))) {
      return "later"
    }
  }

  const days = daysApart(today, dueOn)
  if (days < 0) return "overdue"
  if (days === 0) return "today"
  return days <= 3 ? "soon" : "later"
}

/** The words beside the tone. Never colour alone - see dueTone's callers. */
export function dueLabel(dueOn: string | null, tone: DueTone, today: string): string {
  if (!dueOn) return "No date"
  const pretty = formatDueDate(dueOn)
  switch (tone) {
    case "overdue": {
      const late = -daysApart(today, dueOn)
      // Past a week, the date is more useful than the count.
      return late > 7 ? `Overdue since ${pretty}` : `Overdue ${late} ${late === 1 ? "day" : "days"}`
    }
    case "today":
      return "Due today"
    default:
      return `Due ${pretty}`
  }
}

/** "2026-09-30" -> "30 Sep". The year only when it is not this one. */
export function formatDueDate(iso: string, today: string = new Date().toISOString()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  const label = `${Number(d)} ${MONTH_LABELS[Number(mo) - 1]?.slice(0, 3) ?? ""}`
  return y === today.slice(0, 4) ? label : `${label} ${y}`
}
