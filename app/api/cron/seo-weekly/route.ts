import { NextRequest, NextResponse } from "next/server"
import { assertCron } from "@/server/cron-auth"
import { runSeoWeeklyJob } from "@/features/seo/server/seo.jobs"

// Weekly Search Console pull for every active SEO property, then vitals, GA4,
// the technical audit, the scorecard and the 30-day content reviews.
//
// The job itself lives in seo.jobs.ts because server/scheduler.ts also runs it
// in-process; this route is the manual trigger and the external-cron entry.
// Auth: Authorization: Bearer <CRON_SECRET>

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const denied = assertCron(req)
  if (denied) return denied
  try {
    const result = await runSeoWeeklyJob()
    if (result.skipped === "gsc") {
      return NextResponse.json({ error: "Search Console is not configured" }, { status: 503 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[SEO_WEEKLY_CRON]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
