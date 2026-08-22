import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { toggleReaction } from "@/features/chat/server/chat.service"

// POST /api/chat/messages/:id/react { conversationId, emoji }
//
// A toggle, not a set: the client is acting on what it can see, and a stale
// `on: true` from another tab would fight it. conversationId comes in the body
// so the service can prove membership before touching anything.
export const POST = withSession(async (req: NextRequest, ctx, session) => {
  const { conversationId, emoji } = (await req.json()) as {
    conversationId: string
    emoji: string
  }
  return respond(await toggleReaction(conversationId, ctx.params.messageId, emoji, session))
})
