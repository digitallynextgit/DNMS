import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getWfhRequests, applyWfh } from "@/features/wfh/server/wfh.service"

type WfhFilters = {
  status?: string
  employeeId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

// GET /api/wfh/requests - list WFH requests (scoped to the caller unless they can approve).
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const filters: WfhFilters = {}
  if (sp.has("status")) filters.status = sp.get("status")!
  if (sp.has("employeeId")) filters.employeeId = sp.get("employeeId")!
  if (sp.has("from")) filters.from = sp.get("from")!
  if (sp.has("to")) filters.to = sp.get("to")!
  if (sp.has("page")) filters.page = Number(sp.get("page"))
  if (sp.has("limit")) filters.limit = Number(sp.get("limit"))
  return respond(await getWfhRequests(filters))
})

// POST /api/wfh/requests - apply for a WFH day.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { date: string; reason?: string; isEmergency?: boolean }
  return respond(await applyWfh(body))
})
