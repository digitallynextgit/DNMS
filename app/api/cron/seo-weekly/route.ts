import { withCron } from "@/server/cron-auth"
import { runSeoWeeklyJob } from "@/features/seo/server/seo.jobs"

// Manual / external-cron trigger; server/scheduler.ts also runs this job in-process.

export const runtime = "nodejs"
export const maxDuration = 300

export const GET = withCron("seo-weekly", async () => {
  try {
    const result = await runSeoWeeklyJob()
    if (result.skipped === "gsc") {
      throw new Error("Search Console is not configured")
    }
    return result
  } catch (error) {
    console.error("[SEO_WEEKLY_CRON]", error)
    throw error
  }
})
