import { withErrorHandler } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { getPublicAttendanceSnapshot } from "@/features/attendance/server/attendance-public.queries"

// Always live - never statically cached, so the marketing widget reflects the
// latest working day's attendance.
export const dynamic = "force-dynamic"

// GET /api/marketing/attendance-snapshot
// PUBLIC (unauthenticated) - returns a minimal attendance snapshot (name +
// check-in time + status) for up to 9 active employees, for the homepage.
export const GET = withErrorHandler(async () => ok(await getPublicAttendanceSnapshot(9)))
