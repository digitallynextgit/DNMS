import { withCron } from "@/server/cron-auth"
import { runSeoWeeklyJob } from "@/features/seo/server/seo.jobs"

// Weekly Search Console pull for every active SEO property, then vitals, GA4,
// the technical audit, the scorecard and the 30-day content reviews.
//
// The job itself lives in seo.jobs.ts because server/scheduler.ts also runs it
// in-process; this route is the manual trigger and the external-cron entry.
// Auth: Authorization: Bearer <CRON_SECRET>

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
    // Rethrown so forEachTenant records it against this tenant and continues.
    throw error
  }
})
