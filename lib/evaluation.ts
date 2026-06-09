// =============================================================================
// Performance-evaluation scoring (the BFG/Digitally Next 15-day scorecard).
// Each criterion has a weight (percentage points); the six weights of a section
// sum to that section's share, and all weights together sum to 100.
// A reviewer rates each criterion 1..5; weighted points = weight × (rating ÷ 5).
// Section A total + Section B total = final score out of 100.
// =============================================================================

export type EvalSection = "A" | "B"

export interface EvalCriterion {
  id: string
  section: EvalSection
  label: string
  weight: number
}

export type EvalRatings = Record<string, number> // criterionId -> 1..5

export const RATING_LABELS = [
  "Unacceptable",
  "Needs Improvement",
  "Meets Expectation",
  "Exceeds Expectation",
  "Outstanding",
] as const

export const DEFAULT_SECTION_A_LABEL = "Role Performance (KRA & KPI)"
export const DEFAULT_SECTION_B_LABEL = "Workplace Discipline & Execution Effectiveness"

// The exact scorecard from the provided sheet: Section A = 60% (6×8.5 + 1×9),
// Section B = 40% (5×8). Total weight = 100.
export const DEFAULT_EVALUATION_CRITERIA: EvalCriterion[] = [
  { id: "a1", section: "A", label: "Project Delivery Efficiency", weight: 8.5 },
  { id: "a2", section: "A", label: "Technical Quality Score", weight: 8.5 },
  { id: "a3", section: "A", label: "Team Collaboration", weight: 8.5 },
  { id: "a4", section: "A", label: "Rework and Corrections", weight: 8.5 },
  { id: "a5", section: "A", label: "Learning and Adaption", weight: 8.5 },
  { id: "a6", section: "A", label: "Market Response Metrics", weight: 8.5 },
  { id: "a7", section: "A", label: "AI Utilization in Work Processes", weight: 9 },
  { id: "b1", section: "B", label: "Task Closure & Accountability", weight: 8 },
  { id: "b2", section: "B", label: "Proactive Work Communication", weight: 8 },
  { id: "b3", section: "B", label: "Adaptability & Improvement Orientation", weight: 8 },
  { id: "b4", section: "B", label: "Situational Handling & Solution Orientation", weight: 8 },
  { id: "b5", section: "B", label: "Workplace timings and Professional conduct", weight: 8 },
]

export interface EvalScore {
  sectionA: number
  sectionB: number
  total: number
  perCriterion: Record<string, number> // weighted points per criterion
  maxTotal: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Weighted score from one reviewer's ratings: Σ weight × (rating ÷ 5). */
export function scoreEvaluation(
  criteria: EvalCriterion[],
  ratings: EvalRatings | null | undefined,
): EvalScore {
  const r = ratings ?? {}
  const perCriterion: Record<string, number> = {}
  let sectionA = 0
  let sectionB = 0
  let maxTotal = 0
  for (const c of criteria) {
    maxTotal += c.weight
    const rating = Math.min(Math.max(Number(r[c.id]) || 0, 0), 5)
    const pts = (c.weight * rating) / 5
    perCriterion[c.id] = round1(pts)
    if (c.section === "A") sectionA += pts
    else sectionB += pts
  }
  return {
    sectionA: round1(sectionA),
    sectionB: round1(sectionB),
    total: round1(sectionA + sectionB),
    perCriterion,
    maxTotal: round1(maxTotal),
  }
}

/** True when every criterion has a valid 1..5 rating. */
export function isRatingComplete(
  criteria: EvalCriterion[],
  ratings: EvalRatings | null | undefined,
): boolean {
  const r = ratings ?? {}
  return criteria.length > 0 && criteria.every((c) => Number(r[c.id]) >= 1 && Number(r[c.id]) <= 5)
}

/** Validate a criteria set: weights must total ~100 and each section non-empty. */
export function validateCriteria(criteria: EvalCriterion[]): {
  ok: boolean
  totalWeight: number
  reason?: string
} {
  if (!Array.isArray(criteria) || criteria.length === 0)
    return { ok: false, totalWeight: 0, reason: "At least one criterion is required" }
  for (const c of criteria) {
    if (!c.label?.trim())
      return { ok: false, totalWeight: 0, reason: "Every criterion needs a label" }
    if (c.section !== "A" && c.section !== "B")
      return { ok: false, totalWeight: 0, reason: "Criterion section must be A or B" }
    if (!(Number(c.weight) > 0))
      return { ok: false, totalWeight: 0, reason: "Weights must be positive" }
  }
  const totalWeight = round1(criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0))
  if (Math.abs(totalWeight - 100) > 0.5)
    return { ok: false, totalWeight, reason: `Weights must total 100% (currently ${totalWeight}%)` }
  return { ok: true, totalWeight }
}
