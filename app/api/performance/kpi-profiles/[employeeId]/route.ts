import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { EvalEvaluator, EvalSection } from "@/features/performance/evaluation"
import type { Session } from "next-auth"

// The reusable KPI list that is snapshotted onto each new evaluation.

const isSide = (v: unknown): v is EvalEvaluator => v === "SELF" || v === "MANAGER"
const isSection = (v: unknown): v is EvalSection => v === "A" || v === "B"

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

    // One list, rated by both sides: the manager's lines (or, from an old client, the self lines)
    // are saved for MANAGER and copied for SELF.
    const lines: { section: EvalSection; label: string; description: string | null }[] = []
    const input = body.items as Record<string, unknown>[]
    const side = input.some((it) => it?.evaluator === "MANAGER") ? "MANAGER" : "SELF"
    for (const it of input) {
      const label = typeof it?.label === "string" ? it.label.trim() : ""
      if (!label) continue
      if ((it.evaluator !== undefined && !isSide(it.evaluator)) || !isSection(it.section)) {
        return NextResponse.json(
          { error: "Each item needs a section (A|B) and, if given, evaluator (SELF|MANAGER)" },
          { status: 422 },
        )
      }
      if (it.evaluator !== undefined && it.evaluator !== side) continue
      lines.push({
        section: it.section,
        label,
        description:
          typeof it.description === "string" && it.description.trim()
            ? it.description.trim()
            : null,
      })
    }

    const rows = (["MANAGER", "SELF"] as const).flatMap((evaluator) => {
      const counters = { A: 0, B: 0 }
      return lines.map((l) => ({ employeeId, evaluator, ...l, order: counters[l.section]++ }))
    })

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
