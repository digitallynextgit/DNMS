import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listConversations, startConversation } from "@/features/chat/server/chat.service"

// Personal chat is available to every signed-in employee - no permission scope.
// Messaging a colleague is not an administrative action.
export const GET = withSession(async (_req, _ctx, session) =>
  respond(await listConversations(session)),
)

export const POST = withSession(async (req: NextRequest, _ctx, session) =>
  respond(await startConversation(await req.json(), session), 201),
)
