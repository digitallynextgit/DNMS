import { withErrorHandler, respond } from "@/server/api-handler"
import { getPendingResignationCount } from "@/features/resignations/server/resignations.service"

export const GET = withErrorHandler(async () => respond(await getPendingResignationCount()))
