export type OydCategory =
  | "MISSED_DEADLINE"
  | "DELAYED_HANDOVER"
  | "BLOCKER_NOT_SHARED"
  | "REPEATED_DELAYS"

export type OydStatus = "PENDING" | "CONFIRMED" | "REJECTED"

/** Who did something; id is null for the hidden owner account, shown as "Management". */
export interface OydActor {
  id: string | null
  name: string
}

export interface OydFlagView {
  id: string
  employee: {
    id: string
    firstName: string
    lastName: string | null
    employeeNo: string | null
    profilePhoto: string | null
  }
  raisedBy: OydActor
  category: OydCategory
  note: string
  status: OydStatus
  /** Which active flag it was when confirmed. */
  level: number | null
  reviewedBy: OydActor | null
  reviewedAt: string | null
  reviewNote: string | null
  removedBy: OydActor | null
  removedAt: string | null
  removeReason: string | null
  createdAt: string
  canReview: boolean
  canRemove: boolean
}

export interface OydListResult {
  flags: OydFlagView[]
  viewer: { id: string; isHr: boolean; managesAnyone: boolean }
}

export interface OydPerson {
  id: string
  firstName: string
  lastName: string | null
  employeeNo: string | null
  profilePhoto: string | null
  /** The caller is HR or their Reporting Manager, so a flag counts at once. */
  confirmsAtOnce: boolean
}
