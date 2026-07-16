import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { logActivity } from "@/features/projects/server/activity"
import { createNotifications } from "@/lib/notifications"
import type { Session } from "next-auth"
import { resolveProjectMemberIds } from "../../route"

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePhoto: true,
  designation: { select: { title: true } },
}

// GET /api/projects/[id]/messages/[messageId]/replies - thread replies, oldest first.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { messageId } = await ctx.params
      const replies = await db.projectMessageReply.findMany({
        where: { messageId },
        orderBy: { createdAt: "asc" },
        include: { author: { select: AUTHOR_SELECT } },
      })
      return NextResponse.json({ data: replies })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_REPLIES_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST /api/projects/[id]/messages/[messageId]/replies - post a reply (any member).
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, messageId } = await ctx.params
      const parent = await db.projectMessage.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          title: true,
          authorId: true,
          replies: { select: { authorId: true } },
        },
      })
      if (!parent) return NextResponse.json({ error: "Message not found" }, { status: 404 })

      const body = await req.json()
      const content = body.content?.trim()
      if (!content) return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 })

      const mentionedIds = await resolveProjectMemberIds(
        projectId,
        Array.isArray(body.mentionedIds) ? body.mentionedIds : [],
      )

      const reply = await db.projectMessageReply.create({
        data: { messageId, authorId: session.user.id, content, mentionedIds },
        include: { author: { select: AUTHOR_SELECT } },
      })

      await logActivity({
        projectId,
        actorId: session.user.id,
        type: "MESSAGE_POSTED",
        entityType: "MESSAGE",
        entityId: messageId,
        meta: { title: parent.title, reply: true },
      })

      // Notify everyone in the conversation: the original author + prior repliers +
      // anyone @mentioned in this reply. Never notify the person replying.
      const recipients = new Set<string>([parent.authorId])
      for (const r of parent.replies) recipients.add(r.authorId)
      for (const id of mentionedIds) recipients.add(id)
      recipients.delete(session.user.id)

      if (recipients.size > 0) {
        const who = `${reply.author.firstName} ${reply.author.lastName}`
        await createNotifications(
          [...recipients].map((employeeId) => ({
            employeeId,
            title: mentionedIds.includes(employeeId) ? "You were mentioned" : "New reply",
            message: `${who} replied to "${parent.title}".`,
            type: "info",
            link: `/projects/${projectId}?tab=messages`,
          })),
          { force: true },
        )
      }

      return NextResponse.json({ data: reply }, { status: 201 })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_REPLIES_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
