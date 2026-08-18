// =============================================================================
// Personal chat
// =============================================================================
// Private 1:1 messages. The ONE rule everything here enforces: a caller may only
// touch a conversation they are a participant of. Every function proves that
// from the database on each call - never from a conversation id in the request,
// which is just a string somebody could change.
// =============================================================================

import "server-only"

import { isWithinEditWindow } from "@/lib/edit-window"

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
    select: { employee: PERSON, lastReadAt: true },
  })
  return { other: other?.employee ?? null, otherLastReadAt: other?.lastReadAt ?? null }
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
                // A photo or voice note has no text to preview, so name the kind
                // rather than showing an empty row.
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
        deliveredAt: true,
        pinnedAt: true,
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
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return ok(
      serialize({
        data: {
          other: membership.other,
          // When the other person last opened this thread. Anything sent before
          // it has genuinely been seen - the tick is evidence, not decoration.
          otherLastReadAt: membership.otherLastReadAt,
          // Reversed so the client renders oldest-first without re-sorting.
          messages: rows.reverse().map((m) => ({
            ...m,
            replyTo: m.replyTo
              ? {
                  id: m.replyTo.id,
                  // A quote of something since deleted says so, rather than
                  // showing text the author has already taken back.
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
            // Deleting for everyone must take the files with it, not just the text.
            attachments: m.deletedAt ? [] : m.attachments,
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
        data: {
          conversationId,
          senderId: me,
          body: input.body,
          replyToId: input.replyToId ?? null,
        },
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
    // Same window project messages use. Unpicking a line the other person read
    // days ago rewrites a shared record; "delete for me" stays open forever
    // because it only changes your own view.
    if (!isWithinEditWindow(message.createdAt)) {
      return fail("That message is too old to delete for everyone", undefined, 403)
    }

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
    // Enforced here, not only hidden in the UI - the button being gone is a
    // courtesy, this is the rule.
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

/**
 * Stamp every message that has now reached this person's device, and tell the
 * senders so their second tick can appear without a refresh.
 *
 * Called from two places, because there are exactly two moments a message can
 * be said to have arrived: their chat stream pushed it to an open tab, or they
 * opened the app and the badge poll ran. Anything else - the message merely
 * existing in the database - is the FIRST tick, not the second.
 */
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
    // A first login after a long absence should not turn into an unbounded
    // update; the rest are picked up by the next poll.
    take: 200,
  })
  if (pending.length === 0) return

  await db.chatMessage.updateMany({
    where: { id: { in: pending.map((m) => m.id) } },
    data: { deliveredAt: new Date() },
  })

  // One event per sender, not per message: ten messages delivered at once is
  // still just "your ticks changed" to the person who sent them.
  const bySender = new Map<string, string>()
  for (const m of pending) bySender.set(m.senderId, m.conversationId)
  await Promise.all(
    [...bySender].map(([senderId, cid]) =>
      publishChat({ type: "delivered", conversationId: cid, recipientId: senderId }),
    ),
  )
}

/**
 * Pin or unpin a line in a conversation.
 *
 * Either participant may pin, and both see the same shelf. A private bookmark
 * would be a different feature: pinning here says "this is the bit that matters"
 * to the person you are talking to, which is the whole point.
 */
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

/** The pinned shelf for one conversation, newest pin first. */
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

/**
 * Find text inside one conversation.
 *
 * The conversation list already filters by NAME; this is the other half, and the
 * half you actually need to find a decision somebody typed three weeks ago.
 */
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

/**
 * Search every conversation at once - names AND what was said inside them.
 *
 * The list pane used to filter on the other person's name only, which finds a
 * chat you already know you had. Project messages had always searched the
 * discussion itself, and that is the half that answers "where did somebody say
 * that?" when you cannot remember who said it.
 */
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

    // Who each conversation is WITH, so a hit can be labelled without a second
    // round trip per result.
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
      // Across every conversation at once, so the cap is global: the newest 200
      // hits, then at most a handful shown per chat below.
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
      // A conversation earns a place by its name or by something said in it.
      .filter((r) => r.nameMatch || r.matches.length > 0)
      .sort((a, b) => {
        // Whoever you were talking to most recently about this comes first.
        const at = a.matches[0]?.createdAt?.getTime() ?? 0
        const bt = b.matches[0]?.createdAt?.getTime() ?? 0
        return bt - at
      })

    return ok(serialize({ data: results }))
  })
}
