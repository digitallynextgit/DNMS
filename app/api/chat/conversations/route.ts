import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listConversations, startConversation } from "@/features/chat/server/chat.service"

export const GET = withSession(async (_req, _ctx, session) =>
  respond(await listConversations(session)),
)

export const POST = withSession(async (req: NextRequest, _ctx, session) =>
  respond(await startConversation(await req.json(), session), 201),
)
