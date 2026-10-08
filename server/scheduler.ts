import "server-only"
import { forEachTenant } from "@/server/tenant-jobs"

// In-process scheduler: deploying the code installs the jobs, with no crontab to lose.
// Every job here is safe to run twice (claimed in the DB or idempotent), so the matching
// /api/cron routes stay as manual triggers. Month/year-boundary jobs stay on external cron.

const INTERVAL_MS = 60_000

const UPTIME_INTERVAL_MS = 5 * 60_000
const UPTIME_FIRST_RUN_DELAY_MS = 30_000

// Daily jobs below tick hourly: a once-a-day timer is lost on every restart. Whether they
// already ran is decided in the database.
const RENEWAL_INTERVAL_MS = 60 * 60_000
const RENEWAL_FIRST_RUN_DELAY_MS = 45_000
/** Don't send renewal mail in the middle of the night. */
const RENEWAL_EARLIEST_HOUR = 9

/** Each tick sends a small batch, so a big campaign drains over several ticks. */
const CAMPAIGN_INTERVAL_MS = 30_000
const CAMPAIGN_FIRST_RUN_DELAY_MS = 20_000

const SEO_INTERVAL_MS = 60 * 60_000
const SEO_FIRST_RUN_DELAY_MS = 90_000
/** Don't crawl client sites before 7am IST. */
const SEO_EARLIEST_HOUR = 7

const WORK_DIGEST_INTERVAL_MS = 60 * 60_000
const WORK_DIGEST_FIRST_RUN_DELAY_MS = 120_000
/** Monday (getDay(): 0 = Sunday). */
const WORK_DIGEST_WEEKDAY = 1
const WORK_DIGEST_EARLIEST_HOUR = 8

const FIRST_RUN_DELAY_MS = 15_000

// On globalThis so dev hot-reload doesn't start duplicate intervals.
const globalForScheduler = globalThis as unknown as {
  taskReminderTimer?: NodeJS.Timeout
  taskReminderRunning?: boolean
  uptimeTimer?: NodeJS.Timeout
  uptimeRunning?: boolean
  renewalTimer?: NodeJS.Timeout
  renewalRunning?: boolean
  campaignTimer?: NodeJS.Timeout
  campaignRunning?: boolean
  seoTimer?: NodeJS.Timeout
  seoRunning?: boolean
  workDigestTimer?: NodeJS.Timeout
  workDigestRunning?: boolean
}

export function startTaskReminderScheduler(): void {
  if (globalForScheduler.taskReminderTimer) return
  if (process.env.DISABLE_INLINE_SCHEDULER === "1") {
    console.log("[scheduler] task reminders disabled (DISABLE_INLINE_SCHEDULER=1)")
    return
  }

  const timer = setInterval(tick, INTERVAL_MS)
  // Don't hold the event loop open and delay a clean shutdown.
  timer.unref?.()
  globalForScheduler.taskReminderTimer = timer

  const first = setTimeout(tick, FIRST_RUN_DELAY_MS)
  first.unref?.()

  console.log("[scheduler] task reminders started (every 60s)")
}

/** Watches client sites only - it cannot alert while DNMS itself is down. */
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
    await forEachTenant("uptime", async () => {
      const { runUptimeSweep } = await import("@/features/monitoring/server/uptime.service")
      const r = await runUptimeSweep()
      if (r.opened || r.recovered || r.escalated) {
        console.log(
          `[scheduler] uptime: ${r.checked} checked, ${r.down} down, ` +
            `${r.opened} new, ${r.recovered} recovered, ${r.escalated} escalated`,
        )
      }
    })
  } catch (err) {
    console.error("[scheduler] uptime sweep failed:", err)
  } finally {
    globalForScheduler.uptimeRunning = false
  }
}

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
  if (new Date().getHours() < RENEWAL_EARLIEST_HOUR) return

  globalForScheduler.renewalRunning = true
  try {
    await forEachTenant("renewals", async () => {
      const { runRenewalSweep } = await import("@/features/monitoring/server/renewals.service")
      const r = await runRenewalSweep()
      if (r.notified > 0) {
        console.log(
          `[scheduler] renewals: ${r.scanned} scanned, ${r.notified} notified, ` +
            `${r.overdue} overdue, ${r.escalated} escalated`,
        )
      }
    })
  } catch (err) {
    console.error("[scheduler] renewal sweep failed:", err)
  } finally {
    globalForScheduler.renewalRunning = false
  }
}

/** Drains the project-mailer queue (a big blast would time out inside the HTTP request). */
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
    await forEachTenant("campaigns", async () => {
      const { runCampaignQueue, requeueStuckSends } =
        await import("@/features/project-mailer/server/campaign-runner")
      // Rows stuck in SENDING are from a tick killed mid-flight; requeue them first.
      const requeued = await requeueStuckSends()
      if (requeued > 0) console.log(`[scheduler] campaigns: re-queued ${requeued} stuck send(s)`)

      const r = await runCampaignQueue()
      if (r.sent || r.failed) {
        console.log(
          `[scheduler] campaigns: ${r.sent} sent, ${r.failed} failed across ${r.campaigns} campaign(s)`,
        )
      }
    })
  } catch (err) {
    console.error("[scheduler] campaign queue failed:", err)
  } finally {
    globalForScheduler.campaignRunning = false
  }
}

async function tick(): Promise<void> {
  // Skip this beat if the previous pass is still running.
  if (globalForScheduler.taskReminderRunning) return
  globalForScheduler.taskReminderRunning = true
  try {
    await forEachTenant("task-reminders", async () => {
      // Lazy import: a broken job module must never stop the server booting.
      const { runTaskReminders } =
        await import("@/features/notifications/server/task-reminder.service")
      const result = await runTaskReminders()
      if (result.sent > 0) {
        console.log(`[scheduler] sent ${result.sent} task reminder(s) of ${result.scanned} running`)
      }
    })
  } catch (err) {
    console.error("[scheduler] task reminders failed:", err)
  } finally {
    globalForScheduler.taskReminderRunning = false
  }
}

/**
 * Daily monitor (once per calendar day) and weekly Search Console sync (when the stored
 * snapshot is behind the newest available window).
 */
export function startSeoScheduler(): void {
  if (globalForScheduler.seoTimer) return
  if (process.env.DISABLE_INLINE_SCHEDULER === "1") {
    console.log("[scheduler] seo disabled (DISABLE_INLINE_SCHEDULER=1)")
    return
  }

  const timer = setInterval(seoTick, SEO_INTERVAL_MS)
  timer.unref?.()
  globalForScheduler.seoTimer = timer

  const first = setTimeout(seoTick, SEO_FIRST_RUN_DELAY_MS)
  first.unref?.()

  console.log("[scheduler] seo started (hourly check, daily monitor + weekly sync)")
}

async function seoTick(): Promise<void> {
  if (globalForScheduler.seoRunning) return
  globalForScheduler.seoRunning = true
  try {
    await forEachTenant("seo", async () => {
      const { db } = await import("@/server/db")

      // Checked before importing the heavy job module (crawler, Google clients).
      const tracked = await db.seoProperty.count({ where: { isActive: true } })
      if (tracked === 0) return

      if (new Date().getHours() < SEO_EARLIEST_HOUR) return

      const { runSeoDailyJob, runSeoWeeklyJob } = await import("@/features/seo/server/seo.jobs")

      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const ranToday = await db.seoMonitorRun.count({ where: { createdAt: { gte: startOfDay } } })
      if (ranToday === 0) {
        const r = await runSeoDailyJob()
        console.log(
          `[scheduler] seo monitor: ${r.checked} checked, ${r.withIssues} with issues, ${r.notified} notified`,
        )
      }

      const { lastCompleteWindow } = await import("@/lib/gsc")
      const window = lastCompleteWindow()
      const have = await db.seoSnapshot.count({
        where: { periodEnd: new Date(`${window.end}T00:00:00.000Z`) },
      })
      // Against the tracked count, not zero: one site synced by hand must not mark the sweep done.
      if (have < tracked) {
        const r = await runSeoWeeklyJob()
        if (r.skipped === "gsc") {
          console.log("[scheduler] seo weekly skipped - Search Console not configured")
        } else {
          console.log(
            `[scheduler] seo weekly: ${r.synced} synced, ${r.failed} failed, ${r.notified} notified`,
          )
        }
      }
    })
  } catch (err) {
    console.error("[scheduler] seo sweep failed:", err)
  } finally {
    globalForScheduler.seoRunning = false
  }
}

/** Monday-morning digest; the `digest_runs` unique key makes sure only one send wins. */
export function startWorkDigestScheduler(): void {
  if (globalForScheduler.workDigestTimer) return
  if (process.env.DISABLE_INLINE_SCHEDULER === "1") {
    console.log("[scheduler] work digest disabled (DISABLE_INLINE_SCHEDULER=1)")
    return
  }

  const timer = setInterval(workDigestTick, WORK_DIGEST_INTERVAL_MS)
  timer.unref?.()
  globalForScheduler.workDigestTimer = timer

  const first = setTimeout(workDigestTick, WORK_DIGEST_FIRST_RUN_DELAY_MS)
  first.unref?.()

  console.log("[scheduler] work digest started (hourly check, Mondays from 08:00)")
}

async function workDigestTick(): Promise<void> {
  if (globalForScheduler.workDigestRunning) return

  const now = new Date()
  if (now.getDay() !== WORK_DIGEST_WEEKDAY || now.getHours() < WORK_DIGEST_EARLIEST_HOUR) return

  globalForScheduler.workDigestRunning = true
  try {
    await forEachTenant("work-digest", async () => {
      const { runWeeklyWorkDigest } = await import("@/features/projects/server/work-digest.service")
      const r = await runWeeklyWorkDigest()
      if (!r.skipped) console.log(`[scheduler] work digest: ${r.sent} recipient(s)`)
    })
  } catch (err) {
    console.error("[scheduler] work digest failed:", err)
  } finally {
    globalForScheduler.workDigestRunning = false
  }
}
