import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { castBallot } from "@/features/votes/server/votes.service"

// PUT, not POST: a second call replaces the caller's earlier ballot.
export const PUT = withSession(async (req: NextRequest, ctx, session) =>
  respond(await castBallot(ctx.params.id, await req.json(), session)),
)
