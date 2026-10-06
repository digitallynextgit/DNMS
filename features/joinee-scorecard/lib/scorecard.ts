// =============================================================================
// The 15-day new-joinee scorecard, as a pure definition: the six criteria from
// HR's sheet, the scoring guide, the recommendation options and every average.
//
// No imports. The service, the API and the page all score with these, so a
// number on screen is always the number the rules give - nothing is stored but
// the raw 1-5 scores.
// =============================================================================

/** How many working days a joinee is scored for. */
export const SCORECARD_DAYS = 15

export type ScorecardSide = "MANAGER" | "HR"

/** The six scores on a day, in sheet order: three by the manager, three by HR. */
export const SCORECARD_CRITERIA = [
  { key: "mgrJobRole", side: "MANAGER", label: "Understanding of Job Role" },
  { key: "mgrCommunication", side: "MANAGER", label: "Communication & Ownership" },
  { key: "mgrLearning", side: "MANAGER", label: "Learning / Collaboration Skills" },
  { key: "hrDiscipline", side: "HR", label: "Discipline & Attendance" },
  { key: "hrCulture", side: "HR", label: "Culture & Collaboration" },
  { key: "hrLearning", side: "HR", label: "Learning / Adaptability" },
] as const

export type ScoreKey = (typeof SCORECARD_CRITERIA)[number]["key"]

export const SCORE_KEYS = SCORECARD_CRITERIA.map((c) => c.key) as ScoreKey[]

/** One day's scores; null = not given yet. */
export type DayScores = Record<ScoreKey, number | null>

/** The sheet's scoring guide, best first. */
export const SCORING_GUIDE = [
  { score: 5, label: "Excellent", description: "Consistently exceeds expectations" },
  { score: 4, label: "Good", description: "Meets expectations well" },
  { score: 3, label: "Average", description: "Meets basic expectations" },
  { score: 2, label: "Needs Improvement", description: "Below expectations" },
  { score: 1, label: "Unsatisfactory", description: "Significant concern" },
] as const

/** HR's 15-day recommendation. */
export const RECOMMENDATIONS = [
  { value: "CONTINUE", label: "Continue as planned" },
  { value: "CONTINUE_WITH_IMPROVEMENTS", label: "Continue with specific improvement areas" },
  { value: "REVIEW_REQUIRED", label: "Review required" },
] as const

export type Recommendation = (typeof RECOMMENDATIONS)[number]["value"]

export function isRecommendation(v: unknown): v is Recommendation {
  return RECOMMENDATIONS.some((r) => r.value === v)
}

/** A valid score: a whole number 1-5. */
export function isScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5
}

/** Mean of the values that are there; null when none are. */
function mean(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number")
  if (present.length === 0) return null
  return present.reduce((a, b) => a + b, 0) / present.length
}

const keysFor = (side: ScorecardSide) =>
  SCORECARD_CRITERIA.filter((c) => c.side === side).map((c) => c.key)

/**
 * One day's three averages, as the sheet's "Manager Avg.", "HR Avg." and
 * "Daily Overall" columns. A side's average uses the scores it has, so a day
 * half-filled still shows something; the overall is the mean of whichever side
 * averages exist, so manager and HR weigh the same whatever was filled.
 */
export function dayAverages(day: DayScores) {
  const manager = mean(keysFor("MANAGER").map((k) => day[k]))
  const hr = mean(keysFor("HR").map((k) => day[k]))
  return { manager, hr, overall: mean([manager, hr]) }
}

/**
 * The 15-day summary: each side's average over the days it scored, the
 * overall score (the two sides weighted equally) and its rating.
 */
export function scorecardSummary(days: DayScores[]) {
  const daily = days.map(dayAverages)
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
