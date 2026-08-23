import { NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { db } from "@/server/db"
import { markDelivered } from "@/features/chat/server/chat.service"

// GET /api/chat/unread
//
// Just the number, for the sidebar badge. Deliberately NOT the conversations
// endpoint: that one loads every thread with its last message and a per-thread
// unread count, which is a lot of work to render a digit that polls on a timer.
export const GET = withSession(async (_req, _ctx, session) => {
  const me = session.user.id

  // One grouped query for the whole badge instead of one COUNT per conversation
  // (the old code issued N+1 round trips on a 20s app-wide poll). Each row is a
  // thread with unread messages and how many; threads at zero don't come back.
  // The delivery stamp does NOT affect this count (it filters on read marks, not
  // deliveredAt), so it runs CONCURRENTLY rather than blocking the badge - this
  // poll is still the moment anything sent while the tab was closed is marked
  // delivered, it just no longer sits in front of the count on the response path.
  const [, rows] = await Promise.all([
    markDelivered(me).catch((e) => console.error("[chat] delivery stamp failed:", e)),
    db.$queryRaw<{ conversationId: string; count: number }[]>`
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
    `,
  ])

  return NextResponse.json({
    unreadCount: rows.reduce((n, r) => n + r.count, 0),
    // How many THREADS are unread - the more useful number on a nav item, kept
    // available so the badge can switch without another endpoint.
    conversations: rows.length,
  })
})
