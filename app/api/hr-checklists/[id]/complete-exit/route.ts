import { withSession, respond } from "@/server/api-handler"
import { completeExitChecklist } from "@/features/hr-checklists/server/exit.service"

// HR's final sign-off: 409 naming the outstanding clearances while any required one is unsigned.
export const POST = withSession(async (_req, ctx) =>
  respond(await completeExitChecklist(ctx.params.id)),
)
