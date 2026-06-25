import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"
import {
  DEFAULT_EVALUATION_CRITERIA,
  DEFAULT_SECTION_A_LABEL,
  DEFAULT_SECTION_B_LABEL,
} from "@/features/performance/evaluation"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { Session } from "next-auth"

const employeeSelect = {
  select: EMPLOYEE_SUMMARY_SELECT,
}

// GET - list evaluations. HR (performance:review) sees all; everyone else sees
// the ones they must act on: their own self-evaluations + ones they manage.
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const canReview = hasPermission(session, PERMISSIONS.PERFORMANCE_REVIEW)
      const { searchParams } = new URL(req.url)
      const status = searchParams.get("status") || undefined

      // Pagination: 1-indexed page, fixed slot size of 10 (clamped).
      const { page, limit, skip, take } = resolvePagination(
        { page: searchParams.get("page"), limit: searchParams.get("limit") },
        10,
      )

      const where: Record<string, unknown> = {}
      if (status) where.status = status
      if (!canReview) {
        where.OR = [
          { employeeId: session.user.id },
          { managerId: session.user.id },
          { controllerId: session.user.id },
        ]
      }

      const [evaluations, total] = await Promise.all([
        db.evaluation.findMany({
          where,
          include: {
            employee: employeeSelect,
            manager: employeeSelect,
            controller: employeeSelect,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        db.evaluation.count({ where }),
      ])

      return NextResponse.json({
        data: evaluations,
        pagination: paginationMeta(total, page, limit),
      })
    } catch (error) {
      console.error("[evaluations] GET error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST - create an evaluation for an employee (HR). Snapshots the active
// template's criteria, then notifies the employee + manager to fill it.
export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      if (!hasPermission(session, PERMISSIONS.PERFORMANCE_REVIEW)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const body = await req.json().catch(() => null)
      if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })

      const {
        employeeId,
        managerId,
        controllerId,
        periodLabel,
        periodStart,
        periodEnd,
        dueDate,
        templateId,
      } = body
      if (!employeeId || !periodLabel?.trim()) {
        return NextResponse.json(
          { error: "employeeId and periodLabel are required" },
          { status: 400 },
        )
      }

      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, managerId: true, firstName: true },
      })
      if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

      // Resolve the criteria snapshot: explicit template → active template → defaults.
      const template = templateId
        ? await db.evaluationTemplate.findUnique({ where: { id: templateId } })
        : await db.evaluationTemplate.findFirst({ where: { isActive: true } })

      const criteria = template?.criteria ?? DEFAULT_EVALUATION_CRITERIA
      const sectionALabel = template?.sectionALabel ?? DEFAULT_SECTION_A_LABEL
      const sectionBLabel = template?.sectionBLabel ?? DEFAULT_SECTION_B_LABEL
      const resolvedManagerId = managerId || employee.managerId || null

      const evaluation = await db.evaluation.create({
        data: {
          templateId: template?.id ?? null,
          criteria: criteria as object,
          sectionALabel,
          sectionBLabel,
          employeeId,
          managerId: resolvedManagerId,
          controllerId: controllerId || null,
          periodLabel: periodLabel.trim(),
          periodStart: periodStart ? new Date(periodStart) : null,
          periodEnd: periodEnd ? new Date(periodEnd) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: "PENDING",
          createdById: session.user.id,
        },
      })

      // Nudge both fillers.
      const link = `/performance/evaluations/${evaluation.id}`
      await createNotification({
        employeeId,
        title: "Performance evaluation to complete",
        message: `Please fill your self-evaluation for ${periodLabel.trim()}.`,
        type: "info",
        link,
      })
      if (resolvedManagerId && resolvedManagerId !== employeeId) {
        await createNotification({
          employeeId: resolvedManagerId,
          title: "Performance evaluation to review",
          message: `Please complete the manager review for ${employee.firstName} (${periodLabel.trim()}).`,
          type: "info",
          link,
        })
      }
      if (controllerId && controllerId !== employeeId && controllerId !== resolvedManagerId) {
        await createNotification({
          employeeId: controllerId,
          title: "Performance evaluation to review",
          message: `Please complete the project controller review for ${employee.firstName} (${periodLabel.trim()}).`,
          type: "info",
          link,
        })
      }

      await createAuditLog(session, {
        action: "evaluation.create",
        module: "performance",
        entityType: "Evaluation",
        entityId: evaluation.id,
        changes: { employeeId, periodLabel: periodLabel.trim() },
      })

      return NextResponse.json({ data: evaluation }, { status: 201 })
    } catch (error) {
      console.error("[evaluations] POST error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
