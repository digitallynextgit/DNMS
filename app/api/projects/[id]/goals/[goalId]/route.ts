import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess, canManageProject } from "@/features/projects/server/project-access"
import { updateGoal, deleteGoal, setGoalActive } from "@/features/projects/server/goals.service"
import { AppError } from "@/lib/errors"

// PATCH  /api/projects/[id]/goals/[goalId] - edit title, dates, status, progress
// DELETE /api/projects/[id]/goals/[goalId] - remove it (sub-goals cascade)
//
// Both manage-only. withProjectAccess resolves and authorises the PROJECT; the
// service then checks the goal belongs to it, so a valid goal id from another
// project is a 404 rather than an edit.
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
      // Two different operations behind one button, and the difference is
      // deliberate: the dialog defaults to DEACTIVATE, and only an explicit
      // ?permanent=1 destroys the goal and its history. A misclick should cost
      // a click to undo, not a quarter of context.
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
