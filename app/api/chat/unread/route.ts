import { NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { db } from "@/server/db"
import { markDelivered } from "@/features/chat/server/chat.service"

// Just the count for the sidebar badge; the conversations endpoint is too heavy for a timer poll.
export const GET = withSession(async (_req, _ctx, session) => {
  const me = session.user.id

  // The delivery stamp doesn't affect unread counts (they use read marks), so it runs alongside.
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
    conversations: rows.length,
  })
})
