import "server-only"

import { isWithinEditWindow } from "@/lib/edit-window"
import { CARD_SELECT, shapePoll } from "@/server/message-cards"

import { db } from "@/server/db"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { publishChat } from "@/server/chat-stream"
import { groupReactions } from "@/server/reactions"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
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

/** Proves from the DB that the caller is a participant (never trust a conversation id from the request). */
async function requireMembership(conversationId: string, employeeId: string) {
  const row = await db.conversationParticipant.findUnique({
    where: { conversationId_employeeId: { conversationId, employeeId } },
    select: { conversationId: true },
  })
  if (!row) return null
  const other = await db.conversationParticipant.findFirst({
    where: { conversationId, employeeId: { not: employeeId } },
    select: { employee: PERSON, lastReadAt: true },
  })
  return { other: other?.employee ?? null, otherLastReadAt: other?.lastReadAt ?? null }
}

/** Notification link; also the key used to collapse duplicates. */
function chatLink(conversationId: string): string {
  return "/chat?c=" + conversationId
}

/** One unread notification per conversation, refreshed in place. Never throws. */
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
      // No re-fire: the chat stream already delivered this message live.
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

export async function listConversations(session: Session): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const me = session.user.id
    const rows = await db.conversationParticipant.findMany({
      where: { employeeId: me, isArchived: false },
      select: {
        lastReadAt: true,
        pinnedAt: true,
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
              select: {
                body: true,
                createdAt: true,
                senderId: true,
                deletedAt: true,
                attachments: { select: { kind: true }, take: 1 },
              },
            },
          },
        },
      },
      // Postgres sorts NULLs first on DESC; `nulls: "last"` keeps unpinned chats below pinned ones.
      orderBy: [
        { pinnedAt: { sort: "desc", nulls: "last" } },
        { conversation: { lastMessageAt: "desc" } },
      ],
      take: 100,
    })

    // Same filter as the /api/chat/unread badge so the list and the nav badge always agree.
    const unreadRows = await db.$queryRaw<{ conversationId: string; count: number }[]>`
      SELECT m.conversation_id AS "conversationId", COUNT(*)::int AS "count"
      FROM chat_messages m
      JOIN conversation_participants p
        ON p.conversation_id = m.conversation_id AND p.employee_id = ${me}
      WHERE p.is_archived = false
        AND m.sender_id <> ${me}
        AND m.deleted_at IS NULL
        AND NOT (${me} = ANY(m.hidden_for))
        AND (p.last_read_at IS NULL OR m.created_at > p.last_read_at)
      GROUP BY m.conversation_id
    `
    const unreadByConv = new Map(unreadRows.map((u) => [u.conversationId, u.count]))

    const conversations = rows.map((r) => {
      const last = r.conversation.messages[0]
      const unread = unreadByConv.get(r.conversation.id) ?? 0
      return {
        id: r.conversation.id,
        lastMessageAt: r.conversation.lastMessageAt,
        other: r.conversation.participants[0]?.employee ?? null,
        lastMessage: last
          ? {
              body: last.deletedAt
                ? "Message deleted"
                : last.body ||
                  (last.attachments[0]?.kind === "AUDIO"
                    ? "Voice message"
                    : last.attachments[0]?.kind === "IMAGE"
                      ? "Photo"
                      : last.attachments[0]
                        ? "File"
                        : ""),
              createdAt: last.createdAt,
              fromMe: last.senderId === me,
            }
          : null,
        unread,
        pinnedAt: r.pinnedAt,
      }
    })

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

/** Open or create the conversation with one colleague (idempotent by pairKey). */
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

/** Oldest first; `before` pages backwards. */
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
        deliveredAt: true,
        pinnedAt: true,
        ...CARD_SELECT,
        replyTo: {
          select: {
            id: true,
            body: true,
            deletedAt: true,
            senderId: true,
            attachments: { select: { kind: true }, take: 1 },
          },
        },
        attachments: {
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
        },
        reactions: {
          select: {
            emoji: true,
            employeeId: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return ok(
      serialize({
        data: {
          other: membership.other,
          otherLastReadAt: membership.otherLastReadAt,
          messages: rows.reverse().map((m) => ({
            ...m,
            poll: m.deletedAt ? null : shapePoll(m.poll, session.user.id),
            event: m.deletedAt ? null : m.event,
            contact: m.deletedAt ? null : m.contact,
            replyTo: m.replyTo
              ? {
                  id: m.replyTo.id,
                  body: m.replyTo.deletedAt
                    ? null
                    : (m.replyTo.body ?? null) ||
                      (m.replyTo.attachments[0]?.kind === "AUDIO"
                        ? "Voice message"
                        : m.replyTo.attachments[0]?.kind === "IMAGE"
                          ? "Photo"
                          : m.replyTo.attachments[0]
                            ? "File"
                            : null),
                  fromMe: m.replyTo.senderId === session.user.id,
                }
              : null,
            body: m.deletedAt ? null : m.body,
            attachments: m.deletedAt ? [] : m.attachments,
            fromMe: m.senderId === session.user.id,
            reactions: groupReactions(m.reactions, session.user.id),
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

    // The quoted message must be in THIS conversation, or a reply could leak another chat's text.
    let replyToId: string | null = null
    if (input.replyToId) {
      const quoted = await db.chatMessage.findFirst({
        where: { id: input.replyToId, conversationId },
        select: { id: true },
      })
      if (!quoted) return fail("Cannot quote that message", undefined, 400)
      replyToId = quoted.id
    }

    const [message] = await db.$transaction([
      db.chatMessage.create({
        data: {
          conversationId,
          senderId: me,
          body: input.body,
          replyToId,
        },
        select: { id: true, body: true, createdAt: true, senderId: true },
      }),
      db.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
      db.conversationParticipant.updateMany({
        where: { conversationId, employeeId: me },
        data: { lastReadAt: new Date() },
      }),
      db.conversationParticipant.updateMany({
        where: { conversationId, employeeId: { not: me } },
        data: { isArchived: false },
      }),
    ])

    // Publish only after the commit - a rollback would otherwise leave a ghost message.
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
      // SSE only reaches an open chat screen; the notification reaches them everywhere else.
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

/** "me" hides it for the caller only; "everyone" soft-deletes your own message, leaving a placeholder. */
export async function deleteMessage(
  messageId: string,
  scope: "me" | "everyone",
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const me = session.user.id
    const message = await db.chatMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        conversationId: true,
        deletedAt: true,
        hiddenFor: true,
        createdAt: true,
      },
    })
    if (!message) return fail("Message not found", undefined, 404)

    const membership = await requireMembership(message.conversationId, me)
    if (!membership) return fail("Message not found", undefined, 404)

    if (scope === "me") {
      // Anyone in the thread may hide any message from their own view.
      if (!message.hiddenFor.includes(me)) {
        await db.chatMessage.update({
          where: { id: messageId },
          data: { hiddenFor: { push: me } },
        })
      }
      return ok(serialize({ data: { id: messageId, scope } }))
    }

    if (message.senderId !== me) {
      return fail("You can only delete your own messages for everyone", undefined, 403)
    }
    if (message.deletedAt) return ok(serialize({ data: { id: messageId, scope } }))
    if (!isWithinEditWindow(message.createdAt)) {
      return fail("That message is too old to delete for everyone", undefined, 403)
    }

    await db.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: "" },
    })

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
      select: {
        id: true,
        senderId: true,
        conversationId: true,
        deletedAt: true,
        createdAt: true,
      },
    })
    if (!message) return fail("Message not found", undefined, 404)
    if (message.senderId !== me) {
      return fail("You can only edit your own messages", undefined, 403)
    }
    if (message.deletedAt) {
      return fail("That message was deleted", undefined, 409)
    }
    if (!isWithinEditWindow(message.createdAt)) {
      return fail("That message is too old to edit", undefined, 403)
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

export async function listChatContacts(
  session: Session,
  search?: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const rows = await db.employee.findMany({
      where: {
        isActive: true,
        id: { not: session.user.id },
        ...VISIBLE_EMPLOYEE_FILTER,
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

/** Marks messages delivered (second tick) once they reach the device via the stream or badge poll. */
export async function markDelivered(employeeId: string, conversationId?: string): Promise<void> {
  const parts = await db.conversationParticipant.findMany({
    where: { employeeId, ...(conversationId ? { conversationId } : {}) },
    select: { conversationId: true },
  })
  if (parts.length === 0) return

  const pending = await db.chatMessage.findMany({
    where: {
      conversationId: { in: parts.map((p) => p.conversationId) },
      senderId: { not: employeeId },
      deliveredAt: null,
      deletedAt: null,
    },
    select: { id: true, conversationId: true, senderId: true },
    // Bounded; the rest are picked up by the next poll.
    take: 200,
  })
  if (pending.length === 0) return

  await db.chatMessage.updateMany({
    where: { id: { in: pending.map((m) => m.id) } },
    data: { deliveredAt: new Date() },
  })

  const bySender = new Map<string, string>()
  for (const m of pending) bySender.set(m.senderId, m.conversationId)
  await Promise.all(
    [...bySender].map(([senderId, cid]) =>
      publishChat({ type: "delivered", conversationId: cid, recipientId: senderId }),
    ),
  )
}

/** Per-caller pin on the participant row, so it never reorders the other side's list. */
export async function toggleConversationPin(
  session: Session,
  conversationId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const me = session.user.id
    const row = await db.conversationParticipant.findUnique({
      where: { conversationId_employeeId: { conversationId, employeeId: me } },
      select: { pinnedAt: true },
    })
    if (!row) return fail("Conversation not found", undefined, 404)

    const pinnedAt = row.pinnedAt ? null : new Date()
    await db.conversationParticipant.update({
      where: { conversationId_employeeId: { conversationId, employeeId: me } },
      data: { pinnedAt },
    })
    return ok(serialize({ data: { conversationId, pinnedAt } }))
  })
}

export async function toggleReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const me = session.user.id
    if (!(await requireMembership(conversationId, me)))
      return fail("Conversation not found", undefined, 404)

    const clean = emoji.trim().slice(0, 16)
    if (!clean) return fail("An emoji is required")

    const message = await db.chatMessage.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true },
    })
    if (!message) return fail("Message not found", undefined, 404)

    // Idempotent: deleteMany tolerates 0 rows and a lost create race (P2002) is ignored.
    const existing = await db.chatMessageReaction.findUnique({
      where: { messageId_employeeId_emoji: { messageId, employeeId: me, emoji: clean } },
      select: { id: true },
    })
    if (existing) {
      await db.chatMessageReaction.deleteMany({
        where: { messageId, employeeId: me, emoji: clean },
      })
    } else {
      try {
        await db.chatMessageReaction.create({ data: { messageId, employeeId: me, emoji: clean } })
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e
      }
    }

    const other = await db.conversationParticipant.findFirst({
      where: { conversationId, employeeId: { not: me } },
      select: { employeeId: true },
    })
    if (other) {
      await publishChat({
        type: "reaction",
        conversationId,
        recipientId: other.employeeId,
        messageId,
      })
    }
    return ok(serialize({ data: { messageId, emoji: clean, on: !existing } }))
  })
}

export async function togglePin(
  messageId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const message = await db.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, pinnedAt: true, deletedAt: true },
    })
    if (!message) return fail("Message not found", undefined, 404)
    if (message.deletedAt) return fail("That message was deleted", undefined, 400)

    const membership = await requireMembership(message.conversationId, session.user.id)
    if (!membership) return fail("Message not found", undefined, 404)

    const pinning = message.pinnedAt === null
    await db.chatMessage.update({
      where: { id: messageId },
      data: {
        pinnedAt: pinning ? new Date() : null,
        pinnedBy: pinning ? session.user.id : null,
      },
    })

    // The shelf is shared, so the other side's view is now stale.
    if (membership.other) {
      await publishChat({
        type: "read",
        conversationId: message.conversationId,
        recipientId: membership.other.id,
      })
    }
    return ok(serialize({ data: { pinned: pinning } }))
  })
}

export async function listPinned(
  conversationId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const membership = await requireMembership(conversationId, session.user.id)
    if (!membership) return fail("Conversation not found", undefined, 404)

    const rows = await db.chatMessage.findMany({
      where: {
        conversationId,
        pinnedAt: { not: null },
        deletedAt: null,
        NOT: { hiddenFor: { has: session.user.id } },
      },
      select: {
        id: true,
        body: true,
        senderId: true,
        createdAt: true,
        pinnedAt: true,
        attachments: { select: { kind: true }, take: 1 },
      },
      orderBy: { pinnedAt: "desc" },
      take: 20,
    })

    return ok(
      serialize({
        data: rows.map((m) => ({
          id: m.id,
          body:
            m.body ||
            (m.attachments[0]?.kind === "AUDIO"
              ? "Voice message"
              : m.attachments[0]?.kind === "IMAGE"
                ? "Photo"
                : m.attachments[0]
                  ? "File"
                  : ""),
          fromMe: m.senderId === session.user.id,
          createdAt: m.createdAt,
        })),
      }),
    )
  })
}

export async function searchMessages(
  conversationId: string,
  query: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const membership = await requireMembership(conversationId, session.user.id)
    if (!membership) return fail("Conversation not found", undefined, 404)

    const q = query.trim()
    if (q.length < 2) return ok(serialize({ data: [] }))

    const rows = await db.chatMessage.findMany({
      where: {
        conversationId,
        deletedAt: null,
        NOT: { hiddenFor: { has: session.user.id } },
        body: { contains: q, mode: "insensitive" },
      },
      select: { id: true, body: true, senderId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return ok(
      serialize({
        data: rows.map((m) => ({ ...m, fromMe: m.senderId === session.user.id })),
      }),
    )
  })
}

/** Search every conversation by the other person's name and by message text. */
export async function searchAllMessages(
  query: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const me = session.user.id
    const q = query.trim()
    if (q.length < 2) return ok(serialize({ data: [] }))

    const parts = await db.conversationParticipant.findMany({
      where: { employeeId: me },
      select: { conversationId: true },
    })
    if (parts.length === 0) return ok(serialize({ data: [] }))
    const conversationIds = parts.map((p) => p.conversationId)

    const others = await db.conversationParticipant.findMany({
      where: { conversationId: { in: conversationIds }, employeeId: { not: me } },
      select: { conversationId: true, employee: PERSON },
    })
    const otherBy = new Map(others.map((o) => [o.conversationId, o.employee]))

    const rows = await db.chatMessage.findMany({
      where: {
        conversationId: { in: conversationIds },
        deletedAt: null,
        NOT: { hiddenFor: { has: me } },
        body: { contains: q, mode: "insensitive" },
      },
      select: { id: true, body: true, senderId: true, createdAt: true, conversationId: true },
      orderBy: { createdAt: "desc" },
      // Global cap across all conversations; at most 5 are shown per chat below.
      take: 200,
    })

    const byConversation = new Map<string, typeof rows>()
    for (const r of rows) {
      const list = byConversation.get(r.conversationId)
      if (list) list.push(r)
      else byConversation.set(r.conversationId, [r])
    }

    const needle = q.toLowerCase()
    const results = conversationIds
      .map((conversationId) => {
        const other = otherBy.get(conversationId) ?? null
        const name = other ? `${other.firstName} ${other.lastName}`.toLowerCase() : ""
        const nameMatch = name.includes(needle)
        const matches = (byConversation.get(conversationId) ?? []).slice(0, 5)
        return {
          conversationId,
          other,
          nameMatch,
          matchCount: byConversation.get(conversationId)?.length ?? 0,
          matches: matches.map((m) => ({
            id: m.id,
            body: m.body,
            createdAt: m.createdAt,
            fromMe: m.senderId === me,
          })),
        }
      })
      .filter((r) => r.nameMatch || r.matches.length > 0)
      .sort((a, b) => {
        const at = a.matches[0]?.createdAt?.getTime() ?? 0
        const bt = b.matches[0]?.createdAt?.getTime() ?? 0
        return bt - at
      })

    return ok(serialize({ data: results }))
  })
}
