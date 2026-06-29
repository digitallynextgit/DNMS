import { NextRequest, NextResponse } from "next/server"
import { runMonthlyAccrual } from "@/features/leave/server/leave-accrual.service"

// Monthly leave accrual. Recomputes each active employee's `accrued` from their
// `allocated` entitlement (idempotent, self-healing). Schedule on the 1st:
//   GET /api/cron/leave-accrual  with header  Authorization: Bearer <CRON_SECRET>
// ?year=YYYY optional (defaults to the current year).
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const yearParam = req.nextUrl.searchParams.get("year")
  const year = yearParam ? Number(yearParam) : new Date().getFullYear()
  const result = await runMonthlyAccrual(year)
  return NextResponse.json({ ranAt: new Date().toISOString(), year, ...result })
}
