import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { canManageProject } from "@/features/projects/server/project-access"
import { getProjectGoals, createGoal } from "@/features/projects/server/goals.service"
import { AppError } from "@/lib/errors"

// Anyone with project access may read; writing is manage-only because a goal is a commitment.
export const dynamic = "force-dynamic"

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    // Deactivated goals are opt-in; they never affect the numbers.
    const includeInactive = _req.nextUrl.searchParams.get("includeInactive") === "1"
    return NextResponse.json(await getProjectGoals(ctx.params.id!, includeInactive))
  },
)

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    if (!(await canManageProject(session, projectId))) {
      return NextResponse.json({ error: "Only project managers can set goals" }, { status: 403 })
    }
    try {
      const body = await req.json().catch(() => ({}))
      const goal = await createGoal(projectId, body, session.user.id ?? null)
      return NextResponse.json(goal, { status: 201 })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
