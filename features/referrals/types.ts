/** Where a referred candidate has got to. Mirrors CareerApplicationStatus. */
export type ReferralStage = "RECEIVED" | "IN_REVIEW" | "SHORTLISTED" | "REJECTED" | "HIRED"

/**
 * The reward's own lifecycle, derived rather than stored - the inputs (hire
 * link, joining date, payout stamp) already say everything, and a stored status
 * would be one more thing that can disagree with them.
 */
export type RewardState =
  /** Not hired (yet). Nothing is owed. */
  | "none"
  /** Hired, but the one-year mark has not arrived. */
  | "pending"
  /** One year served - the referrer is owed the reward. */
  | "due"
  /** Paid out. */
  | "paid"

export interface ReferralRow {
  id: string
  fullName: string
  email: string
  roleTitle: string
  departmentTitle: string
  stage: ReferralStage
  submittedAt: string
  isInternalReferral: boolean
  /** Set once HR links the hire to their employee record. */
  hire: { id: string; name: string; dateOfJoining: string | null } | null
  reward: {
    state: RewardState
    /** The day the reward becomes payable - joining date + 1 year. */
    eligibleOn: string | null
    /** Days still to serve; null once eligible or not applicable. */
    daysToGo: number | null
    /** Rupees. Estimated before payout, frozen after. */
    amount: number | null
    paidAt: string | null
  }
}

/** What an employee sees at the top of their own referrals page. */
export interface ReferralSummary {
  total: number
  hired: number
  inProgress: number
  rejected: number
  rewardDue: number
  rewardPaid: number
  /** Total rupees already paid out to this person. */
  earned: number
}
