/**
 * Months, as a calendar means the word.
 *
 * A calendar is planned a month at a time, so "Performance Marketing Calendar"
 * is a NAME with one edition per month behind it rather than a single sheet.
 * This file is the arithmetic for that: which months exist, what to call one,
 * and where stepping forwards or backwards lands.
 *
 * ── WHY NO `Date` ANYWHERE NEAR THE PARSING ──────────────────────────────────
 * A month is stored as the first day of it, a @db.Date, which arrives as the
 * string "2026-09-01". `new Date("2026-09-01")` is UTC midnight, and
 * `.getMonth()` on it reads the LOCAL month - so anywhere west of Greenwich
 * September silently becomes August. Splitting the string never has that
 * problem, and there is nothing here that needs real date maths.
 *
 * Dependency-free, like sheet-types.ts, so the grid can import it without
 * pulling anything server-side into the client bundle.
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

/** What an undated calendar is called wherever a month would go. */
export const NO_MONTH_LABEL = "No month"

export interface YearMonth {
  year: number
  /** 0-11, so it drops straight into MONTH_LABELS and <MonthNav>. */
  month0: number
}

/**
 * "2026-09-01" -> { year: 2026, month0: 8 }. Null for anything else, including
 * the undated calendars whose periodMonth is null.
 *
 * Tolerates a full timestamp ("2026-09-01T00:00:00.000Z") because that is what
 * JSON.stringify does to a Date, and a payload that took that route must not
 * read as undated.
 */
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

/** The month before or after this one, rolling the year over. */
export function shiftMonth({ year, month0 }: YearMonth, by: number): YearMonth {
  const total = year * 12 + month0 + by
  return { year: Math.floor(total / 12), month0: ((total % 12) + 12) % 12 }
}

/** The month containing `d`, in the caller's local time. Used for "this month". */
export function currentMonth(d: Date = new Date()): YearMonth {
  return { year: d.getFullYear(), month0: d.getMonth() }
}

/** The minimum an edition must carry to be ordered and grouped. */
export interface CalendarEdition {
  id: string
  name: string
  /** First of the month, or null for an undated calendar. */
  periodMonth: string | null
}

export interface CalendarSeries<T extends CalendarEdition> {
  /** The calendar's name, with no month in it. */
  name: string
  /**
   * Every edition of it: dated ones NEWEST FIRST, then any undated ones.
   *
   * Newest first because the month people want is almost always the current one
   * or the one just gone, and a list that opens on 2019 makes them scroll past
   * five years of history to reach it.
   */
  editions: T[]
}

/**
 * Group flat workbook rows into one entry per calendar NAME.
 *
 * Sorted by name so the picker is stable between loads; within a name, by month
 * descending with the undated stragglers last. Undated rows keep their relative
 * order, which is the position the project put them in.
 */
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
        // Undated always last, and never reordered against each other: their
        // order is the one the project chose, and there is no month to beat it.
        if (!a.periodMonth && !b.periodMonth) return 0
        if (!a.periodMonth) return 1
        if (!b.periodMonth) return -1
        return b.periodMonth.localeCompare(a.periodMonth)
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Where a month sits in a series, or -1.
 *
 * Compares the first seven characters rather than the whole string so a row
 * that arrived as a timestamp still matches the "YYYY-MM-01" the picker holds.
 */
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
 * Stepping through the months a calendar ACTUALLY HAS, rather than through the
 * calendar year.
 *
 * The distinction matters: a project that plans August and October has no
 * September, and a stepper that walked the year would land the user on an empty
 * month and make them press again. `editions` is already newest-first, so the
 * PREVIOUS month is the NEXT index.
 *
 * Undated editions are excluded - they are not part of any month order, and
 * stepping onto one from September would be a jump to nowhere.
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

// ─────────────────────────────────────────────────────────────────────────────
// How urgent a team's due date is.
//
// ── WHY THIS TAKES THE CALENDAR'S MONTH ──────────────────────────────────────
// Urgency is only meaningful for a month that has not finished. Stepping back
// to review June would otherwise paint every chip red forever, and a history
// that is permanently red is how you teach people to stop reading red. For a
// month already gone the tone collapses to neutral and the label is a plain
// date - the date is still worth showing, the alarm is not.
// ─────────────────────────────────────────────────────────────────────────────

export type DueTone = "overdue" | "today" | "soon" | "later" | "none"

/** Whole days from `from` to `to`, both "YYYY-MM-DD". Negative = in the past. */
function daysApart(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

/** `today` is passed in rather than read, so this stays pure and testable. */
export function dueTone(dueOn: string | null, periodMonth: string | null, today: string): DueTone {
  if (!dueOn) return "none"

  // A month that ended before this one is history. Compare on "YYYY-MM", so
  // the whole of the calendar's month counts as current until it is over.
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
      // Past a week the count stops being useful and the date is what people
      // actually want ("since the 12th", not "nineteen days").
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
