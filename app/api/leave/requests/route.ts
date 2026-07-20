import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getLeaveRequests, applyLeave } from "@/features/leave/server/leave.service"

// GET /api/leave/requests?status=&employeeId=&leaveTypeId=&from=&to=&page=&limit=
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const filters: {
    status?: string
    employeeId?: string
    leaveTypeId?: string
    from?: string
    to?: string
    page?: number
    limit?: number
  } = {}
  if (sp.get("status")) filters.status = sp.get("status")!
  if (sp.get("employeeId")) filters.employeeId = sp.get("employeeId")!
  if (sp.get("leaveTypeId")) filters.leaveTypeId = sp.get("leaveTypeId")!
  if (sp.get("from")) filters.from = sp.get("from")!
  if (sp.get("to")) filters.to = sp.get("to")!
  if (sp.get("page")) filters.page = Number(sp.get("page"))
  if (sp.get("limit")) filters.limit = Number(sp.get("limit"))
  return respond(await getLeaveRequests(filters))
})

// POST /api/leave/requests - apply for leave.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as {
    leaveTypeId: string
    startDate: string
    endDate: string
    reason?: string
    isHalfDay?: boolean
    emailBody?: string
    emailSubject?: string
  }
  return respond(await applyLeave(body))
})
