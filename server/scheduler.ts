import "server-only"

// =============================================================================
// In-process scheduler.
//
// Task reminders need minute-level precision ("warn me 15 minutes before"), and
// an external crontab is a fragile place to put that: it lives outside the repo,
// nobody reviews it, a rebuilt server loses it, and when it silently breaks the
// only symptom is a notification that never arrives. This runs the same job
// inside the Next server instead, so deploying the code IS installing the job.
//
// It does not replace app/api/cron/task-reminders - that route stays for manual
// triggering and as a fallback. Running BOTH is safe: the engine claims each
// reminder with a conditional update before sending, so whichever fires first
// wins and the other sends nothing.
//
// Deliberately limited to task reminders. The daily jobs (leave accrual,
// rollover, evaluations) are month- and year-boundary work where a double run or
// a missed run has real consequences, and a process that restarts on every
// deploy is the wrong owner for them. Those stay on cron - see docs/cron-jobs.md.
// =============================================================================

const INTERVAL_MS = 60_000

/** Wait before the first pass so boot is not competing with a DB round trip. */
const FIRST_RUN_DELAY_MS = 15_000

// Survives dev hot-reload: the module is re-evaluated on every edit, and a plain
// module-level flag would start a second, third, fourth interval each time.
const globalForScheduler = globalThis as unknown as {
  taskReminderTimer?: NodeJS.Timeout
  taskReminderRunning?: boolean
}

export function startTaskReminderScheduler(): void {
  if (globalForScheduler.taskReminderTimer) return // already started
  if (process.env.DISABLE_INLINE_SCHEDULER === "1") {
    console.log("[scheduler] task reminders disabled (DISABLE_INLINE_SCHEDULER=1)")
    return
  }

  const timer = setInterval(tick, INTERVAL_MS)
  // Do not hold the event loop open: the HTTP server keeps the process alive, and
  // an un-unref'd timer would delay a clean shutdown by up to a minute.
  timer.unref?.()
  globalForScheduler.taskReminderTimer = timer

  const first = setTimeout(tick, FIRST_RUN_DELAY_MS)
  first.unref?.()

  console.log("[scheduler] task reminders started (every 60s)")
}

async function tick(): Promise<void> {
  // A pass that outlives its interval (slow DB, big backlog) must not stack up
  // behind itself - skip this beat rather than run two at once.
  if (globalForScheduler.taskReminderRunning) return
  globalForScheduler.taskReminderRunning = true
  try {
    // Imported lazily so a failure in the reminder module can never stop the
    // server from booting - the scheduler is an enhancement, not a dependency.
    const { runTaskReminders } =
      await import("@/features/notifications/server/task-reminder.service")
    const result = await runTaskReminders()
    // Only log when something happened; a line a minute saying "0" is noise that
    // buries the lines that matter.
    if (result.sent > 0) {
      console.log(`[scheduler] sent ${result.sent} task reminder(s) of ${result.scanned} running`)
    }
  } catch (err) {
    console.error("[scheduler] task reminders failed:", err)
  } finally {
    globalForScheduler.taskReminderRunning = false
  }
}
