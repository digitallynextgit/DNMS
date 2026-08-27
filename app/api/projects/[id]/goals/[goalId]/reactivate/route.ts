import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess, canManageProject } from "@/features/projects/server/project-access"
import { setGoalActive } from "@/features/projects/server/goals.service"
import { AppError } from "@/lib/errors"

// POST /api/projects/[id]/goals/[goalId]/reactivate
//
// Its own route rather than a PATCH field: reactivating is the undo for a
// destructive-looking action, and it should be as easy to find in the API as it
// is on the screen.
export const dynamic = "force-dynamic"

export const POST = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    if (!(await canManageProject(session, projectId))) {
      return NextResponse.json(
        { error: "Only project managers can restore goals" },
        { status: 403 },
      )
    }
    try {
      await setGoalActive(projectId, ctx.params.goalId!, true, session.user.id ?? null)
      return NextResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
