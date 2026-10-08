import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { addItem } from "@/features/hr-checklists/server/checklists.service"

export const POST = withSession(async (req: NextRequest, ctx) =>
  respond(await addItem(ctx.params.id, await req.json()), 201),
)
