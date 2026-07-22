// =============================================================================
// Performance rating scale. Ratings in HRMS are 1–5; the policy bands are on a
// 0–100 scale, so a 1–5 rating is scaled ×20. PERFORMANCE_BANDS is the single
// source of truth - the evaluation verdict and the on-screen scale both use it.
// =============================================================================

export type PerformanceTone = "green" | "amber" | "red"

export interface PerformanceBand {
  /** Inclusive lower bound as a percentage. */
  min: number
  /** Display range, e.g. "90–94%". */
  range: string
  /** Rating label, e.g. "Outstanding Performer". */
  rating: string
  /** Action / outcome. */
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
    range: "90–94%",
    rating: "Outstanding Performer",
    action: "Eligible for Increment + Promotion",
    tone: "green",
  },
  {
    min: 85,
    range: "85–89%",
    rating: "Strong Performer",
    action: "Eligible for Increment only",
    tone: "amber",
  },
  {
    min: 75,
    range: "75–84%",
    rating: "Developing Performer",
    action: "No Increment + 1-Month Review",
    tone: "amber",
  },
  {
    min: 65,
    range: "65–74%",
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
  /** The band's display range (kept for existing callers). */
  band: string
  rating: string
  action: string
  tone: PerformanceTone
}

/** The band an evaluation score falls into (accepts a 1–5 or 0–100 score). */
export function performanceAction(score: number | null | undefined): PerformanceAction | null {
  if (score == null) return null
  const pct = score <= 5 ? score * 20 : score
  const band =
    PERFORMANCE_BANDS.find((b) => pct >= b.min) ?? PERFORMANCE_BANDS[PERFORMANCE_BANDS.length - 1]!
  return { band: band.range, rating: band.rating, action: band.action, tone: band.tone }
}

/** The band that a percentage (0–100) falls into - for highlighting the scale. */
export function bandForPercent(pct: number): PerformanceBand | null {
  return PERFORMANCE_BANDS.find((b) => pct >= b.min) ?? null
}
