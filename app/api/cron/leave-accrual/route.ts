import { NextRequest, NextResponse } from "next/server"
import { assertCron } from "@/server/cron-auth"
import { runMonthlyAccrual } from "@/features/leave/server/leave-accrual.service"

// Monthly leave accrual. Recomputes each active employee's `accrued` from their
// `allocated` entitlement (idempotent, self-healing). Schedule on the 1st:
//   GET /api/cron/leave-accrual  with header  Authorization: Bearer <CRON_SECRET>
// ?year=YYYY optional (defaults to the current year).
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const denied = assertCron(req)
  if (denied) return denied

  const yearParam = req.nextUrl.searchParams.get("year")
  const year = yearParam ? Number(yearParam) : new Date().getFullYear()
  const result = await runMonthlyAccrual(year)
  return NextResponse.json({ ranAt: new Date().toISOString(), year, ...result })
}
