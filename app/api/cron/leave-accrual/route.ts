import { NextRequest } from "next/server"
import { withCron } from "@/server/cron-auth"
import { runMonthlyAccrual } from "@/features/leave/server/leave-accrual.service"

// Monthly leave accrual. Recomputes each active employee's `accrued` from their
// `allocated` entitlement (idempotent, self-healing). Schedule on the 1st:
//   GET /api/cron/leave-accrual  with header  Authorization: Bearer <CRON_SECRET>
// ?year=YYYY optional (defaults to the current year).
//
// Runs once per tenant (M4) - see withCron.
export const dynamic = "force-dynamic"

export const GET = withCron("leave-accrual", async (req: NextRequest) => {
  const yearParam = req.nextUrl.searchParams.get("year")
  const year = yearParam ? Number(yearParam) : new Date().getFullYear()
  return { year, ...(await runMonthlyAccrual(year)) }
})
