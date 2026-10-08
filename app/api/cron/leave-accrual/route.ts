import { NextRequest } from "next/server"
import { withCron } from "@/server/cron-auth"
import { runMonthlyAccrual } from "@/features/leave/server/leave-accrual.service"

// Monthly (the 1st). Recomputes `accrued` from `allocated`, so it is idempotent. ?year= defaults to now.
export const dynamic = "force-dynamic"

export const GET = withCron("leave-accrual", async (req: NextRequest) => {
  const yearParam = req.nextUrl.searchParams.get("year")
  const year = yearParam ? Number(yearParam) : new Date().getFullYear()
  return { year, ...(await runMonthlyAccrual(year)) }
})
