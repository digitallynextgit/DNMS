// 15-day joinee scorecard rules. Only raw 1-5 scores are stored; every average is computed here.

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

/** Mean of the values that are there; null when none are. */
function mean(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number")
  if (present.length === 0) return null
  return present.reduce((a, b) => a + b, 0) / present.length
}

const keysFor = (side: ScorecardSide) =>
  SCORECARD_CRITERIA.filter((c) => c.side === side).map((c) => c.key)

/** A side's average uses whatever scores it has; overall = mean of the side averages (equal weight). */
export function dayAverages(day: DayScores) {
  const manager = mean(keysFor("MANAGER").map((k) => day[k]))
  const hr = mean(keysFor("HR").map((k) => day[k]))
  return { manager, hr, overall: mean([manager, hr]) }
}

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
