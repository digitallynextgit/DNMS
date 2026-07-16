import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { createNotifications } from "@/lib/notifications"
import type { Session } from "next-auth"
import { resolveProjectMemberIds } from "../route"

// PATCH /api/projects/[id]/messages/[messageId]
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, messageId } = await ctx.params
      const msg = await db.projectMessage.findUnique({
        where: { id: messageId },
        select: { id: true, authorId: true, title: true, mentionedIds: true },
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

      // Only recompute mentions when the caller sends them (pin toggles don't).
      let newlyMentioned: string[] = []
      if (Array.isArray(body.mentionedIds)) {
        const mentionedIds = await resolveProjectMemberIds(projectId, body.mentionedIds)
        data.mentionedIds = mentionedIds
        // Notify only people newly added since the last version (and never the author).
        const already = new Set(msg.mentionedIds)
        newlyMentioned = mentionedIds.filter((id) => !already.has(id) && id !== session.user.id)
      }

      const updated = await db.projectMessage.update({
        where: { id: messageId },
        data,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        },
      })

      if (newlyMentioned.length > 0) {
        await createNotifications(
          newlyMentioned.map((employeeId) => ({
            employeeId,
            title: "You were mentioned",
            message: `${updated.author.firstName} ${updated.author.lastName} mentioned you in "${updated.title}".`,
            type: "info",
            link: `/projects/${projectId}?tab=messages`,
          })),
          { force: true },
        )
      }

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE /api/projects/[id]/messages/[messageId]
export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
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
