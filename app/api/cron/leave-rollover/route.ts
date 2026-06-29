import { NextRequest, NextResponse } from "next/server"
import { rolloverYear } from "@/features/leave/server/leave-accrual.service"

// Annual leave rollover. Seeds the new year's balances from the policy matrix
// (employment-type entitlements) and carries forward leftover days, capped per
// leave type (maxCarryDays). Everything else lapses. Schedule on Jan 1:
//   GET /api/cron/leave-rollover  with header  Authorization: Bearer <CRON_SECRET>
// ?year=YYYY optional (the year to roll INTO; defaults to the current year).
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const yearParam = new URL(req.url).searchParams.get("year")
    const toYear = yearParam ? Number(yearParam) : new Date().getFullYear()
    const result = await rolloverYear(toYear)
    return NextResponse.json({ success: true, year: toYear, ...result })
  } catch (error) {
    console.error("[LEAVE_ROLLOVER_CRON]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
