import { withSession, respond } from "@/server/api-handler"
import { deleteFullFinal, updateFullFinal } from "@/features/full-final/server/fnf.service"

export const PATCH = withSession(async (req, ctx) =>
  respond(await updateFullFinal(ctx.params.id, await req.json().catch(() => null))),
)

export const DELETE = withSession(async (_req, ctx) =>
  respond(await deleteFullFinal(ctx.params.id)),
)
