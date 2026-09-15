import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { cancelChecklist } from "@/features/hr-checklists/server/checklists.service"

export const POST = withSession(async (req: NextRequest, ctx) =>
  respond(await cancelChecklist(ctx.params.id, await req.json().catch(() => ({})))),
)
