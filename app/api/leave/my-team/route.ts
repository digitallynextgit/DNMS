import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getMyTeamLeaveRequests } from "@/features/leave/server/leave.service"

// GET /api/leave/my-team - the current user's direct reports' leave requests
// (managers, identified by the reporting relationship - no permission required).
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = new URL(req.url).searchParams
  return respond(
    await getMyTeamLeaveRequests({
      status: sp.get("status") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    }),
  )
})
