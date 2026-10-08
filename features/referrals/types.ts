/** Where a referred candidate has got to. Mirrors CareerApplicationStatus. */
export type ReferralStage = "RECEIVED" | "IN_REVIEW" | "SHORTLISTED" | "REJECTED" | "HIRED"

/** The reward's lifecycle - derived from hire link, joining date and payout, never stored. */
export type RewardState =
  | "none"
  /** Hired, but the one-year mark has not arrived. */
  | "pending"
  /** One year served - the referrer is owed the reward. */
  | "due"
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
