// =============================================================================
// Campaign time estimate
// =============================================================================
// "Queued" with no end in sight reads as broken even when it is working fine -
// the first campaign on this project looked stuck for a minute while it was
// actually mid-send. This turns the queue's mechanics into a number a person can
// read: roughly how long until the last email leaves.
//
// The numbers below MIRROR server/campaign-runner.ts and the scheduler. If the
// batch size or tick cadence changes there, change it here too or the estimate
// silently drifts from reality.
// =============================================================================

/** Emails one tick will send. Mirrors BATCH_SIZE in campaign-runner.ts. */
export const BATCH_SIZE = 25
/** Scheduler cadence. Mirrors CAMPAIGN_INTERVAL_MS in server/scheduler.ts. */
export const TICK_SECONDS = 30

/**
 * Fallback per-email cost before we have anything measured: the runner's own
 * 250 ms inter-send pause plus a typical SMTP round trip. Only used for the
 * first estimate - once a campaign is moving we use its real observed rate.
 */
const ASSUMED_SECONDS_PER_EMAIL = 1.5

/** A measured rate outside this range is a stall or a clock artefact, not a rate. */
const MIN_SECONDS_PER_EMAIL = 0.3
const MAX_SECONDS_PER_EMAIL = 30

export interface CampaignProgress {
  status: string
  totalCount: number
  sentCount: number
  failedCount: number
  startedAt: string | null
}

export interface CampaignEta {
  /** Emails still to go out. */
  remaining: number
  /** Seconds until the last one leaves, NOT counting the pickup wait. */
  seconds: number
  /** Worst-case wait before the first batch starts. Zero once sending. */
  pickupSeconds: number
  /** Seconds per email actually observed - false means we are still guessing. */
  measured: boolean
  secondsPerEmail: number
}

/**
 * Estimate the remaining send time, or null when there is nothing to wait for.
 *
 * Deliberately returns the pickup wait separately: while a campaign is QUEUED
 * the scheduler could fire in one second or in thirty, and averaging that into a
 * single countdown would show a number that is wrong in both directions. The UI
 * says "starts within 30s" instead of pretending to know.
 */
export function estimateCampaign(c: CampaignProgress, now = Date.now()): CampaignEta | null {
  if (c.status !== "QUEUED" && c.status !== "SENDING") return null

  const done = c.sentCount + c.failedCount
  const remaining = Math.max(0, c.totalCount - done)
  if (remaining === 0) return null

  // Prefer the campaign's own throughput: it already includes this SMTP host's
  // real latency, which varies far more between providers than any constant we
  // could pick. Needs 2+ sends, because a single sample is mostly connection
  // setup and reads as pessimistically slow.
  let secondsPerEmail = ASSUMED_SECONDS_PER_EMAIL
  let measured = false
  if (c.startedAt && done >= 2) {
    const elapsed = (now - new Date(c.startedAt).getTime()) / 1000
    const rate = elapsed / done
    if (rate >= MIN_SECONDS_PER_EMAIL && rate <= MAX_SECONDS_PER_EMAIL) {
      secondsPerEmail = rate
      measured = true
    }
  }

  // Batches do not run back to back. Each tick sends at most BATCH_SIZE and
  // returns; the next one starts on the following 30s beat (or as soon as the
  // previous finishes, if it overran). So the wait is the gaps BETWEEN batches
  // plus the duration of the final one - not simply remaining x perEmail, which
  // would badly under-estimate any list over 25.
  const batches = Math.ceil(remaining / BATCH_SIZE)
  const fullBatchSeconds = BATCH_SIZE * secondsPerEmail
  const cycleSeconds = Math.max(TICK_SECONDS, fullBatchSeconds)
  const lastBatchCount = remaining - (batches - 1) * BATCH_SIZE
  const seconds = (batches - 1) * cycleSeconds + lastBatchCount * secondsPerEmail

  return {
    remaining,
    seconds,
    pickupSeconds: c.status === "QUEUED" ? TICK_SECONDS : 0,
    measured,
    secondsPerEmail,
  }
}

/** "45s", "2m 10s", "1h 5m" - short enough to sit inside a card line. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) {
    const rem = s % 60
    return rem ? `${m}m ${rem}s` : `${m}m`
  }
  const h = Math.floor(m / 60)
  const remM = m % 60
  return remM ? `${h}h ${remM}m` : `${h}h`
}
