import { addDays, todayUtc } from "@/lib/dates"

// =============================================================================
// The window a commitment covers.
//
// "Three reels a week" is not owed on a DAY, it is owed across a WEEK, and a
// single `dueOn` could only ever say when the week ran out. A period says what
// was actually agreed - and it is what the account manager picks first, before
// deciding which team owes what inside it.
//
// A week here is the WORKING week, Monday to Friday. Work is planned against
// the days the team is actually in, and a Mon-Sun window quietly implied two
// days nobody was going to work. The weekend therefore falls in no period at
// all - that is the intent, not an oversight.
//
// Pure and client-safe: the wizard uses it to preview a range, the server uses
// it to store one, and the tests use it to prove they agree.
// =============================================================================

export type PeriodKind = "day" | "week" | "month" | "range"

export interface DeliveryPeriod {
  /** Inclusive first day, UTC midnight. */
  start: Date
  /** Inclusive last day, UTC midnight. Equal to `start` for a single day. */
  end: Date
}

/** yyyy-MM-dd, the shape both the API and the date inputs speak. */
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

/**
 * The working week (Mon-Fri) containing `d`.
 *
 * A weekend date reads back as the week that has just finished, since that is
 * the week it sits in even though no work was planned for those two days.
 */
export function weekOf(d: Date): DeliveryPeriod {
  const start = startOfWeek(d)
  return { start, end: addDays(start, 4) }
}

/** First-to-last day of the calendar month containing `d`. */
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
      // A backwards range is a slip of the picker, not an intent - read it the
      // way round it was obviously meant.
      const other = until ?? anchor
      return other < anchor ? { start: other, end: anchor } : { start: anchor, end: other }
    }
  }
}

/** `n` periods of this kind, starting at the one containing `anchor`. */
export function repeatPeriods(kind: PeriodKind, anchor: Date, count: number): DeliveryPeriod[] {
  const n = Math.max(1, Math.floor(count) || 1)
  const out: DeliveryPeriod[] = [periodFor(kind, anchor)]
  for (let i = 1; i < n; i++) {
    const prev = out[i - 1]!
    // Each kind steps by its OWN stride, never by "the day after the last one".
    // A working week ends on Friday, so the day after its end is Saturday - and
    // the week containing Saturday is the week that just finished. Stepping
    // that way would have stalled on the same week forever.
    switch (kind) {
      case "week":
        out.push(weekOf(addDays(prev.start, 7)))
        break
      case "month":
        // Measured from the previous START, so a short February cannot drag
        // the rest of the year backwards.
        out.push(
          monthOf(new Date(Date.UTC(prev.start.getUTCFullYear(), prev.start.getUTCMonth() + 1, 1))),
        )
        break
      case "day":
        out.push(periodFor("day", addDays(prev.start, 1)))
        break
      case "range": {
        // A custom range repeats immediately after itself, keeping its width.
        const next = addDays(prev.end, 1)
        out.push({ start: next, end: addDays(next, daysIn(prev) - 1) })
        break
      }
    }
  }
  return out
}

/** Inclusive length in days. */
export function daysIn(p: DeliveryPeriod): number {
  return Math.round((p.end.getTime() - p.start.getTime()) / 86_400_000) + 1
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * A period in the fewest words that still say it exactly.
 *
 *   1 Sep 2026                a single day
 *   1-7 Sep 2026              inside one month
 *   28 Sep - 4 Oct 2026       across two
 *   Sep 2026                  a whole calendar month, named rather than spanned
 *   28 Dec 2026 - 3 Jan 2027  across a year
 */
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
