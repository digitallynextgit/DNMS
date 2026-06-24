import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import { validateCriteria, type EvalCriterion } from "@/features/performance/evaluation"
import type { Session } from "next-auth"

// PATCH - update a template's name / criteria / section labels (HR).
export const PATCH = withAuth(
  PERMISSIONS.PERFORMANCE_REVIEW,
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id } = ctx.params
    const existing = await db.evaluationTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 })

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })

    const { name, criteria, sectionALabel, sectionBLabel } = body

    if (criteria !== undefined) {
      const v = validateCriteria(criteria as EvalCriterion[])
      if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 422 })
    }

    const updated = await db.evaluationTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(criteria !== undefined && { criteria }),
        ...(sectionALabel !== undefined && { sectionALabel: String(sectionALabel).trim() }),
        ...(sectionBLabel !== undefined && { sectionBLabel: String(sectionBLabel).trim() }),
      },
    })

    await createAuditLog(session, {
      action: "evaluation_template.update",
      module: "performance",
      entityType: "EvaluationTemplate",
      entityId: id,
    })

    return NextResponse.json({ data: updated })
  },
)
