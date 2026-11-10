import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listFlaggablePeople } from "@/features/oyd/server/oyd.service"

export const GET = withSession(async (_req: NextRequest, _ctx, session) =>
  respond(await listFlaggablePeople(session)),
)
