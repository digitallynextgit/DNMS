import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { addItem } from "@/features/hr-checklists/server/checklists.service"

// POST /api/hr-checklists/:id/items - add an item to a live checklist, e.g. one
// more department clearance for a leaver who worked across teams.
export const POST = withSession(async (req: NextRequest, ctx) =>
  respond(await addItem(ctx.params.id, await req.json()), 201),
)
