import { withErrorHandler, respond } from "@/server/api-handler"
import { getWfhEligibility } from "@/features/wfh/server/wfh.service"

export const GET = withErrorHandler(async () => respond(await getWfhEligibility()))
