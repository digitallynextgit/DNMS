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
      const { id: projectId, messageId } = await ctx.params
      const { emoji, replyId } = (await req.json()) as { emoji?: string; replyId?: string }
      const clean = (emoji ?? "").trim().slice(0, 16)
      if (!clean) return NextResponse.json({ error: "An emoji is required" }, { status: 400 })

      const me = session.user.id

      // Prove the thread belongs to THIS project first - withProjectAccess only
      // validated the URL project, and messageId is a string the client chose.
      // Without this, a reaction lands on an arbitrary project's opening post.
      const message = await db.projectMessage.findFirst({
        where: { id: messageId, projectId },
        select: { id: true },
      })
      if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

      // Prove the target reply belongs to THIS thread before writing to it - the
      // id in the URL is just a string somebody could change.
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
      // Idempotent toggle (API-13): tolerate the double-tap race - deleteMany
      // accepts 0 rows, and a duplicate create is swallowed via P2002. deleteMany
      // needs a plain filter, not the composite-unique `where` used for lookup.
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
