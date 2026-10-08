import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

// `replyId` targets a reply; omit it for the opening post (exactly one column is ever set).
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, messageId } = await ctx.params
      const { emoji, replyId } = (await req.json()) as { emoji?: string; replyId?: string }
      const clean = (emoji ?? "").trim().slice(0, 16)
      if (!clean) return NextResponse.json({ error: "An emoji is required" }, { status: 400 })

      const me = session.user.id

      // messageId is client-supplied: check the thread belongs to this project first.
      const message = await db.projectMessage.findFirst({
        where: { id: messageId, projectId },
        select: { id: true },
      })
      if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

      // Likewise check the reply belongs to this thread.
      if (replyId) {
        const reply = await db.projectMessageReply.findFirst({
          where: { id: replyId, messageId },
          select: { id: true },
        })
        if (!reply) return NextResponse.json({ error: "Reply not found" }, { status: 404 })
      }

      const where = replyId
        ? { replyId_employeeId_emoji: { replyId, employeeId: me, emoji: clean } }
        : { messageId_employeeId_emoji: { messageId, employeeId: me, emoji: clean } }

      const existing = await db.projectMessageReaction.findUnique({
        where,
        select: { id: true },
      })
      // Tolerate the double-tap race: deleteMany accepts 0 rows and a duplicate create's P2002 is swallowed.
      if (existing) {
        await db.projectMessageReaction.deleteMany({
          where: replyId
            ? { replyId, employeeId: me, emoji: clean }
            : { messageId, employeeId: me, emoji: clean },
        })
      } else {
        try {
          await db.projectMessageReaction.create({
            data: {
              messageId: replyId ? null : messageId,
              replyId: replyId ?? null,
              employeeId: me,
              emoji: clean,
            },
          })
        } catch (e) {
          if ((e as { code?: string }).code !== "P2002") throw e
        }
      }

      return NextResponse.json({ data: { emoji: clean, on: !existing } })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_REACT_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
