import type { DayScores, Recommendation } from "./lib/scorecard"

export interface ScorecardPerson {
  id: string
  firstName: string
  lastName: string
}

export interface ScorecardDay extends DayScores {
  dayNumber: number
  /** ISO date (UTC midnight) of this working day. */
  date: string
}

export interface Scorecard {
  id: string
  employeeId: string
  hrSpocId: string | null
  managerObservations: string | null
  hrObservations: string | null
  recommendation: Recommendation | null
  updatedAt: string
  employee: ScorecardPerson & {
    employeeNo: string
    profilePhoto: string | null
    dateOfJoining: string | null
    designation: { title: string } | null
    manager: ScorecardPerson | null
  }
  hrSpoc: ScorecardPerson | null
  days: ScorecardDay[]
}

/** GET /api/joinee-scorecards?employeeId= - the scorecard (if any) and what the caller may do. */
export interface ScorecardResponse {
  scorecard: Scorecard | null
  canEdit: boolean
}
