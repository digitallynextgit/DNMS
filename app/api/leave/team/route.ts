import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getTeamLeaveRequests } from "@/features/leave/server/leave.service"

// GET /api/leave/team?status=&page=&limit= - leave requests for direct reports.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const filters: { status?: string; page?: number; limit?: number } = {}
  if (sp.get("status")) filters.status = sp.get("status")!
  if (sp.get("page")) filters.page = Number(sp.get("page"))
  if (sp.get("limit")) filters.limit = Number(sp.get("limit"))
  return respond(await getTeamLeaveRequests(filters))
})
