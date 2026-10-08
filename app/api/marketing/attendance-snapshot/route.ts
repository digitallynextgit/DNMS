import { withErrorHandler } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { inMarketingTenant } from "@/server/public-api"
import { getPublicAttendanceSnapshot } from "@/features/attendance/server/attendance-public.queries"

export const dynamic = "force-dynamic"

// PUBLIC homepage widget: name, check-in time and status only. inMarketingTenant() because there is
// no session, so the tenant guard would refuse the query.
export const GET = withErrorHandler(async () =>
  ok(await inMarketingTenant(() => getPublicAttendanceSnapshot(9)), {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  }),
)
