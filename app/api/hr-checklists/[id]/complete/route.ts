import { withSession, respond } from "@/server/api-handler"
import { completeOnboarding } from "@/features/hr-checklists/server/checklists.service"

// Onboarding only - exits go through complete-exit, which issues relieving and deactivates the account.
export const POST = withSession(async (_req, ctx) =>
  respond(await completeOnboarding(ctx.params.id)),
)
