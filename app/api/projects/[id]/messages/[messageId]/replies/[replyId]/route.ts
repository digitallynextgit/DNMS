import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

// DELETE /api/projects/[id]/messages/[messageId]/replies/[replyId] - delete own reply.
export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { replyId } = await ctx.params
      const reply = await db.projectMessageReply.findUnique({
        where: { id: replyId },
        select: { id: true, authorId: true },
      })
      if (!reply) return NextResponse.json({ error: "Reply not found" }, { status: 404 })
      if (reply.authorId !== session.user.id) {
        return NextResponse.json({ error: "You can only delete your own replies" }, { status: 403 })
      }
      await db.projectMessageReply.delete({ where: { id: replyId } })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_REPLY_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
