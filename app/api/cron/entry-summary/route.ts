import { withCron } from "@/server/cron-auth"
import { runEntrySummary } from "@/features/attendance/server/entry-summary.service"

// Manual trigger for the morning entry summary; server/scheduler.ts runs the same job every
// minute, and each time slot is claimed per day, so both may call this.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withCron("entry-summary", async () => runEntrySummary())
