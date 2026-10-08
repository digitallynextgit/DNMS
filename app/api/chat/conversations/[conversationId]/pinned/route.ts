import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listPinned } from "@/features/chat/server/chat.service"

export const GET = withSession(async (_req: NextRequest, ctx, session) =>
  respond(await listPinned(ctx.params.conversationId, session)),
)
