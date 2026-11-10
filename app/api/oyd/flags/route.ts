import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listFlags, raiseFlag } from "@/features/oyd/server/oyd.service"

export const GET = withSession(async (_req: NextRequest, _ctx, session) =>
  respond(await listFlags(session)),
)

// Counts at once from HR or the employee's Reporting Manager; anyone else's waits for them.
export const POST = withSession(async (req: NextRequest, _ctx, session) =>
  respond(await raiseFlag(await req.json(), session), 201),
)
