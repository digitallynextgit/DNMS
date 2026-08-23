import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { logActivity } from "@/features/projects/server/activity"
import { publishChat } from "@/server/chat-stream"
import { createPoll, createEvent, createContact } from "@/server/message-cards"

export const runtime = "nodejs"

/**
 * POST /api/projects/:id/messages/:messageId/cards
 *
 * The project-side twin of the chat card route: creates a REPLY carrying the
 * poll, event or contact, so the card always has a reply to live in.
 */
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, messageId } = await ctx.params

      // Scope by projectId - messageId is client-supplied, so posting a card into
      // another project's thread must be impossible (withProjectAccess only
      // validated the URL project id).
      const parent = await db.projectMessage.findFirst({
        where: { id: messageId, projectId },
        select: { id: true, title: true, authorId: true, replies: { select: { authorId: true } } },
      })
      if (!parent) return NextResponse.json({ error: "Message not found" }, { status: 404 })

      const body = await req.json()
      const kind = String(body?.kind ?? "")
      const preview =
        kind === "poll"
          ? `Poll: ${String(body.question ?? "").slice(0, 80)}`
          : kind === "event"
            ? `Event: ${String(body.title ?? "").slice(0, 80)}`
            : kind === "contact"
              ? "Contact"
              : ""
      if (!preview) return NextResponse.json({ error: "Unknown card type" }, { status: 400 })

      const reply = await db.projectMessageReply.create({
        data: { messageId, authorId: session.user.id, content: preview, mentionedIds: [] },
        select: { id: true },
      })

      try {
        if (kind === "poll") {
          const options = Array.isArray(body.options) ? body.options.map(String) : []
          if (
            !String(body.question ?? "").trim() ||
            options.filter((o: string) => o.trim()).length < 2
          ) {
            throw new Error("A poll needs a question and at least two options")
          }
          await createPoll(
            { projectReplyId: reply.id },
            {
              question: String(body.question),
              options,
              allowMultiple: !!body.allowMultiple,
              closesAt: body.closesAt ?? null,
            },
          )
        } else if (kind === "event") {
          if (!String(body.title ?? "").trim() || !body.startsAt) {
            throw new Error("An event needs a title and a start time")
          }
          await createEvent(
            { projectReplyId: reply.id },
            {
              title: String(body.title),
              startsAt: String(body.startsAt),
              endsAt: body.endsAt ?? null,
              location: body.location ?? null,
              notes: body.notes ?? null,
            },
          )
        } else {
          const created = await createContact({ projectReplyId: reply.id }, String(body.employeeId))
          if (!created) throw new Error("That person no longer exists")
        }
      } catch (err) {
        await db.projectMessageReply.delete({ where: { id: reply.id } }).catch(() => {})
        const reason = err instanceof Error ? err.message : "Could not create that"
        return NextResponse.json({ error: reason }, { status: 400 })
      }

      await logActivity({
        projectId,
        actorId: session.user.id,
        type: "MESSAGE_POSTED",
        entityType: "MESSAGE",
        entityId: messageId,
        meta: { title: parent.title, reply: true, card: kind },
      })

      const watchers = new Set<string>([parent.authorId])
      for (const r of parent.replies) watchers.add(r.authorId)
      watchers.delete(session.user.id)
      await Promise.all(
        [...watchers].map((employeeId) =>
          publishChat({
            type: "project-message",
            conversationId: messageId,
            projectId,
            recipientId: employeeId,
          }),
        ),
      )

      return NextResponse.json({ data: { id: reply.id } }, { status: 201 })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_CARDS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
