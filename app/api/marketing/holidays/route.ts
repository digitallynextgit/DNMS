import { withErrorHandler } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { inMarketingTenant } from "@/server/public-api"
import { getPublicHolidays } from "@/features/attendance/server/attendance-public.queries"

export const dynamic = "force-dynamic"

// GET /api/marketing/holidays?year=2026&month=8
//
// PUBLIC (unauthenticated) - company holidays (name + day) for the given month.
//
// Wrapped in inMarketingTenant(): there is no session here, so the tenant guard
// has nothing to scope on and refuses the query outright under strict
// enforcement. Holidays are company-wide and non-personal, and the company in
// question is the one whose marketing site this is.
export const GET = withErrorHandler(async (req) => {
  const url = new URL(req.url)
  const year = Number(url.searchParams.get("year"))
  const month = Number(url.searchParams.get("month")) // 1-12
  return ok(await inMarketingTenant(() => getPublicHolidays(year, month)))
})
