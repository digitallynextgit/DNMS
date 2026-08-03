import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { canAccessProject } from "@/features/projects/server/project-access"
import { getTaskTimeline } from "@/features/projects/server/task-status-periods"
import type { Session } from "next-auth"

// GET /api/tasks/[id]/timeline
// Full status history for one task: when it was created, when it started, and
// how long it spent in each status. Readable by anyone who can see the project.
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const task = await db.projectTask.findUnique({
        where: { id: ctx.params.id },
        select: { projectId: true },
      })
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

      if (!(await canAccessProject(session, task.projectId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const timeline = await getTaskTimeline(ctx.params.id)
      return NextResponse.json({ data: timeline })
    } catch (error) {
      console.error("[TASK_TIMELINE_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
