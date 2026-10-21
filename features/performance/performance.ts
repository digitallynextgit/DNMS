// Ratings are 1-5 but the policy bands are 0-100, so a rating is scaled ×20.

export type PerformanceTone = "green" | "amber" | "red"

export interface PerformanceBand {
  /** Inclusive lower bound as a percentage. */
  min: number
  /** Display range, e.g. "90 to 94%". */
  range: string
  /** Rating label, e.g. "Outstanding Performer". */
  rating: string
  action: string
  tone: PerformanceTone
}

// Ordered high → low so `find(pct >= min)` returns the correct band.
export const PERFORMANCE_BANDS: PerformanceBand[] = [
  {
    min: 95,
    range: "95%+",
    rating: "Exceptional Performer",
    action: "Fast-Track Promotion within 6 months",
    tone: "green",
  },
  {
    min: 90,
    range: "90 to 94%",
    rating: "Outstanding Performer",
    action: "Eligible for Increment + Promotion",
    tone: "green",
  },
  {
    min: 85,
    range: "85 to 89%",
    rating: "Strong Performer",
    action: "Eligible for Increment only",
    tone: "amber",
  },
  {
    min: 75,
    range: "75 to 84%",
    rating: "Developing Performer",
    action: "No Increment + 1-Month Review",
    tone: "amber",
  },
  {
    min: 65,
    range: "65 to 74%",
    rating: "Needs Improvement",
    action: "2-Week PIP → Exit if no improvement",
    tone: "red",
  },
  {
    min: 0,
    range: "Below 65%",
    rating: "Unsatisfactory",
    action: "1-Week PIP → Exit if no improvement",
    tone: "red",
  },
]

export interface PerformanceAction {
  band: string
  rating: string
  action: string
  tone: PerformanceTone
}

/**
 * Someone's current rating: their newest evaluation with a score. The manager's score is the
 * official one, so a review counts once the manager has scored it, before the self-review is in.
 * `evaluations` newest first, as the API returns them.
 */
export function latestScored<E extends { finalScore: number | null }>(
  evaluations: readonly E[],
): E | null {
  return evaluations.find((ev) => ev.finalScore != null) ?? null
}

/** A 1 to 5 rating or a 0 to 100 score, as a 0 to 100 percentage. */
export function scorePercent(score: number): number {
  return score <= 5 ? score * 20 : score
}

/** The band an evaluation score falls into (accepts a 1 to 5 or 0 to 100 score). */
export function performanceAction(score: number | null | undefined): PerformanceAction | null {
  if (score == null) return null
  const pct = scorePercent(score)
  const band =
    PERFORMANCE_BANDS.find((b) => pct >= b.min) ?? PERFORMANCE_BANDS[PERFORMANCE_BANDS.length - 1]!
  return { band: band.range, rating: band.rating, action: band.action, tone: band.tone }
}

/** The band that a percentage (0 to 100) falls into - for highlighting the scale. */
export function bandForPercent(pct: number): PerformanceBand | null {
  return PERFORMANCE_BANDS.find((b) => pct >= b.min) ?? null
}

/** The bands from lowest to highest, the way a scale reads left to right. */
export const BANDS_LOW_TO_HIGH: PerformanceBand[] = [...PERFORMANCE_BANDS].reverse()

/**
 * Where a 0 to 100 score sits (0 to 100) on a scale of equal-width bands. Equal widths, because
 * the top bands are only 5 points wide yet are where the outcomes differ.
 */
export function scalePosition(pct: number): number {
  const p = Math.min(100, Math.max(0, pct))
  const n = BANDS_LOW_TO_HIGH.length
  const fromTop = PERFORMANCE_BANDS.findIndex((b) => p >= b.min)
  const i = n - 1 - (fromTop === -1 ? n - 1 : fromTop)
  const lo = BANDS_LOW_TO_HIGH[i]!.min
  const hi = BANDS_LOW_TO_HIGH[i + 1]?.min ?? 100
  return ((i + (p - lo) / (hi - lo)) / n) * 100
}
