import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { deleteMessage, editMessage } from "@/features/chat/server/chat.service"
import { deleteScopeSchema } from "@/features/chat/schemas/chat.schema"

export const PATCH = withSession(async (req: NextRequest, ctx, session) =>
  respond(await editMessage(ctx.params.messageId, await req.json(), session)),
)

// Scope defaults to "me" (hide for the caller only) - the safer choice.
export const DELETE = withSession(async (req: NextRequest, ctx, session) => {
  const parsed = deleteScopeSchema.safeParse(req.nextUrl.searchParams.get("scope") ?? "me")
  return respond(
    await deleteMessage(ctx.params.messageId, parsed.success ? parsed.data : "me", session),
  )
})
