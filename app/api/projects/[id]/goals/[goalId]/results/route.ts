import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { addGoalResult } from "@/features/projects/server/goal-metrics.service"
import { AppError } from "@/lib/errors"

// The service decides who may enter a number: the goal's owner, its service's owners, or a manager.
export const dynamic = "force-dynamic"

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = (await req.json().catch(() => ({}))) as {
        value?: unknown
        recordedFor?: unknown
        note?: unknown
      }
      const result = await addGoalResult(session, ctx.params.id!, ctx.params.goalId!, body)
      return NextResponse.json({ data: result }, { status: 201 })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
