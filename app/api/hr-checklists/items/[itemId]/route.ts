import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { setItemDone } from "@/features/hr-checklists/server/checklists.service"

// PATCH - tick or untick. Assignee-gated, not permission-gated: a clearance is
// its assignee's to sign, and setItemDone() decides that.
export const PATCH = withSession(async (req: NextRequest, ctx) =>
  respond(await setItemDone(ctx.params.itemId, await req.json())),
)
