import { withErrorHandler, respond } from "@/server/api-handler"
import { getWfhEligibility } from "@/features/wfh/server/wfh.service"

// GET /api/wfh/eligibility - WFH tier/quota eligibility for the current user.
export const GET = withErrorHandler(async () => respond(await getWfhEligibility()))
