import { withCron } from "@/server/cron-auth"
import {
  runCalendarDigest,
  runCalendarReminders,
} from "@/features/projects/server/calendar-reminders.service"

// Daily: calendar row reminders (deadlines, publish dates); on Mondays also the column digest.
// server/scheduler.ts runs the same jobs inline; each claims its day, so both may call this.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withCron("calendar-reminders", async () => {
  const now = new Date()
  const reminders = await runCalendarReminders(now)
  const digest = now.getDay() === 1 ? await runCalendarDigest(now) : { sent: 0, skipped: true }
  return { reminders, digest }
})
