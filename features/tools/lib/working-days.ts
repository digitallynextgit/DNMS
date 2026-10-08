import { format } from "date-fns"
import { addDays, isWeekend, toDateOnly } from "@/lib/dates"

// Weekends follow lib/dates.ts isWeekend (Sat + Sun), so this never disagrees with WFH or
// attendance. Days are "YYYY-MM-DD" keys worked on as UTC midnight, like every DATE column.

export const MAX_RANGE_DAYS = 3 * 366
export const MAX_ADD_WORKING_DAYS = 750

export interface HolidayInput {
  /** "YYYY-MM-DD", or an ISO timestamp at UTC midnight as the API returns it. */
  date: string
  name: string
  isOptional: boolean
}

/** The days off: "YYYY-MM-DD" -> the names of the holidays on that day. */
export type HolidayMap = ReadonlyMap<string, readonly string[]>

export interface SkippedDay {
  date: string
  /** A weekend wins: a holiday on a Saturday is a weekend day, not an extra day off. */
  reason: "weekend" | "holiday"
  /** Holiday names on this day - also set when the holiday falls on a weekend. */
  names: readonly string[]
}

export interface DaySummary {
  workingDays: number
  calendarDays: number
  weekendDays: number
  holidayDays: number
  skipped: SkippedDay[]
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** "YYYY-MM-DD" -> its UTC midnight, or null for anything that isn't a real date. */
export function parseYmd(value: string | null | undefined): Date | null {
  if (!value || !YMD.test(value)) return null
  const [y, m, d] = value.split("-").map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  // Rejects 2026-02-30 and friends, which Date.UTC would quietly roll over.
  return toDateOnly(date) === value ? date : null
}

/** "2026-10-08" -> "Thu, 8 Oct 2026" (built from the parts, so no timezone shift). */
export function formatYmd(value: string, pattern = "EEE, d MMM yyyy"): string {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number]
  return format(new Date(y, m - 1, d), pattern)
}

function dayDiff(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

/** Floating (optional) holidays count only with includeFloating - most people work on those. */
export function buildHolidayMap(
  holidays: readonly HolidayInput[],
  { includeFloating }: { includeFloating: boolean },
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const h of holidays) {
    if (h.isOptional && !includeFloating) continue
    const key = h.date.slice(0, 10)
    if (!parseYmd(key)) continue
    const names = map.get(key) ?? []
    if (!names.includes(h.name)) names.push(h.name)
    map.set(key, names)
  }
  return map
}

/** Floating holidays on weekdays in [start, end], for a "counted as working days" note. */
export function floatingHolidaysBetween(
  holidays: readonly HolidayInput[],
  start: string,
  end: string,
): { date: string; name: string }[] {
  return holidays
    .filter((h) => h.isOptional)
    .map((h) => ({ date: h.date.slice(0, 10), name: h.name }))
    .filter((h) => h.date >= start && h.date <= end)
    .filter((h) => {
      const day = parseYmd(h.date)
      return day !== null && !isWeekend(day)
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
}

export function shiftYmd(value: string, days: number): string {
  const day = parseYmd(value)
  if (!day) throw new Error("Invalid date")
  return toDateOnly(addDays(day, days))
}

function offReason(day: Date, holidays: HolidayMap): SkippedDay | null {
  const key = toDateOnly(day)
  const names = holidays.get(key) ?? []
  if (isWeekend(day)) return { date: key, reason: "weekend", names }
  if (names.length > 0) return { date: key, reason: "holiday", names }
  return null
}

function summarise(skipped: SkippedDay[], workingDays: number, calendarDays: number): DaySummary {
  const weekendDays = skipped.filter((s) => s.reason === "weekend").length
  return {
    workingDays,
    calendarDays,
    weekendDays,
    holidayDays: skipped.length - weekendDays,
    skipped,
  }
}

export type RangeProblem = "missing" | "invalid" | "end-before-start" | "too-long"

export function checkRange(start: string, end: string): RangeProblem | null {
  if (!start || !end) return "missing"
  const s = parseYmd(start)
  const e = parseYmd(end)
  if (!s || !e) return "invalid"
  if (e < s) return "end-before-start"
  if (dayDiff(s, e) + 1 > MAX_RANGE_DAYS) return "too-long"
  return null
}

/** The start always counts; the end only with includeEnd. Throws on a range checkRange() rejects. */
export function countWorkingDays(
  start: string,
  end: string,
  holidays: HolidayMap,
  { includeEnd }: { includeEnd: boolean },
): DaySummary {
  const problem = checkRange(start, end)
  if (problem) throw new Error(`Invalid range: ${problem}`)
  const first = parseYmd(start)!
  const last = includeEnd ? parseYmd(end)! : addDays(parseYmd(end)!, -1)

  const skipped: SkippedDay[] = []
  let workingDays = 0
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const off = offReason(d, holidays)
    if (off) skipped.push(off)
    else workingDays++
  }
  return summarise(skipped, workingDays, Math.max(0, dayDiff(first, last) + 1))
}

export interface AddResult extends DaySummary {
  end: string
}

/**
 * countStart off (default): the start is "day 0", so Friday + 1 = next Monday. countStart on:
 * the start is day 1 if it's a working day ("a 5-day job starting Monday" ends Friday).
 */
export function addWorkingDays(
  start: string,
  n: number,
  holidays: HolidayMap,
  { countStart }: { countStart: boolean },
): AddResult {
  const first = parseYmd(start)
  if (!first) throw new Error("Invalid start date")
  if (!Number.isInteger(n) || n < 0 || n > MAX_ADD_WORKING_DAYS) {
    throw new Error(`Working days must be a whole number from 0 to ${MAX_ADD_WORKING_DAYS}`)
  }

  if (n === 0) return { ...summarise([], 0, 0), end: start }

  const skipped: SkippedDay[] = []
  const from = countStart ? first : addDays(first, 1)
  let counted = 0
  let d = from
  for (;;) {
    const off = offReason(d, holidays)
    if (off) skipped.push(off)
    else if (++counted === n) break
    d = addDays(d, 1)
  }
  return { ...summarise(skipped, n, dayDiff(from, d) + 1), end: toDateOnly(d) }
}

export function yearsBetween(start: string, end: string): number[] {
  const s = parseYmd(start)
  const e = parseYmd(end)
  if (!s || !e || e < s) return []
  const years: number[] = []
  for (let y = s.getUTCFullYear(); y <= e.getUTCFullYear(); y++) years.push(y)
  return years
}

const HOLIDAY_SLACK_DAYS_PER_YEAR = 40

/**
 * Years an "add N working days" answer can touch, before holidays are known: where weekends
 * alone land, plus 40 days of slack per year (more weekday holidays than any company has).
 */
export function yearsForAdd(start: string, n: number, countStart: boolean): number[] {
  const first = parseYmd(start)
  if (!first || !Number.isInteger(n) || n < 0 || n > MAX_ADD_WORKING_DAYS) return []
  const weekendsOnly = parseYmd(addWorkingDays(start, n, new Map(), { countStart }).end)!
  const spanYears = weekendsOnly.getUTCFullYear() - first.getUTCFullYear() + 1
  const latest = addDays(weekendsOnly, HOLIDAY_SLACK_DAYS_PER_YEAR * spanYears)
  return yearsBetween(start, toDateOnly(latest))
}
