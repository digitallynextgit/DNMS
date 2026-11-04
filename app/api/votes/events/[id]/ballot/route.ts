import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { castBallot } from "@/features/votes/server/votes.service"

// One ballot per person per event: a second call while voting is open changes it.
export const PUT = withSession(async (req: NextRequest, ctx, session) =>
  respond(await castBallot(ctx.params.id, await req.json(), session)),
)
