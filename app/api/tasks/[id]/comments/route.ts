import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { canAccessTask } from "@/features/projects/server/project-access"
import { logActivity } from "@/features/projects/server/activity"
import type { Session } from "next-auth"

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePhoto: true,
  designation: { select: { title: true } },
}

export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }, _session: Session) => {
    try {
      const { id: taskId } = await ctx.params
      // taskId is caller-chosen, so check they may see this task's project.
      if (!(await canAccessTask(_session, taskId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      const comments = await db.taskComment.findMany({
        where: { taskId },
        orderBy: { createdAt: "asc" },
        include: { author: { select: AUTHOR_SELECT } },
      })
      return NextResponse.json({ data: comments })
    } catch (error) {
      console.error("[TASK_COMMENTS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withSession(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }, session: Session) => {
    try {
      const { id: taskId } = await ctx.params
      const task = await db.projectTask.findUnique({
        where: { id: taskId },
        select: { id: true, projectId: true, title: true },
      })
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })
      if (!(await canAccessTask(session, taskId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }

      const body = await req.json()
      const content = body.content?.trim()
      if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 })

      const comment = await db.taskComment.create({
        data: { taskId, authorId: session.user.id, content },
        include: { author: { select: AUTHOR_SELECT } },
      })

      // Adhoc work has no project, so there is no feed to write to.
      if (task.projectId) {
        await logActivity({
          projectId: task.projectId,
          actorId: session.user.id,
          type: "COMMENT_ADDED",
          entityType: "TASK",
          entityId: taskId,
          meta: { taskTitle: task.title, commentId: comment.id },
        })
      }

      return NextResponse.json({ data: comment }, { status: 201 })
    } catch (error) {
      console.error("[TASK_COMMENTS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
