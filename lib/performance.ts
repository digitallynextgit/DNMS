// =============================================================================
// Performance action map (BFG 6-tier). Ratings in HRMS are 1–5; the policy bands
// are on a 0–100 scale, so a 1–5 rating is scaled ×20.
// =============================================================================

export interface PerformanceAction {
  band: string
  action: string
  tone: "red" | "amber" | "blue" | "green"
}

export function performanceAction(score: number | null | undefined): PerformanceAction | null {
  if (score == null) return null
  const pct = score <= 5 ? score * 20 : score
  if (pct < 65)
    return { band: "Below 65", action: "1-week PIP → exit if no improvement", tone: "red" }
  if (pct < 75) return { band: "65–75", action: "2-week PIP → exit if no improvement", tone: "red" }
  if (pct < 85) return { band: "75–85", action: "No increment + 1-month review", tone: "amber" }
  if (pct < 90) return { band: "85–90", action: "Increment only", tone: "blue" }
  if (pct < 95) return { band: "90–95", action: "Increment + promotion", tone: "green" }
  return {
    band: "95+",
    action: "Fast-track promotion within 6 months + mid-year eligibility",
    tone: "green",
  }
}
