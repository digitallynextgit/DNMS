import { withSession, respond } from "@/server/api-handler"
import { toggleConversationPin } from "@/features/chat/server/chat.service"

// POST /api/chat/conversations/:id/pin - pin or unpin the conversation for the
// caller. A toggle rather than a body flag: the client is acting on what it can
// already see, and a stale `pinned: true` from a second tab would fight it.
export const POST = withSession(async (_req, ctx, session) =>
  respond(await toggleConversationPin(session, ctx.params.conversationId)),
)
