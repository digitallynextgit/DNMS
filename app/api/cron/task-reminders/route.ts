import { withCron } from "@/server/cron-auth"
import { runTaskReminders } from "@/features/notifications/server/task-reminder.service"

// Run every minute: a reminder is only useful when due, and the engine is idempotent.

export const runtime = "nodejs"
// Must see the live clock; a cached response would silently stop sending.
export const dynamic = "force-dynamic"

export const GET = withCron("task-reminders", async () => {
  try {
    return await runTaskReminders()
  } catch (error) {
    console.error("[CRON_TASK_REMINDERS]", error)
    throw error
  }
})
