import "server-only"
import { db } from "@/server/db"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import { requirePermission, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import {
  DEFAULT_KPI_PROFILE,
  buildCriteria,
  type EvalCriterion,
  type EvalEvaluator,
  type EvalSection,
} from "../evaluation"

// Snapshot both sides' weighted criteria; a side with no PerfKpi items falls back to the sheet defaults.
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

export async function bulkDeleteEvaluations(
  ids: string[],
): Promise<ActionResult<{ deleted: number }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.PERFORMANCE_REVIEW)
    const list = Array.from(new Set(Array.isArray(ids) ? ids : [])).filter(
      (id) => typeof id === "string" && id.length > 0,
    )
    if (list.length === 0 || list.length > 500) return fail("Select between 1 and 500 evaluations")

    const res = await db.evaluation.deleteMany({ where: { id: { in: list } } })
    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "evaluation.bulk_delete",
      module: "performance",
      entityType: "Evaluation",
      changes: { count: res.count, evaluationIds: list },
      ...meta,
    })
    return ok({ deleted: res.count })
  })
}
