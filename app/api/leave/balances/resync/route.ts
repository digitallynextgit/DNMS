import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { resyncLeaveBalances } from "@/features/leave/server/leave-accrual.service"

// Idempotent: (re)generates balances from the policy matrix.
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
