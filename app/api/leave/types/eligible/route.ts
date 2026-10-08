import { withErrorHandler, respond } from "@/server/api-handler"
import { getEligibleLeaveTypes } from "@/features/leave/server/leave.service"

// Probation -> unpaid only; Maternity -> female employees only.
export const GET = withErrorHandler(async () => respond(await getEligibleLeaveTypes()))
