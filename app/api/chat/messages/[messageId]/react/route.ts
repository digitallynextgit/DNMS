import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { toggleReaction } from "@/features/chat/server/chat.service"

// conversationId comes in the body so the service can check membership first.
export const POST = withSession(async (req: NextRequest, ctx, session) => {
  const { conversationId, emoji } = (await req.json()) as {
    conversationId: string
    emoji: string
  }
  return respond(await toggleReaction(conversationId, ctx.params.messageId, emoji, session))
})
