import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { db } from "@/server/db"
import { withProjectAccess, canStaffTeam } from "@/features/projects/server/project-access"
import { logActivity } from "@/features/projects/server/activity"

// Team managers may link tasks too - breaking a goal into work is planning, not promising.
// Tasks from other projects are ignored, so a stale selection can't fail the batch.
export const dynamic = "force-dynamic"

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    if (!(await canStaffTeam(session, projectId))) {
      return NextResponse.json(
        { error: "Only a project admin, the Account Manager or a team manager can do this" },
        { status: 403 },
      )
    }
    const goal = await db.projectGoal.findFirst({
      where: { id: ctx.params.goalId!, projectId },
      select: { id: true, title: true },
    })
    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body.taskIds)
      ? body.taskIds.filter((x: unknown) => typeof x === "string").slice(0, 200)
      : []
    if (ids.length === 0) return NextResponse.json({ error: "No tasks given" }, { status: 400 })

    const { count } = await db.projectTask.updateMany({
      where: { id: { in: ids }, projectId },
      data: { goalId: goal.id },
    })

    if (count > 0) {
      await logActivity({
        projectId,
        actorId: session.user.id,
        type: "TASK_UPDATED",
        entityType: "GOAL",
        entityId: goal.id,
        meta: { goalTitle: goal.title, linkedTasks: count },
      })
    }
    return NextResponse.json({ data: { linked: count } })
  },
)
