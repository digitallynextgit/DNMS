// Weekly review rules: after the 15-day scorecard, the reporting manager scores the joinee every
// Friday for 90 days. Only raw 1-5 scores are stored; every average is computed here.

import { addDays, startOfDayUTC, toDateOnly } from "@/lib/dates"
import { SCORECARD_DAYS, isScore } from "./scorecard"

/** How long the weekly reviews run after the scorecard's last day. */
export const WEEKLY_REVIEW_DAYS = 90

/** A Friday's parameter; hidden ones stay in the list so their scores keep their meaning. */
export interface ReviewParam {
  key: string
  label: string
  isActive: boolean
}

/** Until HR edits the company default. */
export const DEFAULT_REVIEW_PARAMS: readonly ReviewParam[] = [
  { key: "quality", label: "Quality of work", isActive: true },
  { key: "ownership", label: "Ownership & accountability", isActive: true },
  { key: "communication", label: "Communication", isActive: true },
  { key: "learning", label: "Learning & initiative", isActive: true },
  { key: "teamwork", label: "Teamwork & collaboration", isActive: true },
]

/**
 * The review Fridays: from the week the scorecard's 15th day falls in (the first Friday on or
 * after it) until 90 days after that day.
 */
export function weeklyReviewFridays(start: Date | string): Date[] {
  const lastScorecardDay = addDays(startOfDayUTC(start), SCORECARD_DAYS - 1)
  // getUTCDay(): 5 = Friday.
  let friday = addDays(lastScorecardDay, (5 - lastScorecardDay.getUTCDay() + 7) % 7)
  const end = addDays(lastScorecardDay, WEEKLY_REVIEW_DAYS)
  const out: Date[] = []
  for (; friday <= end; friday = addDays(friday, 7)) out.push(friday)
  return out
}

/** A stored parameter list, or null when it can't be read. */
export function parseParams(value: unknown): ReviewParam[] | null {
  if (!Array.isArray(value)) return null
  const out: ReviewParam[] = []
  for (const v of value) {
    const o = (v ?? {}) as Record<string, unknown>
    if (typeof o.key !== "string" || typeof o.label !== "string") return null
    out.push({ key: o.key, label: o.label, isActive: o.isActive !== false })
  }
  return out
}

/** "p.client-handling" from "Client handling"; the caller makes it unique. */
export function paramKeyFor(label: string): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "param"
  return `p.${slug}`
}

/**
 * The list after an edit: the edited items in their new order (new ones keyed apart from every
 * row here), then any row left out, hidden - never dropped, so its scores keep their meaning.
 */
export function applyParamEdit(
  current: readonly ReviewParam[],
  items: readonly { key: string | null; label: string; isActive: boolean }[],
): ReviewParam[] {
  const known = new Set(current.map((p) => p.key))
  const used = new Set<string>()
  const out: ReviewParam[] = []
  for (const item of items) {
    if (item.key && known.has(item.key) && !used.has(item.key)) {
      used.add(item.key)
      out.push({ key: item.key, label: item.label, isActive: item.isActive })
      continue
    }
    const base = paramKeyFor(item.label)
    let key = base
    for (let n = 2; known.has(key) || used.has(key); n++) key = `${base}-${n}`
    used.add(key)
    out.push({ key, label: item.label, isActive: item.isActive })
  }
  for (const p of current) if (!used.has(p.key)) out.push({ ...p, isActive: false })
  return out
}

/** Scores kept only for keys that are 1-5. */
export function parseReviewScores(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(value)) if (isScore(v)) out[k] = v
  return out
}

/** Mean of the week's visible parameters that have a score; null when none do. */
export function weekAverage(
  scores: Readonly<Record<string, number>>,
  params: readonly ReviewParam[],
): number | null {
  const present = params.filter((p) => p.isActive).map((p) => scores[p.key])
  const nums = present.filter((v): v is number => typeof v === "number")
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

export type WeekState = "done" | "due" | "overdue" | "upcoming"

/**
 * Where a Friday stands: done once anything is filled in; due from its Friday; overdue from the
 * Tuesday after (the Monday reminder has gone by then); upcoming before.
 */
export function weekState(date: Date | string, reviewed: boolean, today: Date | string): WeekState {
  if (reviewed) return "done"
  const day = toDateOnly(date)
  const now = toDateOnly(today)
  if (now < day) return "upcoming"
  return now > toDateOnly(addDays(startOfDayUTC(date), 3)) ? "overdue" : "due"
}

/** A Friday can be filled in from the Monday of its week - not weeks ahead. */
export function weekIsOpen(date: Date | string, today: Date | string): boolean {
  return toDateOnly(today) >= toDateOnly(addDays(startOfDayUTC(date), -4))
}

/** Average of the weekly averages (each reviewed Friday counts once). */
export function reviewSummary(averages: readonly (number | null)[]) {
  const nums = averages.filter((v): v is number => v !== null)
  return {
    overall: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
    scoredWeeks: nums.length,
  }
}
