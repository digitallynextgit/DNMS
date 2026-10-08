import { withCron } from "@/server/cron-auth"
import { runWeeklyWorkDigest } from "@/features/projects/server/work-digest.service"

// Weekly (Monday morning), for the last complete Mon-Sun. The period is claimed with a unique insert
// into digest_runs, so repeats return {skipped:true}. server/scheduler.ts also runs this job.

export const runtime = "nodejs"
// The claim is an INSERT; a cached response would report someone else's run.
export const dynamic = "force-dynamic"

export const GET = withCron("work-digest", async () => {
  try {
    return await runWeeklyWorkDigest()
  } catch (error) {
    console.error("[CRON_WORK_DIGEST]", error)
    throw error
  }
})
