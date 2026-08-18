import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { searchMessages } from "@/features/chat/server/chat.service"

// GET /api/chat/conversations/:id/search?q=
export const GET = withSession(async (req: NextRequest, ctx, session) =>
  respond(
    await searchMessages(
      ctx.params.conversationId,
      req.nextUrl.searchParams.get("q") ?? "",
      session,
    ),
  ),
)
