import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { addOption } from "@/features/votes/server/votes.service"

export const POST = withSession(async (req: NextRequest, ctx, session) =>
  respond(await addOption(ctx.params.id, await req.json(), session), 201),
)
