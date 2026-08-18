// =============================================================================
// Personal chat
// =============================================================================
// Private 1:1 messages. The ONE rule everything here enforces: a caller may only
// touch a conversation they are a participant of. Every function proves that
// from the database on each call - never from a conversation id in the request,
// which is just a string somebody could change.
// =============================================================================

import "server-only"

import { db } from "@/server/db"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { publishChat } from "@/server/chat-stream"
import {
  sendMessageSchema,
  startConversationSchema,
  editMessageSchema,
} from "../schemas/chat.schema"
import type { Session } from "next-auth"

const PERSON = {
  select: { id: true, firstName: true, lastName: true, profilePhoto: true, email: true },
} as const

/** Deterministic key so A→B and B→A are the same conversation. */
function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join(":")
}

/** Proves membership and returns the other participant. */
async function requireMembership(conversationId: string, employeeId: string) {
  const row = await db.conversationParticipant.findUnique({
    where: { conversationId_employeeId: { conversationId, employeeId } },
    select: { conversationId: true },
  })
  if (!row) return null
  const other = await db.conversationParticipant.findFirst({
    where: { conversationId, employeeId: { not: employeeId } },
    select: { employee: PERSON },
  })
  return { other: other?.employee ?? null }
}

/** Where a chat notification points, and the key used to collapse duplicates. */
function chatLink(conversationId: string): string {
  return "/chat?c=" + conversationId
}

/**
 * Raise (or refresh) the recipient's chat notification.
 *
 * COLLAPSED per conversation on purpose: twenty messages in one exchange should
 * be one line in the bell saying what was said last, not twenty. An unread
 * notification for the same thread is updated in place; a new one is only
 * created once the previous has been read.
 *
 * Never throws - a notification is a courtesy, and must not fail a message that
 * is already committed.
 */
async function notifyRecipient(args: {
  toEmployeeId: string
  conversationId: string
  fromName: string
  body: string
}): Promise<void> {
  try {
    const link = chatLink(args.conversationId)
    const preview = args.body.length > 120 ? args.body.slice(0, 119) + "…" : args.body

    const existing = await db.notification.findFirst({
      where: { employeeId: args.toEmployeeId, isRead: false, link },
      select: { id: true },
    })

    if (existing) {
      // Refresh in place. This deliberately does NOT re-fire the notification
      // stream: the chat stream already delivered this message live, and a
      // second ping for the same conversation is noise.
      await db.notification.update({
        where: { id: existing.id },
        data: { message: preview, createdAt: new Date() },
      })
      return
    }

    const { createNotification } = await import("@/lib/notifications")
    await createNotification({
      employeeId: args.toEmployeeId,
      title: args.fromName,
      message: preview,
      type: "info",
      link,
    })
  } catch (e) {
    console.error("[chat] could not raise notification", e)
  }
}

/** Every conversation this person is in, newest activity first. */
export async function listConversations(session: Session): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const me = session.user.id
    const rows = await db.conversationParticipant.findMany({
      where: { employeeId: me, isArchived: false },
      select: {
        lastReadAt: true,
        conversation: {
          select: {
            id: true,
            lastMessageAt: true,
            participants: {
              where: { employeeId: { not: me } },
              select: { employee: PERSON },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { body: true, createdAt: true, senderId: true, deletedAt: true },
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: "desc" } },
      take: 100,
    })

    // Unread counted per conversation against this person's own read mark.
    const conversations = await Promise.all(
      rows.map(async (r) => {
        const last = r.conversation.messages[0]
        const unread = await db.chatMessage.count({
          where: {
            conversationId: r.conversation.id,
            senderId: { not: me },
            deletedAt: null,
            ...(r.lastReadAt ? { createdAt: { gt: r.lastReadAt } } : {}),
          },
        })
        return {
          id: r.conversation.id,
          lastMessageAt: r.conversation.lastMessageAt,
          other: r.conversation.participants[0]?.employee ?? null,
          lastMessage: last
            ? {
                body: last.deletedAt ? "Message deleted" : last.body,
                createdAt: last.createdAt,
                fromMe: last.senderId === me,
              }
            : null,
          unread,
        }
      }),
    )

    return ok(
      serialize({
        data: {
          conversations,
          totalUnread: conversations.reduce((n, c) => n + c.unread, 0),
        },
      }),
    )
  })
}

/**
 * Open (or create) the conversation with one colleague.
 *
 * Idempotent by pairKey: two people clicking each other at the same instant get
 * the same row rather than two half-histories. The unique index is what actually
 * guarantees that, so a lost race is caught and re-read instead of surfacing as
 * an error.
 */
export async function startConversation(
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = startConversationSchema.parse(body)
    const me = session.user.id
    if (input.employeeId === me) {
      return fail("You cannot start a chat with yourself", undefined, 400)
    }

    const other = await db.employee.findFirst({
      where: { id: input.employeeId, isActive: true },
      select: { id: true },
    })
    if (!other) return fail("Employee not found", undefined, 404)

    const pairKey = pairKeyFor(me, other.id)
    const existing = await db.conversation.findUnique({
      where: { pairKey },
      select: { id: true },
    })
    if (existing) {
      // Un-archive for the opener: they just asked for it back.
      await db.conversationParticipant.updateMany({
        where: { conversationId: existing.id, employeeId: me },
        data: { isArchived: false },
      })
      return ok(serialize({ data: { id: existing.id } }))
    }

    try {
      const created = await db.conversation.create({
        data: {
          pairKey,
          participants: { create: [{ employeeId: me }, { employeeId: other.id }] },
        },
        select: { id: true },
      })
      return ok(serialize({ data: { id: created.id } }))
    } catch {
      // Lost the race against the unique index - the row now exists, use it.
      const row = await db.conversation.findUnique({ where: { pairKey }, select: { id: true } })
      if (!row) return fail("Could not open the conversation", undefined, 500)
      return ok(serialize({ data: { id: row.id } }))
    }
  })
}

/** One conversation's messages, oldest last. `before` pages backwards. */
export async function listMessages(
  conversationId: string,
  session: Session,
  opts: { before?: string; limit?: number } = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const membership = await requireMembership(conversationId, session.user.id)
    if (!membership) return fail("Conversation not found", undefined, 404)

    const limit = Math.min(opts.limit ?? 50, 100)
    const rows = await db.chatMessage.findMany({
      where: {
        conversationId,
        // "Delete for me" hides the row from this reader and nobody else.
        NOT: { hiddenFor: { has: session.user.id } },
        ...(opts.before ? { createdAt: { lt: new Date(opts.before) } } : {}),
      },
      select: {
        id: true,
        body: true,
        senderId: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return ok(
      serialize({
        data: {
          other: membership.other,
          // Reversed so the client renders oldest-first without re-sorting.
          messages: rows.reverse().map((m) => ({
            ...m,
            body: m.deletedAt ? null : m.body,
            fromMe: m.senderId === session.user.id,
          })),
          hasMore: rows.length === limit,
        },
      }),
    )
  })
}

export async function sendMessage(
  conversationId: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = sendMessageSchema.parse(body)
    const me = session.user.id
    const membership = await requireMembership(conversationId, me)
    if (!membership) return fail("Conversation not found", undefined, 404)

    const [message] = await db.$transaction([
      db.chatMessage.create({
        data: { conversationId, senderId: me, body: input.body },
        select: { id: true, body: true, createdAt: true, senderId: true },
      }),
      db.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
      // The sender has by definition read their own message.
      db.conversationParticipant.updateMany({
        where: { conversationId, employeeId: me },
        data: { lastReadAt: new Date() },
      }),
      // A new message pulls the thread back for whoever archived it.
      db.conversationParticipant.updateMany({
        where: { conversationId, employeeId: { not: me } },
        data: { isArchived: false },
      }),
    ])

    // Realtime AFTER the commit: pushing first can deliver a message that the
    // transaction then rolls back.
    if (membership.other) {
      await publishChat({
        type: "message",
        conversationId,
        recipientId: membership.other.id,
        messageId: message.id,
        senderId: me,
        senderName: `${session.user.firstName} ${session.user.lastName}`,
        body: input.body,
        createdAt: message.createdAt.toISOString(),
      })
      // The bell, the inbox and push. The SSE event above only reaches somebody
      // with the chat screen open; this is what reaches them anywhere else.
      await notifyRecipient({
        toEmployeeId: membership.other.id,
        conversationId,
        fromName: `${session.user.firstName} ${session.user.lastName}`,
        body: input.body,
      })
    }

    return ok(serialize({ data: { ...message, fromMe: true } }))
  })
}

/** Mark everything up to now as read for this person. */
export async function markRead(
  conversationId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const membership = await requireMembership(conversationId, session.user.id)
    if (!membership) return fail("Conversation not found", undefined, 404)

    await db.conversationParticipant.updateMany({
      where: { conversationId, employeeId: session.user.id },
      data: { lastReadAt: new Date() },
    })

    // Opening the thread IS reading it - the badge must not outlive the visit.
    await db.notification.updateMany({
      where: {
        employeeId: session.user.id,
        isRead: false,
        link: chatLink(conversationId),
      },
      data: { isRead: true, readAt: new Date() },
    })

    // Let the other side move their "sent" tick to "read".
    if (membership.other) {
      await publishChat({
        type: "read",
        conversationId,
        recipientId: membership.other.id,
      })
    }
    return ok(serialize({ data: { ok: true } }))
  })
}

/**
 * Delete one of YOUR messages for everyone.
 *
 * Soft: the row stays as a "Message deleted" placeholder. Removing it outright
 * makes the thread silently reshuffle around a gap, which reads as the other
 * person never having said anything.
 */
export async function deleteMessage(
  messageId: string,
  scope: "me" | "everyone",
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const me = session.user.id
    const message = await db.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, conversationId: true, deletedAt: true, hiddenFor: true },
    })
    if (!message) return fail("Message not found", undefined, 404)

    // Membership, not just authorship: hiding a message requires being in the
    // conversation, which is a different question from having written it.
    const membership = await requireMembership(message.conversationId, me)
    if (!membership) return fail("Message not found", undefined, 404)

    if (scope === "me") {
      // Anyone in the thread may hide anything from their OWN view - including
      // the other person's messages. It changes nothing for them.
      if (!message.hiddenFor.includes(me)) {
        await db.chatMessage.update({
          where: { id: messageId },
          data: { hiddenFor: { push: me } },
        })
      }
      return ok(serialize({ data: { id: messageId, scope } }))
    }

    // "Delete for everyone" is only yours to do, and only to your own message.
    if (message.senderId !== me) {
      return fail("You can only delete your own messages for everyone", undefined, 403)
    }
    if (message.deletedAt) return ok(serialize({ data: { id: messageId, scope } }))

    await db.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: "" },
    })

    // Tell the other side so the placeholder replaces the text on their screen
    // too, rather than only after they next reload.
    if (membership.other) {
      await publishChat({
        type: "message",
        conversationId: message.conversationId,
        recipientId: membership.other.id,
      })
    }
    return ok(serialize({ data: { id: messageId, scope } }))
  })
}

/**
 * Edit your own message.
 *
 * No time limit, unlike task details: a chat message is a conversation, not a
 * commitment somebody plans around. The `edited` marker is what keeps it honest -
 * the other person can always see that the wording changed.
 */
export async function editMessage(
  messageId: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = editMessageSchema.parse(body)
    const me = session.user.id

    const message = await db.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, conversationId: true, deletedAt: true },
    })
    if (!message) return fail("Message not found", undefined, 404)
    if (message.senderId !== me) {
      return fail("You can only edit your own messages", undefined, 403)
    }
    if (message.deletedAt) {
      return fail("That message was deleted", undefined, 409)
    }

    const membership = await requireMembership(message.conversationId, me)
    if (!membership) return fail("Message not found", undefined, 404)

    const updated = await db.chatMessage.update({
      where: { id: messageId },
      data: { body: input.body, editedAt: new Date() },
      select: { id: true, body: true, editedAt: true },
    })

    if (membership.other) {
      await publishChat({
        type: "message",
        conversationId: message.conversationId,
        recipientId: membership.other.id,
      })
    }
    return ok(serialize({ data: updated }))
  })
}

/** People you can start a chat with: active colleagues, excluding yourself. */
export async function listChatContacts(
  session: Session,
  search?: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const rows = await db.employee.findMany({
      where: {
        isActive: true,
        id: { not: session.user.id },
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: { ...PERSON.select, designation: { select: { title: true } } },
      orderBy: [{ firstName: "asc" }],
      take: 50,
    })
    return ok(
      serialize({
        data: rows.map((r) => ({ ...r, designation: r.designation?.title ?? null })),
      }),
    )
  })
}
