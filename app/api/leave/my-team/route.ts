import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getMyTeamLeaveRequests } from "@/features/leave/server/leave.service"

// Managers are found by reporting line - no permission required.
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
