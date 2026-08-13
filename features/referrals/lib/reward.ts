import type { RewardState } from "../types"

// =============================================================================
// The reward rule, in one place.
//
// A referrer is paid a percentage of the referred person's MONTHLY GROSS once
// that person completes one year. Deliberately pure so both the employee's own
// page and the eligibility job compute the same number from the same inputs -
// two implementations of a money rule is two answers to "what am I owed".
// =============================================================================

const YEAR_MS = 365 * 86_400_000

/** Monthly gross = every earning component. Deductions are the employee's, not
 *  a reduction in what the company pays for them. */
export function monthlyGross(s: {
  basicSalary: number
  hra: number
  conveyance: number
  medicalAllowance: number
  telephoneAllowance: number
  otherAllowances: number
}): number {
  return (
    s.basicSalary +
    s.hra +
    s.conveyance +
    s.medicalAllowance +
    s.telephoneAllowance +
    s.otherAllowances
  )
}

/** The day the reward becomes payable: one year of service, to the day. */
export function eligibleOn(dateOfJoining: Date | null): Date | null {
  if (!dateOfJoining) return null
  return new Date(dateOfJoining.getTime() + YEAR_MS)
}

/**
 * Where the reward stands.
 *
 * `paid` wins over everything - a recorded payout is a fact, and re-deriving it
 * as "due" because a joining date was later corrected would put the same reward
 * back in the queue.
 */
export function rewardState(args: {
  isHired: boolean
  hireDateOfJoining: Date | null
  paidAt: Date | null
  now?: Date
}): RewardState {
  if (args.paidAt) return "paid"
  if (!args.isHired) return "none"
  const on = eligibleOn(args.hireDateOfJoining)
  if (!on) return "pending"
  return (args.now ?? new Date()).getTime() >= on.getTime() ? "due" : "pending"
}

/** Whole days still to serve, or null when there is nothing to wait for. */
export function daysToGo(dateOfJoining: Date | null, now = new Date()): number | null {
  const on = eligibleOn(dateOfJoining)
  if (!on) return null
  const days = Math.ceil((on.getTime() - now.getTime()) / 86_400_000)
  return days > 0 ? days : null
}

/**
 * What the referrer gets, in rupees, rounded to the rupee.
 *
 * Null when the scheme is switched off (0 or unset percent) or the hire has no
 * salary structure yet - which is honestly "not known", not "nothing", and the
 * UI says so rather than printing a confident 0.
 */
export function rewardAmount(monthly: number | null, percent: number | null): number | null {
  if (monthly == null || percent == null || percent <= 0) return null
  return Math.round((monthly * percent) / 100)
}

/** "10" / "10%" / " 10 " -> 10. Anything else -> null (scheme off). */
export function parsePercent(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number.parseFloat(raw.replace("%", "").trim())
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null
  return n
}
