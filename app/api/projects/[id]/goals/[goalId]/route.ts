import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess, canManageProject } from "@/features/projects/server/project-access"
import { updateGoal, deleteGoal, setGoalActive } from "@/features/projects/server/goals.service"
import { AppError } from "@/lib/errors"

// The service checks the goal belongs to this project, so another project's goal id is a 404.
export const dynamic = "force-dynamic"

async function requireManager(session: Session, projectId: string) {
  return canManageProject(session, projectId)
}

export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    if (!(await requireManager(session, projectId))) {
      return NextResponse.json({ error: "Only project managers can edit goals" }, { status: 403 })
    }
    try {
      const body = await req.json().catch(() => ({}))
      await updateGoal(projectId, ctx.params.goalId!, body, session.user.id ?? null)
      return NextResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)

export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    if (!(await requireManager(session, projectId))) {
      return NextResponse.json({ error: "Only project managers can delete goals" }, { status: 403 })
    }
    try {
      // Defaults to deactivate; only ?permanent=1 destroys the goal and its history.
      const permanent = _req.nextUrl.searchParams.get("permanent") === "1"
      if (permanent) {
        await deleteGoal(projectId, ctx.params.goalId!)
      } else {
        const reason = _req.nextUrl.searchParams.get("reason")
        await setGoalActive(projectId, ctx.params.goalId!, false, session.user.id ?? null, reason)
      }
      return NextResponse.json({ ok: true, permanent })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
