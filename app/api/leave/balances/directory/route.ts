import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getAllLeaveBalances } from "@/features/leave/server/leave.service"

// GET /api/leave/balances/directory?year= - every active employee's leave
// balances by type for the year (HR view). Requires leave:approve.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const yearParam = req.nextUrl.searchParams.get("year")
  const year = yearParam ? Number(yearParam) : undefined
  return respond(await getAllLeaveBalances(year))
})
