import { withCron } from "@/server/cron-auth"
import { runTaskReminders } from "@/features/notifications/server/task-reminder.service"

// Warns assignees that the hours booked for a task they are working on right now
// are about to run out - "15 minutes left of the time booked for X".
//
// Run EVERY MINUTE. The reminder is only useful at the minute it is due, and the
// engine is idempotent (progress is recorded per run of a task before anything is
// sent), so a frequent schedule costs one small query per minute and never
// duplicates. A slower schedule still works, but reminders land late by up to
// however long the gap is.
//
//   * * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
//       https://dnms.digitallynext.com/api/cron/task-reminders
//
// Auth: Authorization: Bearer <CRON_SECRET>

export const runtime = "nodejs"
// Every pass must see the live clock state; a cached response would re-serve an
// old run's counts and silently stop sending.
export const dynamic = "force-dynamic"

export const GET = withCron("task-reminders", async () => {
  try {
    return await runTaskReminders()
  } catch (error) {
    console.error("[CRON_TASK_REMINDERS]", error)
    // Rethrown so forEachTenant records it against this tenant and continues.
    throw error
  }
})
