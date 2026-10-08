import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { searchAllMessages } from "@/features/chat/server/chat.service"

export const GET = withSession(async (req: NextRequest, _ctx, session) =>
  respond(await searchAllMessages(req.nextUrl.searchParams.get("q") ?? "", session)),
)
