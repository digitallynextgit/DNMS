// Month periods for recurring goals: each edition covers one calendar month, stored as UTC midnights
// on its first and last day. Pure, so the board, the rollover and the tests agree.

import { currentPlanMonth, parseMonth } from "./calendar-months"

export interface GoalPeriod {
  start: Date
  end: Date
}

/** "2026-10" or "2026-10-01" -> 1 Oct to 31 Oct 2026. Null for anything else. */
export function monthPeriod(ym: string | null | undefined): GoalPeriod | null {
  const m = parseMonth(ym)
  if (!m) return null
  return {
    start: new Date(Date.UTC(m.year, m.month0, 1)),
    end: new Date(Date.UTC(m.year, m.month0 + 1, 0)),
  }
}

/** The month the team is planning in now (India time). */
export function planMonthPeriod(now: Date = new Date()): GoalPeriod {
  return monthPeriod(currentPlanMonth(now))!
}

/** A date's month as "2026-10". */
export function periodKey(d: Date): string {
  return d.toISOString().slice(0, 7)
}

const DAY = 86_400_000

/**
 * How much of the period should be done by the end of `today`, 0-1: today counts as worked, so on the
 * last day it is 1 and before the first day 0.
 */
export function elapsedShare(start: Date, end: Date, today: Date): number {
  const total = Math.round((end.getTime() - start.getTime()) / DAY) + 1
  if (total <= 0) return 1
  const done = Math.round((today.getTime() - start.getTime()) / DAY) + 1
  return Math.min(1, Math.max(0, done / total))
}
