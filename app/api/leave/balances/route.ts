import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getLeaveBalances, allocateLeave } from "@/features/leave/server/leave.service"

export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const employeeId = sp.get("employeeId") ?? undefined
  const yearParam = sp.get("year")
  const year = yearParam ? Number(yearParam) : undefined
  return respond(await getLeaveBalances(employeeId, year))
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as {
    employeeId: string
    leaveTypeId: string
    year: number
    allocated: number
    carried?: number
  }
  return respond(await allocateLeave(body))
})
