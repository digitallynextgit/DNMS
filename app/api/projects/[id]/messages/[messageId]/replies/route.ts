import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { logActivity } from "@/features/projects/server/activity"
import { createNotifications } from "@/lib/notifications"
import type { Session } from "next-auth"
import { publishChat } from "@/server/chat-stream"
import { CARD_SELECT, shapePoll } from "@/server/message-cards"
import { groupReactions } from "@/server/reactions"
import { resolveProjectMemberIds } from "../../route"

/** Everything the shared attachment renderer needs, and nothing more. */
export const ATTACHMENT_SELECT = {
  select: {
    id: true,
    kind: true,
    fileName: true,
    contentType: true,
    size: true,
    width: true,
    height: true,
    durationSec: true,
    waveform: true,
  },
} as const

/** Who reacted with what - grouped per viewer by groupReactions(). */
export const REACTION_SELECT = {
  select: {
    emoji: true,
    employeeId: true,
    employee: { select: { firstName: true, lastName: true } },
  },
} as const

const NAME_SELECT = { select: { id: true, firstName: true, lastName: true } } as const

/** Just enough of a quoted reply to draw one line above the answer. */
const QUOTE_SELECT = {
  select: { id: true, content: true, author: NAME_SELECT },
} as const

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
      const { id: projectId, messageId } = await ctx.params
      // withProjectAccess only proved access to the URL project; messageId is an
      // opaque string the caller supplied. Confirm the thread actually lives in
      // this project before returning any of it, or A can read B's thread by
      // pairing A's id with B's messageId.
      const parent = await db.projectMessage.findFirst({
        where: { id: messageId, projectId },
        select: { id: true },
      })
      if (!parent) return NextResponse.json({ error: "Message not found" }, { status: 404 })
      const [replies, reads] = await Promise.all([
        db.projectMessageReply.findMany({
          where: { messageId },
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: AUTHOR_SELECT },
            attachments: ATTACHMENT_SELECT,
            reactions: REACTION_SELECT,
            replyTo: QUOTE_SELECT,
            replyToRoot: { select: { id: true, content: true, author: NAME_SELECT } },
            ...CARD_SELECT,
          },
        }),
        // Who has opened this project's Messages tab, and when. A message is
        // "seen by" everyone whose mark is later than it - the same timestamp
        // evidence personal chat uses, so no per-message read table is needed
        // and old messages are covered retroactively rather than only new ones.
        db.projectMessageRead.findMany({
          where: { projectId },
          select: {
            lastSeenAt: true,
            employee: {
              select: { id: true, firstName: true, lastName: true, profilePhoto: true },
            },
          },
        }),
      ])
      // The poll is reshaped per viewer - "did I vote?" is not a property of the
      // row, it is a property of who is asking.
      return NextResponse.json({
        data: replies.map(({ replyTo, replyToRoot, ...r }) => {
          // Flattened to ONE shape whichever kind of bubble was quoted, so the
          // renderer does not branch on which column happened to be set. A quote
          // whose target has since been deleted comes through as null, and the
          // bubble says "message deleted" rather than dropping the quote.
          const quoted = replyTo ?? replyToRoot
          return {
            ...r,
            poll: shapePoll(r.poll, _session.user.id),
            reactions: groupReactions(r.reactions, _session.user.id),
            replyTo: quoted
              ? {
                  // The opening post is addressed as "root" everywhere in this
                  // thread's DOM ids, so a jump target resolves the same way.
                  id: replyTo ? quoted.id : "root",
                  content: quoted.content,
                  authorName: `${quoted.author.firstName} ${quoted.author.lastName}`.trim(),
                  fromMe: quoted.author.id === _session.user.id,
                }
              : null,
          }
        }),
        readers: reads.map((r) => ({ ...r.employee, lastSeenAt: r.lastSeenAt })),
      })
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
      // Scope by projectId: messageId is client-supplied, so quoting/replying
      // into another project's thread must be impossible, not just unlikely.
      const parent = await db.projectMessage.findFirst({
        where: { id: messageId, projectId },
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

      // "root" means the opening post; anything else must be a reply that really
      // belongs to THIS thread - the id arrives from the client, so quoting a
      // line out of another project's chat has to be impossible here, not just
      // unlikely.
      const rawQuote = typeof body.replyToId === "string" ? body.replyToId : null
      let replyToId: string | null = null
      let replyToRootId: string | null = null
      if (rawQuote === "root") {
        replyToRootId = messageId
      } else if (rawQuote) {
        const target = await db.projectMessageReply.findFirst({
          where: { id: rawQuote, messageId },
          select: { id: true },
        })
        if (!target)
          return NextResponse.json({ error: "Cannot quote that message" }, { status: 400 })
        replyToId = target.id
      }

      const reply = await db.projectMessageReply.create({
        data: {
          messageId,
          authorId: session.user.id,
          content,
          mentionedIds,
          replyToId,
          replyToRootId,
        },
        include: {
          author: { select: AUTHOR_SELECT },
          attachments: ATTACHMENT_SELECT,
          ...CARD_SELECT,
        },
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

      // Everyone in the conversation, including people this reply does not
      // notify: the thread on their screen is stale either way.
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

      return NextResponse.json({ data: reply }, { status: 201 })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_REPLIES_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
