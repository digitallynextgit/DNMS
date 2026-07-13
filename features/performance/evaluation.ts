// =============================================================================
// Performance-evaluation scoring (the Digitally Next / BFG scorecard).
//
// Two evaluators fill the same scorecard independently:
//   • the employee (SELF) and the reviewing manager (MANAGER).
// Each side has its OWN list of KPIs/parameters (they can differ per person),
// split into two sections:
//   • Section A - Role Performance (KRA & KPI)         → 60% of the score
//   • Section B - Workplace Discipline & Execution      → 40% of the score
// Weights are auto equal-split inside each section (A = 60/countA per KPI,
// B = 40/countB per parameter), so 6 KPIs = 10% each, 5 parameters = 8% each -
// exactly like the source sheet.
//
// A reviewer rates each item 1..5; weighted points = weight × (rating ÷ 5).
// Section A points + Section B points = that side's score out of 100.
// The OFFICIAL final score is the MANAGER's weighted total; the employee's
// self-score is shown alongside for comparison only.
// =============================================================================

export type EvalSection = "A" | "B"
export type EvalEvaluator = "SELF" | "MANAGER"

/** A single scored line (snapshotted onto an evaluation with its weight). */
export interface EvalCriterion {
  id: string
  section: EvalSection
  label: string
  weight: number // percentage points (auto equal-split within the section)
  description?: string | null
}

/** A KPI/parameter as stored on an employee's reusable profile (no weight). */
export interface PerfKpiInput {
  section: EvalSection
  evaluator: EvalEvaluator
  label: string
  description?: string | null
}

export interface PerfKpiItem extends PerfKpiInput {
  id: string
  order: number
}

export type EvalRatings = Record<string, number> // criterionId -> 1..5

export const RATING_LABELS = [
  "Unacceptable",
  "Needs Improvement",
  "Meets Expectation",
  "Exceeds Expectation",
  "Outstanding",
] as const

export const SECTION_A_WEIGHT = 60
export const SECTION_B_WEIGHT = 40

export const DEFAULT_SECTION_A_LABEL = "Role Performance (KRA & KPI)"
export const DEFAULT_SECTION_B_LABEL = "Workplace Discipline & Execution Effectiveness"

// The starter scorecard from the provided sheet. Manager Section A KPIs differ
// from the employee's self KPIs; Section B parameters match on both sides.
// HR tweaks these per employee - this is only the "Load defaults" seed.
export const DEFAULT_KPI_PROFILE: PerfKpiInput[] = [
  // ── Manager - Section A (Role Performance / KRA & KPI) ──
  { evaluator: "MANAGER", section: "A", label: "Project Delivery Efficiency" },
  { evaluator: "MANAGER", section: "A", label: "Technical Quality Score" },
  { evaluator: "MANAGER", section: "A", label: "Client Feedback & Collaboration" },
  { evaluator: "MANAGER", section: "A", label: "Team Mentorship & Contribution" },
  { evaluator: "MANAGER", section: "A", label: "Cost and Resource Alignment" },
  { evaluator: "MANAGER", section: "A", label: "Market Response Metrics" },
  // ── Manager - Section B (Workplace Discipline & Execution) ──
  { evaluator: "MANAGER", section: "B", label: "Task Closure & Accountability" },
  { evaluator: "MANAGER", section: "B", label: "Proactive Work Communication" },
  { evaluator: "MANAGER", section: "B", label: "Adaptability & Improvement Orientation" },
  { evaluator: "MANAGER", section: "B", label: "Situational Handling & Solution Orientation" },
  { evaluator: "MANAGER", section: "B", label: "Workplace timings and Professional conduct" },
  // ── Self - Section A (Role Performance / KRA & KPI) ──
  { evaluator: "SELF", section: "A", label: "Timeliness of task and module deliveries" },
  {
    evaluator: "SELF",
    section: "A",
    label: "Functional accuracy and stability of implementations",
  },
  { evaluator: "SELF", section: "A", label: "Adherence to design, brand, and platform guidelines" },
  { evaluator: "SELF", section: "A", label: "Rework, bug recurrence, and revision frequency" },
  {
    evaluator: "SELF",
    section: "A",
    label: "Website performance, responsiveness, and compatibility",
  },
  {
    evaluator: "SELF",
    section: "A",
    label: "Innovation contribution through research or suggestions",
  },
  // ── Self - Section B (Workplace Discipline & Execution) ──
  { evaluator: "SELF", section: "B", label: "Task Closure & Accountability" },
  { evaluator: "SELF", section: "B", label: "Proactive Work Communication" },
  { evaluator: "SELF", section: "B", label: "Adaptability & Improvement Orientation" },
  { evaluator: "SELF", section: "B", label: "Situational Handling & Solution Orientation" },
  { evaluator: "SELF", section: "B", label: "Workplace timings and Professional conduct" },
]

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Turn one evaluator's profile items into weighted criteria for a scorecard.
 * Weights are equal-split within each section (A → 60, B → 40).
 */
export function buildCriteria(
  items: Array<{ id: string; section: EvalSection; label: string; description?: string | null }>,
  evaluator?: EvalEvaluator,
  filter?: (i: { section: EvalSection }) => boolean,
): EvalCriterion[] {
  void evaluator
  const chosen = filter ? items.filter(filter) : items
  const countA = chosen.filter((i) => i.section === "A").length
  const countB = chosen.filter((i) => i.section === "B").length
  return chosen.map((i) => ({
    id: i.id,
    section: i.section,
    label: i.label,
    description: i.description ?? null,
    weight:
      i.section === "A"
        ? countA > 0
          ? SECTION_A_WEIGHT / countA
          : 0
        : countB > 0
          ? SECTION_B_WEIGHT / countB
          : 0,
  }))
}

export interface EvalScore {
  sectionA: number
  sectionB: number
  total: number
  perCriterion: Record<string, number> // weighted points per criterion
  maxTotal: number
}

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
