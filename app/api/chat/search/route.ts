import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { searchAllMessages } from "@/features/chat/server/chat.service"

// GET /api/chat/search?q=
//
// Across EVERY conversation, names and message text alike. The per-conversation
// route next to it is the narrow version, for when you already know the thread.
export const GET = withSession(async (req: NextRequest, _ctx, session) =>
  respond(await searchAllMessages(req.nextUrl.searchParams.get("q") ?? "", session)),
)
