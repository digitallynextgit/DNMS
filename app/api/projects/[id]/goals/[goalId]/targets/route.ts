import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { addGoalTarget } from "@/features/projects/server/goal-targets.service"
import { AppError } from "@/lib/errors"

// POST /api/projects/[id]/goals/[goalId]/targets
//   { deliverableType, quantity, periodStart?, periodEnd? }
//
// What this goal PROMISED - "20 reels in September" - as opposed to the work
// planned to get there. Manage-only, like every other goal write: the tasks
// under a goal are the team manager's to plan, but what was committed to is
// the account manager's call. The service enforces that and everything else;
// withProjectAccess only resolves the project and keeps strangers out.
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
