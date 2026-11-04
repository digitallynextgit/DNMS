import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { getEvent, updateEvent, deleteEvent } from "@/features/votes/server/votes.service"

export const GET = withSession(async (_req: NextRequest, ctx, session) =>
  respond(await getEvent(ctx.params.id, session)),
)

export const PATCH = withSession(async (req: NextRequest, ctx, session) =>
  respond(await updateEvent(ctx.params.id, await req.json(), session)),
)

export const DELETE = withSession(async (_req: NextRequest, ctx, session) =>
  respond(await deleteEvent(ctx.params.id, session)),
)
