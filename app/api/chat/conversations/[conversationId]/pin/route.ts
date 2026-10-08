import { withSession, respond } from "@/server/api-handler"
import { toggleConversationPin } from "@/features/chat/server/chat.service"

// A toggle, not a flag, so a stale `pinned: true` from another tab can't fight it.
export const POST = withSession(async (_req, ctx, session) =>
  respond(await toggleConversationPin(session, ctx.params.conversationId)),
)
