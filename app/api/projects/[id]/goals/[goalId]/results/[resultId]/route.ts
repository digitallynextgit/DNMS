import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { deleteGoalResult } from "@/features/projects/server/goal-metrics.service"
import { AppError } from "@/lib/errors"

// A wrong number is removed by whoever entered it, or a manager; the goal's history keeps it.
export const dynamic = "force-dynamic"

export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      await deleteGoalResult(session, ctx.params.id!, ctx.params.goalId!, ctx.params.resultId!)
      return NextResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
