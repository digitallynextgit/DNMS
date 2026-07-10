import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { EvalEvaluator, EvalSection } from "@/features/performance/evaluation"
import type { Session } from "next-auth"

// Per-employee KPI / parameter PROFILE (the reusable list snapshotted onto each
// new evaluation). HR only (performance:review).

const isSide = (v: unknown): v is EvalEvaluator => v === "SELF" || v === "MANAGER"
const isSection = (v: unknown): v is EvalSection => v === "A" || v === "B"

// GET - the employee's profile items (both sides) + employee summary.
export const GET = withAuth(
  PERMISSIONS.PERFORMANCE_REVIEW,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const employeeId = ctx.params.employeeId
    const [employee, items] = await Promise.all([
      db.employee.findUnique({ where: { id: employeeId }, select: EMPLOYEE_SUMMARY_SELECT }),
      db.perfKpi.findMany({
        where: { employeeId },
        orderBy: [{ evaluator: "asc" }, { section: "asc" }, { order: "asc" }],
        select: {
          id: true,
          evaluator: true,
          section: true,
          label: true,
          description: true,
          order: true,
        },
      }),
    ])
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    return NextResponse.json({ data: { employee, items } })
  },
)

// PUT - replace the employee's entire profile in one shot.
// body: { items: [{ evaluator, section, label, description? }] }
export const PUT = withAuth(
  PERMISSIONS.PERFORMANCE_REVIEW,
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const employeeId = ctx.params.employeeId
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    })
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 })
    }

    // Normalise + validate. Order is assigned per (evaluator, section) group.
    const counters = new Map<string, number>()
    const rows: {
      employeeId: string
      evaluator: EvalEvaluator
      section: EvalSection
      label: string
      description: string | null
      order: number
    }[] = []
    for (const raw of body.items as unknown[]) {
      const it = raw as Record<string, unknown>
      const label = typeof it.label === "string" ? it.label.trim() : ""
      if (!label) continue
      if (!isSide(it.evaluator) || !isSection(it.section)) {
        return NextResponse.json(
          { error: "Each item needs evaluator (SELF|MANAGER) and section (A|B)" },
          { status: 422 },
        )
      }
      const key = `${it.evaluator}:${it.section}`
      const order = counters.get(key) ?? 0
      counters.set(key, order + 1)
      rows.push({
        employeeId,
        evaluator: it.evaluator,
        section: it.section,
        label,
        description:
          typeof it.description === "string" && it.description.trim()
            ? it.description.trim()
            : null,
        order,
      })
    }

    // Replace-all in a transaction.
    await db.$transaction([
      db.perfKpi.deleteMany({ where: { employeeId } }),
      ...(rows.length ? [db.perfKpi.createMany({ data: rows })] : []),
    ])

    await createAuditLog(session, {
      action: "perf_kpi_profile.update",
      module: "performance",
      entityType: "PerfKpi",
      entityId: employeeId,
      changes: { count: rows.length },
    })

    const items = await db.perfKpi.findMany({
      where: { employeeId },
      orderBy: [{ evaluator: "asc" }, { section: "asc" }, { order: "asc" }],
      select: {
        id: true,
        evaluator: true,
        section: true,
        label: true,
        description: true,
        order: true,
      },
    })
    return NextResponse.json({ data: { items } })
  },
)
