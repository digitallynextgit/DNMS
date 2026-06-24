import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { logActivity } from "@/features/projects/server/activity"
import type { Session } from "next-auth"

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePhoto: true,
  designation: { select: { title: true } },
}

// GET /api/tasks/[id]/comments
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }, _session: Session) => {
    try {
      const { id: taskId } = await ctx.params
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

// POST /api/tasks/[id]/comments
export const POST = withSession(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }, session: Session) => {
    try {
      const { id: taskId } = await ctx.params
      const task = await db.projectTask.findUnique({
        where: { id: taskId },
        select: { id: true, projectId: true, title: true },
      })
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

      const body = await req.json()
      const content = body.content?.trim()
      if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 })

      const comment = await db.taskComment.create({
        data: { taskId, authorId: session.user.id, content },
        include: { author: { select: AUTHOR_SELECT } },
      })

      await logActivity({
        projectId: task.projectId,
        actorId: session.user.id,
        type: "COMMENT_ADDED",
        entityType: "TASK",
        entityId: taskId,
        meta: { taskTitle: task.title, commentId: comment.id },
      })

      return NextResponse.json({ data: comment }, { status: 201 })
    } catch (error) {
      console.error("[TASK_COMMENTS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
