import { withSession, respond } from "@/server/api-handler"
import { markRead } from "@/features/chat/server/chat.service"

export const POST = withSession(async (_req, ctx, session) =>
  respond(await markRead(ctx.params.conversationId, session)),
)
