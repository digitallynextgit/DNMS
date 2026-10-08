import type { RewardState } from "../types"

// Referral reward: a percentage of the referred person's monthly gross after one year of
// service. Pure, so the employee page and the eligibility job always compute the same number.

const YEAR_MS = 365 * 86_400_000

/** Monthly gross = every earning component (deductions don't reduce it). */
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

/** Where the reward stands. `paid` wins, so a corrected joining date can't re-queue a payout. */
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

/** The referrer's reward in rupees; null when the scheme is off or the hire has no salary
 *  structure yet ("not known", not 0). */
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
