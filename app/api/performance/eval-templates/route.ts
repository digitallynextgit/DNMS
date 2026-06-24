import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import {
  validateCriteria,
  DEFAULT_EVALUATION_CRITERIA,
  DEFAULT_SECTION_A_LABEL,
  DEFAULT_SECTION_B_LABEL,
  type EvalCriterion,
} from "@/features/performance/evaluation"
import type { Session } from "next-auth"

// GET - list evaluation templates (HR). Also returns the built-in defaults so the
// editor can seed the first template from the standard BFG scorecard.
export const GET = withAuth(PERMISSIONS.PERFORMANCE_REVIEW, async () => {
  const templates = await db.evaluationTemplate.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  })
  return NextResponse.json({
    data: templates,
    defaults: {
      criteria: DEFAULT_EVALUATION_CRITERIA,
      sectionALabel: DEFAULT_SECTION_A_LABEL,
      sectionBLabel: DEFAULT_SECTION_B_LABEL,
    },
  })
})

// POST - create a template (HR). New template becomes the active one.
export const POST = withAuth(
  PERMISSIONS.PERFORMANCE_REVIEW,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })

    const { name, criteria, sectionALabel, sectionBLabel } = body
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const v = validateCriteria(criteria as EvalCriterion[])
    if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 422 })

    // Only one active template at a time.
    await db.evaluationTemplate.updateMany({ where: { isActive: true }, data: { isActive: false } })

    const template = await db.evaluationTemplate.create({
      data: {
        name: name.trim(),
        criteria,
        sectionALabel: sectionALabel?.trim() || DEFAULT_SECTION_A_LABEL,
        sectionBLabel: sectionBLabel?.trim() || DEFAULT_SECTION_B_LABEL,
        isActive: true,
        createdById: session.user.id,
      },
    })

    await createAuditLog(session, {
      action: "evaluation_template.create",
      module: "performance",
      entityType: "EvaluationTemplate",
      entityId: template.id,
      changes: { name: template.name, criteriaCount: (criteria as EvalCriterion[]).length },
    })

    return NextResponse.json({ data: template }, { status: 201 })
  },
)
