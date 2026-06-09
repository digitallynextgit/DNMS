import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession } from "@/lib/permissions"
import type { Session } from "next-auth"

// DELETE /api/tasks/[id]/comments/[commentId]
export const DELETE = withSession(
  async (
    _req: NextRequest,
    ctx: { params: Promise<{ id: string; commentId: string }> },
    session: Session,
  ) => {
    try {
      const { commentId } = await ctx.params
      const comment = await db.taskComment.findUnique({
        where: { id: commentId },
        select: { id: true, authorId: true },
      })
      if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })
      if (comment.authorId !== session.user.id) {
        return NextResponse.json(
          { error: "You can only delete your own comments" },
          { status: 403 },
        )
      }
      await db.taskComment.delete({ where: { id: commentId } })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[TASK_COMMENT_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
