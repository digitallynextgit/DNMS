import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { db } from "@/server/db"
import { withProjectAccess, canStaffTeam } from "@/features/projects/server/project-access"
import { logActivity } from "@/features/projects/server/activity"

// POST /api/projects/[id]/goals/[goalId]/tasks   { taskIds: string[] }
//
// Link existing tasks to a goal, in bulk. The way a manager sorts the "14 tasks
// on this project aren't tied to any goal" list without opening each one.
//
// TEAM MANAGERS MAY DO THIS TOO. Breaking a goal into work is planning, not
// promising: the Design Lead is the person who knows which of their tasks
// serves "launch the storefront", and making them ask the account manager to
// draw the line is how the unlinked-tasks list stays at fourteen forever. What
// the goal COMMITTED to - its targets, its status, its existence - stays
// manage-only.
//
// Only tasks on THIS project move; ids from elsewhere are ignored rather than
// erroring, so a stale selection cannot fail the whole batch.
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
