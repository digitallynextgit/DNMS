import { withErrorHandler } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { getPublicHolidays } from "@/features/attendance/server/attendance-public.queries"

export const dynamic = "force-dynamic"

// GET /api/marketing/holidays?year=2026&month=8
// PUBLIC (unauthenticated) - company holidays (name + day) for the given month.
export const GET = withErrorHandler(async (req) => {
  const url = new URL(req.url)
  const year = Number(url.searchParams.get("year"))
  const month = Number(url.searchParams.get("month")) // 1–12
  return ok(await getPublicHolidays(year, month))
})
