import { NextRequest, NextResponse } from "next/server"
import { runMonthlyAccrual } from "@/features/leave/server/leave-accrual.service"

// DEPRECATED endpoint kept for the existing scheduled job. EL is no longer a
// special case: monthly accrual is now generalized for every leave type via the
// policy matrix + accrual method (EL still gates on probation + 6 months inside
// the accrual engine). This simply delegates to the unified monthly accrual.
//   GET /api/cron/el-accrual  with header  Authorization: Bearer <CRON_SECRET>
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const year = new Date().getFullYear()
    const result = await runMonthlyAccrual(year)
    return NextResponse.json({ success: true, deprecated: true, year, ...result })
  } catch (error) {
    console.error("[EL_ACCRUAL_CRON]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
