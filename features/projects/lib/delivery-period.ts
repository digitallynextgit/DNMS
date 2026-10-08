import { addDays, todayUtc } from "@/lib/dates"

// The window a commitment covers. Weeks are WORKING weeks (Mon-Fri) - the weekend falls in no
// period on purpose. Any range is accepted; `periodProblem` says what isn't one.

export type PeriodKind = "day" | "week" | "month" | "range"

export interface DeliveryPeriod {
  /** Inclusive first day, UTC midnight. */
  start: Date
  /** Inclusive last day, UTC midnight. Equal to `start` for a single day. */
  end: Date
}

export const ymd = (d: Date): string => d.toISOString().slice(0, 10)

/** Parse a yyyy-MM-dd into UTC midnight. Null for anything that is not one. */
export function parseDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** The Monday on or before `d`. */
export function startOfWeek(d: Date): Date {
  // getUTCDay: 0 = Sunday. Monday-start means Sunday counts as day 7.
  const dow = d.getUTCDay()
  return addDays(d, -((dow + 6) % 7))
}

/** The working week (Mon-Fri) containing `d`; a weekend date reads as the week just finished. */
export function weekOf(d: Date): DeliveryPeriod {
  const start = startOfWeek(d)
  return { start, end: addDays(start, 4) }
}

/** A year: past any real commitment, short of a mis-keyed year (2026 -> 2062). */
export const MAX_PERIOD_DAYS = 366

/** User-facing reason this period is invalid, or null. Shared by the wizard, server and portal. */
export function periodProblem(start: Date, end: Date): string | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "That is not a date."
  }
  if (end.getTime() < start.getTime()) return "The period ends before it starts."
  if (daysIn({ start, end }) > MAX_PERIOD_DAYS) {
    return `A plan covers at most a year - check the dates.`
  }
  return null
}

export function monthOf(d: Date): DeliveryPeriod {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  return { start, end }
}

/** The period a kind + anchor describes. `range` keeps whatever it was given. */
export function periodFor(kind: PeriodKind, anchor: Date, until?: Date | null): DeliveryPeriod {
  switch (kind) {
    case "day":
      return { start: anchor, end: anchor }
    case "week":
      return weekOf(anchor)
    case "month":
      return monthOf(anchor)
    case "range": {
      // A backwards range is a picker slip; read it the way round it was meant.
      const other = until ?? anchor
      return other < anchor ? { start: other, end: anchor } : { start: anchor, end: other }
    }
  }
}

/** Inclusive length in days. */
export function daysIn(p: DeliveryPeriod): number {
  return Math.round((p.end.getTime() - p.start.getTime()) / 86_400_000) + 1
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Shortest exact label: "1 Sep 2026", "1-7 Sep 2026", "28 Sep - 4 Oct 2026", "Sep 2026". */
export function formatPeriod(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth()
  const d = (x: Date) => x.getUTCDate()
  const m = (x: Date) => MONTHS[x.getUTCMonth()]
  const y = (x: Date) => x.getUTCFullYear()

  if (start.getTime() === end.getTime()) return `${d(start)} ${m(start)} ${y(start)}`

  // A whole calendar month reads better by name than as "1-30 Sep".
  const whole = monthOf(start)
  if (whole.start.getTime() === start.getTime() && whole.end.getTime() === end.getTime()) {
    return `${m(start)} ${y(start)}`
  }

  if (sameMonth) return `${d(start)}-${d(end)} ${m(start)} ${y(start)}`
  if (sameYear) return `${d(start)} ${m(start)} - ${d(end)} ${m(end)} ${y(end)}`
  return `${d(start)} ${m(start)} ${y(start)} - ${d(end)} ${m(end)} ${y(end)}`
}

/** "this week", "next month" - the label the wizard's presets carry. */
export function presetPeriod(
  kind: PeriodKind,
  offset: number,
  today: Date = todayUtc(),
): DeliveryPeriod {
  if (kind === "month") {
    const anchor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1))
    return monthOf(anchor)
  }
  if (kind === "week") return weekOf(addDays(today, offset * 7))
  return periodFor("day", addDays(today, offset))
}
