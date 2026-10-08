import { withErrorHandler } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { inMarketingTenant } from "@/server/public-api"
import { getPublicHolidays } from "@/features/attendance/server/attendance-public.queries"

// PUBLIC. inMarketingTenant() because there is no session, so the tenant guard would refuse the query.
export const GET = withErrorHandler(async (req) => {
  const url = new URL(req.url)
  const year = Number(url.searchParams.get("year"))
  const month = Number(url.searchParams.get("month")) // 1-12
  return ok(await inMarketingTenant(() => getPublicHolidays(year, month)), {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  })
})
