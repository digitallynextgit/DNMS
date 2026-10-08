import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { addGoalTarget } from "@/features/projects/server/goal-targets.service"
import { AppError } from "@/lib/errors"

// Manage-only (the service enforces it): what a goal committed to is the account manager's call.
export const dynamic = "force-dynamic"

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json().catch(() => ({}))
      const target = await addGoalTarget(session, ctx.params.id!, ctx.params.goalId!, body)
      return NextResponse.json({ data: target })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
