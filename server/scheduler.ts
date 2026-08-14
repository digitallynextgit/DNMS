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
// The daily jobs (leave accrual, rollover, evaluations) are month- and
// year-boundary work where a double run or a missed run has real consequences,
// and a process that restarts on every deploy is the wrong owner for them. Those
// stay on cron - see docs/cron-jobs.md.
//
// UPTIME is here for the opposite reason. A missed uptime tick costs nothing -
// the next one is five minutes later - and the job is worthless unless it
// actually runs. On 14 Aug 2026 a site was down eleven hours before anyone
// noticed; `seo_monitor_runs` was empty at the time because nothing was calling
// the cron routes. Putting this on the same crontab would have reproduced that
// exact failure, so deploying the code installs the job.
//
// KNOWN LIMIT: an in-process monitor cannot detect that DNMS ITSELF is down, and
// cannot alert while it is. It watches client sites, not its own host. Pair it
// with one external ping on DNMS if you want that covered too.
// =============================================================================

const INTERVAL_MS = 60_000

/** Uptime sweep cadence. Five minutes is the outage-detection floor. */
const UPTIME_INTERVAL_MS = 5 * 60_000
const UPTIME_FIRST_RUN_DELAY_MS = 30_000

/**
 * Renewal sweep. Conceptually a DAILY job, but ticked hourly on purpose: a
 * server that restarts at 09:05 would miss a once-a-day timer entirely, and
 * missing the day a domain expires is the whole thing we are trying to prevent.
 * Running it hourly is safe because the sweep dedupes per asset per day in the
 * database (see renewals.service), not with an in-memory flag.
 */
const RENEWAL_INTERVAL_MS = 60 * 60_000
const RENEWAL_FIRST_RUN_DELAY_MS = 45_000
/** Don't send renewal mail in the middle of the night. */
const RENEWAL_EARLIEST_HOUR = 9

/**
 * Campaign queue. Tight cadence because a queued blast should start going out
 * promptly, and each tick only processes a small batch - so a big campaign
 * drains over several ticks instead of hogging the process.
 */
const CAMPAIGN_INTERVAL_MS = 30_000
const CAMPAIGN_FIRST_RUN_DELAY_MS = 20_000

/** Wait before the first pass so boot is not competing with a DB round trip. */
const FIRST_RUN_DELAY_MS = 15_000

// Survives dev hot-reload: the module is re-evaluated on every edit, and a plain
// module-level flag would start a second, third, fourth interval each time.
const globalForScheduler = globalThis as unknown as {
  taskReminderTimer?: NodeJS.Timeout
  taskReminderRunning?: boolean
  uptimeTimer?: NodeJS.Timeout
  uptimeRunning?: boolean
  renewalTimer?: NodeJS.Timeout
  renewalRunning?: boolean
  campaignTimer?: NodeJS.Timeout
  campaignRunning?: boolean
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

/**
 * Uptime sweep, on the same in-process timer for the same reason: a monitor that
 * depends on an uninstalled crontab is a monitor that does not exist.
 */
export function startUptimeScheduler(): void {
  if (globalForScheduler.uptimeTimer) return
  if (process.env.DISABLE_INLINE_SCHEDULER === "1") {
    console.log("[scheduler] uptime disabled (DISABLE_INLINE_SCHEDULER=1)")
    return
  }

  const timer = setInterval(uptimeTick, UPTIME_INTERVAL_MS)
  timer.unref?.()
  globalForScheduler.uptimeTimer = timer

  const first = setTimeout(uptimeTick, UPTIME_FIRST_RUN_DELAY_MS)
  first.unref?.()

  console.log("[scheduler] uptime monitor started (every 5m)")
}

async function uptimeTick(): Promise<void> {
  if (globalForScheduler.uptimeRunning) return
  globalForScheduler.uptimeRunning = true
  try {
    const { runUptimeSweep } = await import("@/features/monitoring/server/uptime.service")
    const r = await runUptimeSweep()
    // Quiet unless something actually happened - a line every 5 minutes saying
    // "all up" is how people learn to stop reading the logs.
    if (r.opened || r.recovered || r.escalated) {
      console.log(
        `[scheduler] uptime: ${r.checked} checked, ${r.down} down, ` +
          `${r.opened} new, ${r.recovered} recovered, ${r.escalated} escalated`,
      )
    }
  } catch (err) {
    console.error("[scheduler] uptime sweep failed:", err)
  } finally {
    globalForScheduler.uptimeRunning = false
  }
}

/**
 * Renewal reminders, in-process for the same reason as uptime: the cron routes
 * on this deployment have never been called, so anything that depended on them
 * would silently never run.
 */
export function startRenewalScheduler(): void {
  if (globalForScheduler.renewalTimer) return
  if (process.env.DISABLE_INLINE_SCHEDULER === "1") {
    console.log("[scheduler] renewals disabled (DISABLE_INLINE_SCHEDULER=1)")
    return
  }

  const timer = setInterval(renewalTick, RENEWAL_INTERVAL_MS)
  timer.unref?.()
  globalForScheduler.renewalTimer = timer

  const first = setTimeout(renewalTick, RENEWAL_FIRST_RUN_DELAY_MS)
  first.unref?.()

  console.log("[scheduler] renewal reminders started (hourly, from 09:00)")
}

async function renewalTick(): Promise<void> {
  if (globalForScheduler.renewalRunning) return
  // Overnight ticks do nothing: an expiry warning at 03:00 wakes people for
  // something that can be handled at 09:00. Outages are the opposite - those
  // alert whatever the hour.
  if (new Date().getHours() < RENEWAL_EARLIEST_HOUR) return

  globalForScheduler.renewalRunning = true
  try {
    const { runRenewalSweep } = await import("@/features/monitoring/server/renewals.service")
    const r = await runRenewalSweep()
    if (r.notified > 0) {
      console.log(
        `[scheduler] renewals: ${r.scanned} scanned, ${r.notified} notified, ` +
          `${r.overdue} overdue, ${r.escalated} escalated`,
      )
    }
  } catch (err) {
    console.error("[scheduler] renewal sweep failed:", err)
  } finally {
    globalForScheduler.renewalRunning = false
  }
}

/**
 * Bulk email queue for the per-project mailers.
 *
 * Sending cannot happen in the HTTP request that starts a campaign: a
 * 2,000-recipient blast would time out halfway with no record of which half
 * went. The request writes one row per recipient and returns; this drains them.
 */
export function startCampaignScheduler(): void {
  if (globalForScheduler.campaignTimer) return
  if (process.env.DISABLE_INLINE_SCHEDULER === "1") {
    console.log("[scheduler] campaigns disabled (DISABLE_INLINE_SCHEDULER=1)")
    return
  }

  const timer = setInterval(campaignTick, CAMPAIGN_INTERVAL_MS)
  timer.unref?.()
  globalForScheduler.campaignTimer = timer

  const first = setTimeout(campaignTick, CAMPAIGN_FIRST_RUN_DELAY_MS)
  first.unref?.()

  console.log("[scheduler] campaign queue started (every 30s)")
}

async function campaignTick(): Promise<void> {
  if (globalForScheduler.campaignRunning) return
  globalForScheduler.campaignRunning = true
  try {
    const { runCampaignQueue, requeueStuckSends } =
      await import("@/features/project-mailer/server/campaign-runner")
    // Rows stuck in SENDING belong to a tick killed mid-flight (deploy, crash);
    // put them back before draining, or they are stranded forever.
    const requeued = await requeueStuckSends()
    if (requeued > 0) console.log(`[scheduler] campaigns: re-queued ${requeued} stuck send(s)`)

    const r = await runCampaignQueue()
    if (r.sent || r.failed) {
      console.log(
        `[scheduler] campaigns: ${r.sent} sent, ${r.failed} failed across ${r.campaigns} campaign(s)`,
      )
    }
  } catch (err) {
    console.error("[scheduler] campaign queue failed:", err)
  } finally {
    globalForScheduler.campaignRunning = false
  }
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
