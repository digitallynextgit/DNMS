import { withCron } from "@/server/cron-auth"
import { runSeoDailyJob } from "@/features/seo/server/seo.jobs"

// Manual / external-cron trigger; server/scheduler.ts also runs this job in-process.

export const runtime = "nodejs"
export const maxDuration = 300

export const GET = withCron("seo-daily", async () => {
  try {
    return await runSeoDailyJob()
  } catch (error) {
    console.error("[SEO_DAILY_CRON]", error)
    throw error
  }
})
