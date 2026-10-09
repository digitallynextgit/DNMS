// Scorecard: SELF and MANAGER rate the same KPIs 1..5. Section A = 60%, B = 40%, each split
// equally across its items; points = weight × (rating ÷ 5). The OFFICIAL score is the MANAGER's
// total; the self-score is shown for comparison only.

export type EvalSection = "A" | "B"
export type EvalEvaluator = "SELF" | "MANAGER"

/** A single scored line (snapshotted onto an evaluation with its weight). */
export interface EvalCriterion {
  id: string
  section: EvalSection
  label: string
  weight: number // percentage points
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

export const DEFAULT_SECTION_A_LABEL = "Role Performance (KPI)"
export const DEFAULT_SECTION_B_LABEL = "Workplace Discipline & Execution Effectiveness"

/** A profile's KPIs and parameters, rated by both the manager and the employee. */
export type PerfKpiLine = Omit<PerfKpiInput, "evaluator">

// Starter "Load defaults" seed; HR tweaks it per employee.
export const DEFAULT_KPI_LINES: PerfKpiLine[] = [
  { section: "A", label: "Project Delivery Efficiency" },
  { section: "A", label: "Technical Quality Score" },
  { section: "A", label: "Client Feedback & Collaboration" },
  { section: "A", label: "Team Mentorship & Contribution" },
  { section: "A", label: "Cost and Resource Alignment" },
  { section: "A", label: "Market Response Metrics" },
  { section: "B", label: "Task Closure & Accountability" },
  { section: "B", label: "Proactive Work Communication" },
  { section: "B", label: "Adaptability & Improvement Orientation" },
  { section: "B", label: "Situational Handling & Solution Orientation" },
  { section: "B", label: "Workplace timings and Professional conduct" },
]

/** The employee self-rates the exact list the manager rates. */
export function forBothSides(lines: readonly PerfKpiLine[]): PerfKpiInput[] {
  return (["MANAGER", "SELF"] as const).flatMap((evaluator) =>
    lines.map((l) => ({ ...l, evaluator })),
  )
}

export const DEFAULT_KPI_PROFILE: PerfKpiInput[] = forBothSides(DEFAULT_KPI_LINES)

const round1 = (n: number) => Math.round(n * 10) / 10

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
  perCriterion: Record<string, number>
  maxTotal: number
}

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

export function isRatingComplete(
  criteria: EvalCriterion[],
  ratings: EvalRatings | null | undefined,
): boolean {
  const r = ratings ?? {}
  return criteria.length > 0 && criteria.every((c) => Number(r[c.id]) >= 1 && Number(r[c.id]) <= 5)
}
