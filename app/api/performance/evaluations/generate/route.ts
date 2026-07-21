import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"
import { DEFAULT_SECTION_A_LABEL, DEFAULT_SECTION_B_LABEL } from "@/features/performance/evaluation"
import { buildEvaluationCriteria } from "@/features/performance/server/evaluation.service"
import type { Session } from "next-auth"

// POST /api/performance/evaluations/generate
// Create TODAY's performance evaluation for EVERY active employee in one go, and
// notify each employee (and their manager). Idempotent: skips anyone who already
// has an evaluation for today's period, so clicking twice the same day is safe.
export const POST = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      if (!hasPermission(session, PERMISSIONS.PERFORMANCE_REVIEW)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // "Jul 21, 2026" - one batch per day; re-running the same day is a no-op.
      const periodLabel = new Date().toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })

      // Active employees who actually HAVE a KPI profile configured, excluding
      // admins (admin + the invisible admin_ account) - admins aren't evaluated,
      // and anyone without KPIs has nothing meaningful to be scored on.
      const employees = await db.employee.findMany({
        where: {
          isActive: true,
          status: "ACTIVE",
          perfKpis: { some: {} },
          employeeRoles: {
            none: { role: { name: { in: [SYSTEM_ROLES.ADMIN_, SYSTEM_ROLES.ADMIN] } } },
          },
        },
        select: { id: true, managerId: true, firstName: true },
      })

      let created = 0
      let skipped = 0
      for (const emp of employees) {
        const existing = await db.evaluation.findFirst({
          where: { employeeId: emp.id, periodLabel },
          select: { id: true },
        })
        if (existing) {
          skipped++
          continue
        }

        // Snapshot the employee's KPI/parameter profile (self + manager sides).
        const { selfCriteria, managerCriteria } = await buildEvaluationCriteria(emp.id)
        const ev = await db.evaluation.create({
          data: {
            selfCriteria: selfCriteria as object,
            managerCriteria: managerCriteria as object,
            sectionALabel: DEFAULT_SECTION_A_LABEL,
            sectionBLabel: DEFAULT_SECTION_B_LABEL,
            employeeId: emp.id,
            managerId: emp.managerId,
            periodLabel,
            status: "PENDING",
            createdById: session.user.id,
          },
        })
        created++

        const link = `/performance/evaluations/${ev.id}`
        await createNotification({
          employeeId: emp.id,
          title: "Performance evaluation to complete",
          message: `Please fill your self-evaluation for ${periodLabel}.`,
          type: "info",
          link,
        })
        if (emp.managerId && emp.managerId !== emp.id) {
          await createNotification({
            employeeId: emp.managerId,
            title: "Performance evaluation to review",
            message: `Please complete the manager review for ${emp.firstName} (${periodLabel}).`,
            type: "info",
            link,
          })
        }
      }

      await createAuditLog(session, {
        action: "evaluation.generate",
        module: "performance",
        entityType: "Evaluation",
        changes: { periodLabel, created, skipped, total: employees.length },
      })

      return NextResponse.json({
        data: { periodLabel, created, skipped, total: employees.length },
      })
    } catch (error) {
      console.error("[evaluations/generate] POST error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
