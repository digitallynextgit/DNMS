import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { removeGoalTarget, updateGoalTarget } from "@/features/projects/server/goal-targets.service"
import { AppError } from "@/lib/errors"

// PATCH  /api/projects/[id]/goals/[goalId]/targets/[targetId] - change it
// DELETE /api/projects/[id]/goals/[goalId]/targets/[targetId] - drop it
//
// Manage-only, and the service checks it. A PATCH sends only what moved:
// omitting a period leaves it alone, sending null clears it, which is the only
// way to turn a dated target back into a standing one. Both write a line to
// the goal's history - a target that quietly changed mid-month is how a goal
// ends up "met" without anyone remembering it was moved.
export const dynamic = "force-dynamic"

export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json().catch(() => ({}))
      const target = await updateGoalTarget(
        session,
        ctx.params.id!,
        ctx.params.goalId!,
        ctx.params.targetId!,
        body,
      )
      return NextResponse.json({ data: target })
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
    try {
      const target = await removeGoalTarget(
        session,
        ctx.params.id!,
        ctx.params.goalId!,
        ctx.params.targetId!,
      )
      return NextResponse.json({ data: target })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
