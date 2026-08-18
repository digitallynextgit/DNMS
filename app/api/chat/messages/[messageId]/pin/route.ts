import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { togglePin } from "@/features/chat/server/chat.service"

// POST /api/chat/messages/:id/pin - toggles, because a pin button that only
// pins would need a second route to undo itself.
export const POST = withSession(async (_req: NextRequest, ctx, session) =>
  respond(await togglePin(ctx.params.messageId, session)),
)
