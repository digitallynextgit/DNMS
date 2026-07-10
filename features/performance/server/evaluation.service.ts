import "server-only"
import { db } from "@/server/db"
import {
  DEFAULT_KPI_PROFILE,
  buildCriteria,
  type EvalCriterion,
  type EvalEvaluator,
  type EvalSection,
} from "../evaluation"

// Snapshot both sides' weighted criteria for an employee, sourced from their
// PerfKpi profile. Any side with no configured items falls back to the sheet
// defaults, so an evaluation always has something to fill.
export async function buildEvaluationCriteria(employeeId: string): Promise<{
  selfCriteria: EvalCriterion[]
  managerCriteria: EvalCriterion[]
}> {
  const items = await db.perfKpi.findMany({
    where: { employeeId },
    orderBy: [{ section: "asc" }, { order: "asc" }],
    select: { id: true, evaluator: true, section: true, label: true, description: true },
  })

  const forSide = (side: EvalEvaluator): EvalCriterion[] => {
    const rows = items.filter((i) => i.evaluator === side)
    if (rows.length > 0) {
      return buildCriteria(
        rows.map((r) => ({
          id: r.id,
          section: r.section as EvalSection,
          label: r.label,
          description: r.description,
        })),
      )
    }
    // Fallback: the built-in sheet defaults with deterministic ids.
    const defs = DEFAULT_KPI_PROFILE.filter((d) => d.evaluator === side)
    return buildCriteria(
      defs.map((d, idx) => ({
        id: `def-${side.toLowerCase()}-${d.section}-${idx + 1}`,
        section: d.section,
        label: d.label,
        description: d.description ?? null,
      })),
    )
  }

  return { selfCriteria: forSide("SELF"), managerCriteria: forSide("MANAGER") }
}
