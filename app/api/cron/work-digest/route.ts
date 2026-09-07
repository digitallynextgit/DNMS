import { withCron } from "@/server/cron-auth"
import { runWeeklyWorkDigest } from "@/features/projects/server/work-digest.service"

// The Monday digest: what last week left behind - tasks finished with nothing
// logged against them, open work serving no goal, goals past their date, output
// owed or sent back for revision. Managers get their projects and teams;
// everyone else gets their own rows.
//
// Run WEEKLY, Monday morning. The period reported is the last complete Mon-Sun,
// so a late run says exactly the same thing as a punctual one. Repeats are free:
// the period is claimed with a unique insert into `digest_runs` before anything
// is sent, so the second call of the day returns {"skipped":true} and mails
// nobody. The in-process scheduler (server/scheduler.ts) runs this too - this
// route is the manual trigger and the fallback.
//
//   0 8 * * 1 curl -s -H "Authorization: Bearer $CRON_SECRET" \
//       https://dnms.digitallynext.com/api/cron/work-digest
//
// Auth: Authorization: Bearer <CRON_SECRET>

export const runtime = "nodejs"
// The claim is an INSERT; a cached response would report someone else's run.
export const dynamic = "force-dynamic"

export const GET = withCron("work-digest", async () => {
  try {
    return await runWeeklyWorkDigest()
  } catch (error) {
    console.error("[CRON_WORK_DIGEST]", error)
    // Rethrown so forEachTenant records it against this tenant and continues.
    throw error
  }
})
