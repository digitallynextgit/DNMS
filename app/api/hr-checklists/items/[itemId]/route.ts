import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { setItemDone } from "@/features/hr-checklists/server/checklists.service"

// Assignee-gated, not permission-gated - setItemDone() decides.
export const PATCH = withSession(async (req: NextRequest, ctx) =>
  respond(await setItemDone(ctx.params.itemId, await req.json())),
)
