import { NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { db } from "@/server/db"

// GET /api/chat/unread
//
// Just the number, for the sidebar badge. Deliberately NOT the conversations
// endpoint: that one loads every thread with its last message and a per-thread
// unread count, which is a lot of work to render a digit that polls on a timer.
export const GET = withSession(async (_req, _ctx, session) => {
  const me = session.user.id

  // Messages from other people, in threads I am in, newer than my read mark.
  const parts = await db.conversationParticipant.findMany({
    where: { employeeId: me, isArchived: false },
    select: { conversationId: true, lastReadAt: true },
  })
  if (parts.length === 0) return NextResponse.json({ unreadCount: 0, conversations: 0 })

  const counts = await Promise.all(
    parts.map((p) =>
      db.chatMessage.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: me },
          deletedAt: null,
          NOT: { hiddenFor: { has: me } },
          ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
        },
      }),
    ),
  )

  return NextResponse.json({
    unreadCount: counts.reduce((n, c) => n + c, 0),
    // How many THREADS are unread - the more useful number on a nav item, kept
    // available so the badge can switch without another endpoint.
    conversations: counts.filter((c) => c > 0).length,
  })
})
