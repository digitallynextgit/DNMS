import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { actOnFlag } from "@/features/oyd/server/oyd.service"

// { action: confirm | reject | remove, note? } - removal keeps the row, so history stays whole.
export const PATCH = withSession(async (req: NextRequest, ctx, session) =>
  respond(await actOnFlag(ctx.params.id, await req.json(), session)),
)
