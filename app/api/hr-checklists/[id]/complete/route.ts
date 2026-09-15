import { withSession, respond } from "@/server/api-handler"
import { completeOnboarding } from "@/features/hr-checklists/server/checklists.service"

// Completing an ONBOARDING checklist. Exits are NOT completed here: finishing
// one issues relieving and deactivates an account, so it has its own guarded
// endpoint once Phase 3 lands.
export const POST = withSession(async (_req, ctx) =>
  respond(await completeOnboarding(ctx.params.id)),
)
