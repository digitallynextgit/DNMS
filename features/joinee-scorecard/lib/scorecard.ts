// 15-day joinee scorecard rules. Only raw 1-5 scores are stored; every average is computed here.

import { addDays, isWeekend, startOfDayUTC, toDateOnly } from "@/lib/dates"

/** How many calendar days a scorecard covers, from the joining date. */
export const SCORECARD_DAYS = 15

export type ScorecardSide = "MANAGER" | "HR"

export interface ScorecardCriterion {
  key: string
  side: ScorecardSide
  label: string
}

/** The built-in six, in sheet order: three by the manager, three by HR. The company default
 *  (joinee_scorecard_criteria) starts from these; each card then keeps its own copy. */
export const SCORECARD_CRITERIA: readonly ScorecardCriterion[] = [
  { key: "mgrJobRole", side: "MANAGER", label: "Understanding of Job Role" },
  { key: "mgrCommunication", side: "MANAGER", label: "Communication & Ownership" },
  { key: "mgrLearning", side: "MANAGER", label: "Learning / Collaboration Skills" },
  { key: "hrDiscipline", side: "HR", label: "Discipline & Attendance" },
  { key: "hrCulture", side: "HR", label: "Culture & Collaboration" },
  { key: "hrLearning", side: "HR", label: "Learning / Adaptability" },
]

/** The built-in six live in their own day columns; anything HR adds goes in the day's JSON. */
export const LEGACY_SCORE_KEYS = [
  "mgrJobRole",
  "mgrCommunication",
  "mgrLearning",
  "hrDiscipline",
  "hrCulture",
  "hrLearning",
] as const
export type LegacyScoreKey = (typeof LEGACY_SCORE_KEYS)[number]

export function isLegacyScoreKey(key: string): key is LegacyScoreKey {
  return (LEGACY_SCORE_KEYS as readonly string[]).includes(key)
}

export const SCORE_KEYS: string[] = SCORECARD_CRITERIA.map((c) => c.key)

export type ScoreKey = string

/** One day's scores by criterion key; null = not given yet. */
export type DayScores = Record<string, number | null>

export const SCORING_GUIDE = [
  { score: 5, label: "Excellent", description: "Consistently exceeds expectations" },
  { score: 4, label: "Good", description: "Meets expectations well" },
  { score: 3, label: "Average", description: "Meets basic expectations" },
  { score: 2, label: "Needs Improvement", description: "Below expectations" },
  { score: 1, label: "Unsatisfactory", description: "Significant concern" },
] as const

export const RECOMMENDATIONS = [
  { value: "CONTINUE", label: "Continue as planned" },
  { value: "CONTINUE_WITH_IMPROVEMENTS", label: "Continue with specific improvement areas" },
  { value: "REVIEW_REQUIRED", label: "Review required" },
] as const

export type Recommendation = (typeof RECOMMENDATIONS)[number]["value"]

export function isRecommendation(v: unknown): v is Recommendation {
  return RECOMMENDATIONS.some((r) => r.value === v)
}

export function isScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5
}

export function isScorecardSide(v: unknown): v is ScorecardSide {
  return v === "MANAGER" || v === "HR"
}

/** "custom.client-handling" from "Client handling"; the caller makes it unique. */
export function criterionKeyFor(label: string): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "criterion"
  return `custom.${slug}`
}

/** A criterion in a card's own list (or the company default), hidden ones included. */
export interface CriterionEntry extends ScorecardCriterion {
  isActive: boolean
}

/** A card's stored list, or null when it has none of its own (or it can't be read). */
export function parseCardCriteria(value: unknown): CriterionEntry[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const out: CriterionEntry[] = []
  for (const v of value) {
    const o = (v ?? {}) as Record<string, unknown>
    if (typeof o.key !== "string" || typeof o.label !== "string" || !isScorecardSide(o.side))
      return null
    out.push({ key: o.key, side: o.side, label: o.label, isActive: o.isActive !== false })
  }
  return out
}

/**
 * The list after an edit: the edited items in their new order (new ones get a key no other row
 * of this list has), then any row left out, hidden - never dropped, so its scores keep meaning.
 */
export function applyCriteriaEdit(
  current: readonly CriterionEntry[],
  items: readonly { key: string | null; side: ScorecardSide; label: string; isActive: boolean }[],
): CriterionEntry[] {
  const known = new Set(current.map((c) => c.key))
  const used = new Set<string>()
  const out: CriterionEntry[] = []
  for (const item of items) {
    if (item.key && known.has(item.key) && !used.has(item.key)) {
      used.add(item.key)
      out.push({ key: item.key, side: item.side, label: item.label, isActive: item.isActive })
      continue
    }
    const base = criterionKeyFor(item.label)
    let key = base
    for (let n = 2; known.has(key) || used.has(key); n++) key = `${base}-${n}`
    used.add(key)
    out.push({ key, side: item.side, label: item.label, isActive: item.isActive })
  }
  for (const c of current) if (!used.has(c.key)) out.push({ ...c, isActive: false })
  return out
}

/** The 15 calendar days from the start. Weekends, holidays and leave stay in, shown but unscored. */
export function scorecardDates(start: Date | string): Date[] {
  const first = startOfDayUTC(start)
  return Array.from({ length: SCORECARD_DAYS }, (_, i) => addDays(first, i))
}

export type DayOffKind = "weekend" | "holiday" | "leave"

export interface DayOff {
  kind: DayOffKind
  label: string
}

/** An approved leave, as the scorecard needs it. */
export interface LeaveSpan {
  start: Date | string
  end: Date | string
  totalDays: number
  type: string
}

/**
 * Why a day isn't scored (off), or null for a working day. A holiday wins over a weekend. A
 * part-day leave (half day, short leave) leaves the day scored and comes back as a note.
 */
export function dayStatus(
  date: Date | string,
  holidays: ReadonlyMap<string, string>,
  leaves: readonly LeaveSpan[],
): { off: DayOff | null; note: string | null } {
  const key = toDateOnly(date)
  const holiday = holidays.get(key)
  if (holiday) return { off: { kind: "holiday", label: `Holiday · ${holiday}` }, note: null }
  if (isWeekend(date)) return { off: { kind: "weekend", label: "Weekend" }, note: null }
  const leave = leaves.find((l) => toDateOnly(l.start) <= key && key <= toDateOnly(l.end))
  if (!leave) return { off: null, note: null }
  if (toDateOnly(leave.start) === toDateOnly(leave.end) && leave.totalDays < 1) {
    const part = leave.totalDays <= 0.25 ? "Short leave" : "Half-day leave"
    return { off: null, note: `${part} · ${leave.type}` }
  }
  return { off: { kind: "leave", label: `On leave · ${leave.type}` }, note: null }
}

/** Mean of the values that are there; null when none are. */
function mean(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number")
  if (present.length === 0) return null
  return present.reduce((a, b) => a + b, 0) / present.length
}

export const criteriaFor = (criteria: readonly ScorecardCriterion[], side: ScorecardSide) =>
  criteria.filter((c) => c.side === side)

/** A side's average uses whatever scores it has; overall = mean of the side averages (equal weight). */
export function dayAverages(
  day: DayScores,
  criteria: readonly ScorecardCriterion[] = SCORECARD_CRITERIA,
) {
  const manager = mean(criteriaFor(criteria, "MANAGER").map((c) => day[c.key]))
  const hr = mean(criteriaFor(criteria, "HR").map((c) => day[c.key]))
  return { manager, hr, overall: mean([manager, hr]) }
}

export function scorecardSummary(
  days: DayScores[],
  criteria: readonly ScorecardCriterion[] = SCORECARD_CRITERIA,
) {
  const daily = days.map((d) => dayAverages(d, criteria))
  const manager = mean(daily.map((d) => d.manager))
  const hr = mean(daily.map((d) => d.hr))
  const overall = mean([manager, hr])
  const scoredDays = daily.filter((d) => d.overall !== null).length
  return { manager, hr, overall, rating: ratingFor(overall), scoredDays }
}

/** The scoring-guide entry an average lands on (rounded to the nearest whole score). */
export function ratingFor(score: number | null) {
  if (score === null) return null
  const rounded = Math.min(5, Math.max(1, Math.round(score)))
  return SCORING_GUIDE.find((g) => g.score === rounded) ?? null
}

/** "4.3" - one decimal, or "-" when there is nothing to average. */
export function formatScore(score: number | null): string {
  return score === null ? "-" : (Math.round(score * 10) / 10).toFixed(1)
}
