import { withErrorHandler, respond } from "@/server/api-handler"
import { getEligibleLeaveTypes } from "@/features/leave/server/leave.service"

// GET /api/leave/types/eligible - leave types the current user can actually apply
// for (probation -> unpaid only; Maternity -> female employees only).
export const GET = withErrorHandler(async () => respond(await getEligibleLeaveTypes()))
