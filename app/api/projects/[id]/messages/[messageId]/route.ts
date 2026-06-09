import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession, withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// PATCH /api/projects/[id]/messages/[messageId]
export const PATCH = withSession(
  async (
    req: NextRequest,
    ctx: { params: Promise<{ id: string; messageId: string }> },
    session: Session,
  ) => {
    try {
      const { messageId } = await ctx.params
      const msg = await db.projectMessage.findUnique({
        where: { id: messageId },
        select: { id: true, authorId: true },
      })
      if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 })
      if (msg.authorId !== session.user.id) {
        return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 })
      }
      const body = await req.json()
      const data: Record<string, unknown> = {}
      if (body.title?.trim()) data.title = body.title.trim()
      if (body.content?.trim()) data.content = body.content.trim()
      if (typeof body.isPinned === "boolean") data.isPinned = body.isPinned
      const updated = await db.projectMessage.update({
        where: { id: messageId },
        data,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        },
      })
      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE /api/projects/[id]/messages/[messageId]
export const DELETE = withSession(
  async (
    _req: NextRequest,
    ctx: { params: Promise<{ id: string; messageId: string }> },
    session: Session,
  ) => {
    try {
      const { messageId } = await ctx.params
      const msg = await db.projectMessage.findUnique({
        where: { id: messageId },
        select: { id: true, authorId: true },
      })
      if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 })
      if (msg.authorId !== session.user.id) {
        return NextResponse.json(
          { error: "You can only delete your own messages" },
          { status: 403 },
        )
      }
      await db.projectMessage.delete({ where: { id: messageId } })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
