import { NextRequest, NextResponse } from "next/server"
import { runSeoDailyJob } from "@/features/seo/server/seo.jobs"

// The daily accident monitor (SEO plan step 9). Checks every active property's
// money pages for uptime + noindex and robots.txt for a blanket block, and
// notifies the project owner ONLY when the state changes.
//
// The job itself lives in seo.jobs.ts because server/scheduler.ts also runs it
// in-process; this route is the manual trigger and the external-cron entry.
// Auth: Authorization: Bearer <CRON_SECRET>

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    return NextResponse.json({ success: true, ...(await runSeoDailyJob()) })
  } catch (error) {
    console.error("[SEO_DAILY_CRON]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
