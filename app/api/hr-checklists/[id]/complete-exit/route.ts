import { withSession, respond } from "@/server/api-handler"
import { completeExitChecklist } from "@/features/hr-checklists/server/exit.service"

// HR's final sign-off. Refuses with 409 and the outstanding clearances named
// while any required one is unsigned - the document's "until all department
// clearances are signed, relieving will not be issued", enforced.
export const POST = withSession(async (_req, ctx) =>
  respond(await completeExitChecklist(ctx.params.id)),
)
