import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { deleteMessage, editMessage } from "@/features/chat/server/chat.service"
import { deleteScopeSchema } from "@/features/chat/schemas/chat.schema"

// PATCH - edit your own message.
export const PATCH = withSession(async (req: NextRequest, ctx, session) =>
  respond(await editMessage(ctx.params.messageId, await req.json(), session)),
)

// DELETE ?scope=me|everyone
//
// Defaults to "me", the safer of the two: an omitted scope hides the message
// from the caller rather than retracting it from the other person's screen.
export const DELETE = withSession(async (req: NextRequest, ctx, session) => {
  const parsed = deleteScopeSchema.safeParse(req.nextUrl.searchParams.get("scope") ?? "me")
  return respond(
    await deleteMessage(ctx.params.messageId, parsed.success ? parsed.data : "me", session),
  )
})
