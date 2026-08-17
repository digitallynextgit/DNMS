import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listChatContacts } from "@/features/chat/server/chat.service"

export const GET = withSession(async (req: NextRequest, _ctx, session) =>
  respond(await listChatContacts(session, req.nextUrl.searchParams.get("search") ?? undefined)),
)
