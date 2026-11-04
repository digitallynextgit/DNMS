import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { updateOption, deleteOption } from "@/features/votes/server/votes.service"

export const PATCH = withSession(async (req: NextRequest, ctx, session) =>
  respond(await updateOption(ctx.params.optionId, await req.json(), session)),
)

export const DELETE = withSession(async (_req: NextRequest, ctx, session) =>
  respond(await deleteOption(ctx.params.optionId, session)),
)
