// Campaign time estimate. These numbers MIRROR server/campaign-runner.ts and the scheduler -
// change them together or the estimate drifts.

/** Emails one tick will send. Mirrors BATCH_SIZE in campaign-runner.ts. */
export const BATCH_SIZE = 25
/** Scheduler cadence. Mirrors CAMPAIGN_INTERVAL_MS in server/scheduler.ts. */
export const TICK_SECONDS = 30

/**
 * Per-email guess before anything is measured: the runner's 250 ms pause plus an SMTP round trip.
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
 * Remaining send time, or null. The pickup wait is separate: while QUEUED it could be 1s or 30s.
 */
export function estimateCampaign(c: CampaignProgress, now = Date.now()): CampaignEta | null {
  if (c.status !== "QUEUED" && c.status !== "SENDING") return null

  const done = c.sentCount + c.failedCount
  const remaining = Math.max(0, c.totalCount - done)
  if (remaining === 0) return null

  // Prefer the campaign's observed rate (needs 2+ sends; the first is mostly connection setup).
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

  // Batches don't run back to back - one per 30s tick - so count the gaps between batches plus
  // the final batch, not remaining x perEmail.
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
