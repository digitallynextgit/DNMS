import type { DayScores, Recommendation, ScorecardCriterion } from "./lib/scorecard"

export interface ScorecardPerson {
  id: string
  firstName: string
  lastName: string
}

export interface ScorecardDay {
  dayNumber: number
  /** ISO date (UTC midnight) of this working day. */
  date: string
  /** By criterion key, for the company's active criteria. */
  scores: DayScores
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

/** A criterion as HR manages it; `id` is null while the company still uses the built-in six. */
export interface ScorecardCriterionRow extends ScorecardCriterion {
  id: string | null
  displayOrder: number
  isActive: boolean
}

/** GET /api/joinee-scorecards?employeeId= - the scorecard (if any) and what the caller may do. */
export interface ScorecardResponse {
  scorecard: Scorecard | null
  /** The company's active criteria, in sheet order. */
  criteria: ScorecardCriterion[]
  canEdit: boolean
  canEditCriteria: boolean
}

/** GET/PUT /api/joinee-scorecards/criteria - every row, hidden ones included. */
export interface CriteriaResponse {
  criteria: ScorecardCriterionRow[]
}
