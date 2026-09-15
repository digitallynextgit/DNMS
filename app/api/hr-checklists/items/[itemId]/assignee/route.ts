import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { reassignItem } from "@/features/hr-checklists/server/checklists.service"

// PATCH - hand one item to somebody else, e.g. a stand-in while a head is away.
export const PATCH = withSession(async (req: NextRequest, ctx) =>
  respond(await reassignItem(ctx.params.itemId, await req.json())),
)
