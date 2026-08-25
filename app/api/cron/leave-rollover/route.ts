import { NextRequest } from "next/server"
import { withCron } from "@/server/cron-auth"
import { rolloverYear } from "@/features/leave/server/leave-accrual.service"

// Year-end leave rollover. Runs once per tenant (M4).
export const dynamic = "force-dynamic"

export const GET = withCron("leave-rollover", async (req: NextRequest) => {
  const yearParam = req.nextUrl.searchParams.get("year")
  const toYear = yearParam ? Number(yearParam) : new Date().getFullYear()
  return { year: toYear, ...(await rolloverYear(toYear)) }
})
