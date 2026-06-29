import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { resyncLeaveBalances } from "@/features/leave/server/leave-accrual.service"

// POST /api/leave/balances/resync - (re)generate balances from the policy matrix
// for all active employees for a year. Idempotent. Requires leave:approve.
export const POST = withErrorHandler(async (req: NextRequest) => {
  let year: number | undefined
  try {
    const body = (await req.json()) as { year?: number }
    if (body?.year) year = Number(body.year)
  } catch {
    // no body - default to current year
  }
  return respond(await resyncLeaveBalances(year))
})
