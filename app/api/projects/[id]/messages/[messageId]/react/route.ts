import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

/**
 * POST /api/projects/:id/messages/:messageId/react  { emoji, replyId? }
 *
 * Toggles one emoji for the caller. `replyId` picks a reply; omit it to react to
 * the opening post - exactly one of the two columns is ever set, which is why
 * the lookup below branches rather than passing a possibly-null id into one key.
 *
 * A toggle rather than a set: the client is acting on what it can see, and a
 * stale `on: true` from another tab would fight it. withProjectAccess is the
 * membership check - you cannot react into a project you are not on.
 */
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { messageId } = await ctx.params
      const { emoji, replyId } = (await req.json()) as { emoji?: string; replyId?: string }
      const clean = (emoji ?? "").trim().slice(0, 16)
      if (!clean) return NextResponse.json({ error: "An emoji is required" }, { status: 400 })

      const me = session.user.id

      // Prove the target belongs to THIS thread before writing to it - the id in
      // the URL is just a string somebody could change.
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
      if (existing) {
        await db.projectMessageReaction.delete({ where: { id: existing.id } })
      } else {
        await db.projectMessageReaction.create({
          data: {
            messageId: replyId ? null : messageId,
            replyId: replyId ?? null,
            employeeId: me,
            emoji: clean,
          },
        })
      }

      return NextResponse.json({ data: { emoji: clean, on: !existing } })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_REACT_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
