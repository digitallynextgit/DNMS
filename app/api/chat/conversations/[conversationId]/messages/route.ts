import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listMessages, sendMessage } from "@/features/chat/server/chat.service"

export const GET = withSession(async (req: NextRequest, ctx, session) =>
  respond(
    await listMessages(ctx.params.conversationId, session, {
      before: req.nextUrl.searchParams.get("before") ?? undefined,
      limit: Number(req.nextUrl.searchParams.get("limit")) || undefined,
    }),
  ),
)

export const POST = withSession(async (req: NextRequest, ctx, session) =>
  respond(await sendMessage(ctx.params.conversationId, await req.json(), session), 201),
)
