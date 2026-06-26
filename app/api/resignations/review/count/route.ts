import { withErrorHandler, respond } from "@/server/api-handler"
import { getPendingResignationCount } from "@/features/resignations/server/resignations.service"

// GET /api/resignations/review/count - number of PENDING resignations the user may review.
export const GET = withErrorHandler(async () => respond(await getPendingResignationCount()))
