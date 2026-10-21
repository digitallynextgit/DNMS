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

// Hourly, like the other daily jobs; the run itself decides whether 2 AM IST has passed today.
const DRIVE_BACKUP_INTERVAL_MS = 60 * 60_000
const DRIVE_BACKUP_FIRST_RUN_DELAY_MS = 150_000

// Hourly; the run itself is claimed per day, and only Fridays and Mondays send anything.
const WEEKLY_REVIEW_INTERVAL_MS = 60 * 60_000
const WEEKLY_REVIEW_FIRST_RUN_DELAY_MS = 180_000
const WEEKLY_REVIEW_EARLIEST_HOUR = 10

// Hourly: each recurring goal's month is created as soon as it begins; Mondays chase results.
const GOALS_INTERVAL_MS = 60 * 60_000
const GOALS_FIRST_RUN_DELAY_MS = 210_000
const GOAL_REMINDER_EARLIEST_HOUR = 10

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
  driveBackupTimer?: NodeJS.Timeout
  driveBackupRunning?: boolean
  weeklyReviewTimer?: NodeJS.Timeout
  weeklyReviewRunning?: boolean
  goalsTimer?: NodeJS.Timeout
  goalsRunning?: boolean
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

/**
 * Nightly copy of the Repository's Drive files to Backblaze (2 AM IST). Production only: a dev
 * machine shares the database, and the per-day claim would let it take the night's run.
 */
export function startDriveBackupScheduler(): void {
  if (globalForScheduler.driveBackupTimer) return
  if (process.env.DISABLE_INLINE_SCHEDULER === "1") {
    console.log("[scheduler] drive backup disabled (DISABLE_INLINE_SCHEDULER=1)")
    return
  }
  if (process.env.NODE_ENV !== "production") return

  const timer = setInterval(driveBackupTick, DRIVE_BACKUP_INTERVAL_MS)
  timer.unref?.()
  globalForScheduler.driveBackupTimer = timer

  const first = setTimeout(driveBackupTick, DRIVE_BACKUP_FIRST_RUN_DELAY_MS)
  first.unref?.()

  console.log("[scheduler] drive backup started (hourly check, daily from 02:00 IST)")
}

async function driveBackupTick(): Promise<void> {
  if (globalForScheduler.driveBackupRunning) return
  globalForScheduler.driveBackupRunning = true
  try {
    await forEachTenant("drive-backup", async () => {
      const { runScheduledDriveBackup } =
        await import("@/features/drive/server/drive-backup.service")
      const r = await runScheduledDriveBackup()
      if (r && !r.skipped) {
        console.log(
          `[scheduler] drive backup: ${r.checked} checked, ${r.copied} copied, ${r.failed} failed`,
        )
      }
    })
  } catch (err) {
    console.error("[scheduler] drive backup failed:", err)
  } finally {
    globalForScheduler.driveBackupRunning = false
  }
}

/**
 * Joinee weekly reviews: Friday 10 AM tells the reporting manager, Monday 10 AM chases the ones
 * still empty. Production only: a dev machine shares the database and could take the day's claim.
 */
export function startWeeklyReviewScheduler(): void {
  if (globalForScheduler.weeklyReviewTimer) return
  if (process.env.DISABLE_INLINE_SCHEDULER === "1") {
    console.log("[scheduler] weekly reviews disabled (DISABLE_INLINE_SCHEDULER=1)")
    return
  }
  if (process.env.NODE_ENV !== "production") return

  const timer = setInterval(weeklyReviewTick, WEEKLY_REVIEW_INTERVAL_MS)
  timer.unref?.()
  globalForScheduler.weeklyReviewTimer = timer

  const first = setTimeout(weeklyReviewTick, WEEKLY_REVIEW_FIRST_RUN_DELAY_MS)
  first.unref?.()

  console.log("[scheduler] weekly reviews started (hourly check, Fri and Mon from 10:00)")
}

async function weeklyReviewTick(): Promise<void> {
  if (globalForScheduler.weeklyReviewRunning) return
  const now = new Date()
  const day = now.getDay()
  if ((day !== 5 && day !== 1) || now.getHours() < WEEKLY_REVIEW_EARLIEST_HOUR) return

  globalForScheduler.weeklyReviewRunning = true
  try {
    await forEachTenant("weekly-reviews", async () => {
      const { runWeeklyReviewReminders } =
        await import("@/features/joinee-scorecard/server/weekly-review.service")
      const r = await runWeeklyReviewReminders(now)
      if (!r.skipped) console.log(`[scheduler] weekly reviews: ${r.sent} reminder(s)`)
    })
  } catch (err) {
    console.error("[scheduler] weekly reviews failed:", err)
  } finally {
    globalForScheduler.weeklyReviewRunning = false
  }
}

/**
 * Recurring goals: this month's edition (copied from the last) as soon as the month starts, and on
 * Mondays from 10 AM a nudge to owners who entered no results last week. Production only: a dev
 * machine shares the database and could take the Monday claim.
 */
export function startGoalScheduler(): void {
  if (globalForScheduler.goalsTimer) return
  if (process.env.DISABLE_INLINE_SCHEDULER === "1") {
    console.log("[scheduler] goals disabled (DISABLE_INLINE_SCHEDULER=1)")
    return
  }
  if (process.env.NODE_ENV !== "production") return

  const timer = setInterval(goalsTick, GOALS_INTERVAL_MS)
  timer.unref?.()
  globalForScheduler.goalsTimer = timer

  const first = setTimeout(goalsTick, GOALS_FIRST_RUN_DELAY_MS)
  first.unref?.()

  console.log("[scheduler] goals started (hourly monthly editions, Monday result reminders)")
}

async function goalsTick(): Promise<void> {
  if (globalForScheduler.goalsRunning) return
  globalForScheduler.goalsRunning = true
  const now = new Date()
  try {
    await forEachTenant("goals", async () => {
      const { ensureGoalEditions, runGoalResultReminders } =
        await import("@/features/projects/server/goal-metrics.service")
      const made = await ensureGoalEditions({ now })
      if (made.length > 0) console.log(`[scheduler] goals: ${made.length} new monthly edition(s)`)
      if (now.getDay() === 1 && now.getHours() >= GOAL_REMINDER_EARLIEST_HOUR) {
        const r = await runGoalResultReminders(now)
        if (!r.skipped) console.log(`[scheduler] goals: ${r.sent} result reminder(s)`)
      }
    })
  } catch (err) {
    console.error("[scheduler] goals failed:", err)
  } finally {
    globalForScheduler.goalsRunning = false
  }
}
