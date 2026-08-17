import { withSession, respond } from "@/server/api-handler"
import { deleteMessage } from "@/features/chat/server/chat.service"

export const DELETE = withSession(async (_req, ctx, session) =>
  respond(await deleteMessage(ctx.params.messageId, session)),
)
