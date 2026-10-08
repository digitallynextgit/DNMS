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

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as {
    date: string
    /** Last day of the range; omitted = a single-day request. */
    endDate?: string
    reason?: string
    isEmergency?: boolean
    emailSubject?: string
    emailBody?: string
  }
  return respond(await applyWfh(body))
})
