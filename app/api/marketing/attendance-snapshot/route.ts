import { withErrorHandler } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { inMarketingTenant } from "@/server/public-api"
import { getPublicAttendanceSnapshot } from "@/features/attendance/server/attendance-public.queries"

// Always live - never statically cached, so the marketing widget reflects the
// latest working day's attendance.
export const dynamic = "force-dynamic"

// GET /api/marketing/attendance-snapshot
//
// PUBLIC (unauthenticated) - a minimal attendance snapshot (name + check-in time
// + status) for up to 9 active employees, for the homepage widget. The query
// itself is built for this: no ids, emails, photos or departments leave it.
//
// Wrapped in inMarketingTenant() for the same reason as the holidays route - no
// session means no tenant context, and the guard refuses rather than guessing.
export const GET = withErrorHandler(async () =>
  ok(await inMarketingTenant(() => getPublicAttendanceSnapshot(9))),
)
