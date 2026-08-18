import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { isWithinEditWindow } from "@/lib/edit-window"
import { resolveProjectMemberIds } from "../../../route"
import type { Session } from "next-auth"

// PATCH /api/projects/[id]/messages/[messageId]/replies/[replyId] - edit own reply,
// within the 15 minute window.
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, replyId } = await ctx.params
      const reply = await db.projectMessageReply.findUnique({
        where: { id: replyId },
        select: { id: true, authorId: true, createdAt: true },
      })
      if (!reply) return NextResponse.json({ error: "Reply not found" }, { status: 404 })
      if (reply.authorId !== session.user.id) {
        return NextResponse.json({ error: "You can only edit your own replies" }, { status: 403 })
      }
      if (!isWithinEditWindow(reply.createdAt)) {
        return NextResponse.json(
          { error: "This message can no longer be edited - the 15 minute window has closed." },
          { status: 403 },
        )
      }

      const body = await req.json()
      const content = typeof body.content === "string" ? body.content.trim() : ""
      if (!content) return NextResponse.json({ error: "Message cannot be empty" }, { status: 422 })

      const data: Record<string, unknown> = { content }
      // Mentions are re-resolved against project membership, exactly as on create,
      // so an edit cannot smuggle in someone who is not on the project.
      if (Array.isArray(body.mentionedIds)) {
        data.mentionedIds = await resolveProjectMemberIds(projectId, body.mentionedIds)
      }

      const updated = await db.projectMessageReply.update({
        where: { id: replyId },
        data,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        },
      })
      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_REPLY_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE /api/projects/[id]/messages/[messageId]/replies/[replyId] - delete own reply,
// within the 15 minute window.
export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { replyId } = await ctx.params
      const reply = await db.projectMessageReply.findUnique({
        where: { id: replyId },
        select: { id: true, authorId: true, createdAt: true },
      })
      if (!reply) return NextResponse.json({ error: "Reply not found" }, { status: 404 })
      if (reply.authorId !== session.user.id) {
        return NextResponse.json({ error: "You can only delete your own replies" }, { status: 403 })
      }
      if (!isWithinEditWindow(reply.createdAt)) {
        return NextResponse.json(
          { error: "This message can no longer be deleted - the 15 minute window has closed." },
          { status: 403 },
        )
      }
      await db.projectMessageReply.delete({ where: { id: replyId } })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_REPLY_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
