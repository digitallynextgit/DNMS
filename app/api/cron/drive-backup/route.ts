import { withCron } from "@/server/cron-auth"
import { runScheduledDriveBackup } from "@/features/drive/server/drive-backup.service"

// Manual / external-cron trigger; server/scheduler.ts also runs this job in-process. Does nothing
// unless the 2 AM IST run is due.

export const runtime = "nodejs"
export const maxDuration = 300

export const GET = withCron(
  "drive-backup",
  async () => (await runScheduledDriveBackup()) ?? { skipped: "Not due" },
)
