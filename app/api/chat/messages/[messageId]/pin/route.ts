import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { togglePin } from "@/features/chat/server/chat.service"

export const POST = withSession(async (_req: NextRequest, ctx, session) =>
  respond(await togglePin(ctx.params.messageId, session)),
)
