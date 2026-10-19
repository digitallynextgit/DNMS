import type { DayOff, DayScores, Recommendation, ScorecardCriterion } from "./lib/scorecard"
import type { ReviewParam } from "./lib/weekly-review"

export interface ScorecardPerson {
  id: string
  firstName: string
  lastName: string
}

export interface ScorecardDay {
  dayNumber: number
  /** ISO date (UTC midnight); the 15 days are consecutive calendar days. */
  date: string
  /** By criterion key, for this card's active criteria. */
  scores: DayScores
  /** Weekend, holiday or full-day leave: shown, not scored. Worked out live from the calendars. */
  off: DayOff | null
  /** A part-day leave on a scored day ("Half-day leave · Casual Leave"). */
  note: string | null
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

/** A criterion as HR manages it; `id` is null on a card's own list, and while the company default
 *  is still the built-in six. */
export interface ScorecardCriterionRow extends ScorecardCriterion {
  id: string | null
  displayOrder: number
  isActive: boolean
}

/** GET /api/joinee-scorecards?employeeId= - the scorecard (if any) and what the caller may do. */
export interface ScorecardResponse {
  scorecard: Scorecard | null
  /** This card's active criteria, in sheet order (the company default when there is no card). */
  criteria: ScorecardCriterion[]
  /** This card's whole list, hidden ones included - for its criteria editor. */
  criteriaRows: ScorecardCriterionRow[]
  canEdit: boolean
  canEditCriteria: boolean
}

/** GET/PUT /api/joinee-scorecards/criteria - the company default for new cards, hidden rows included. */
export interface CriteriaResponse {
  criteria: ScorecardCriterionRow[]
}

/** One Friday of a weekly review. */
export interface WeeklyReviewWeek {
  weekNumber: number
  /** ISO date (UTC midnight) of the Friday. */
  date: string
  /** This Friday's whole parameter list, hidden ones included. */
  params: ReviewParam[]
  /** By parameter key, 1-5. */
  scores: Record<string, number>
  comment: string | null
  reviewedBy: ScorecardPerson | null
  reviewedAt: string | null
  /** A holiday or the joinee's leave on that Friday - the week is still reviewed. */
  note: string | null
}

export interface WeeklyReviewData {
  id: string
  employeeId: string
  weeks: WeeklyReviewWeek[]
}

/** GET /api/joinee-weekly-reviews?employeeId= - the review (if any) and what the caller may do. */
export interface WeeklyReviewResponse {
  review: WeeklyReviewData | null
  employee: ScorecardPerson & { manager: ScorecardPerson | null }
  /** The Fridays a review would cover if started now (shown before it is started). */
  plannedFridays: string[]
  /** Score and comment (the reporting manager, or HR). */
  canEdit: boolean
  /** Start or delete a review, and edit the company default (HR). */
  canManage: boolean
}

/** A Friday the signed-in reporting manager still has to fill in. */
export interface DueWeeklyReview {
  employee: ScorecardPerson
  weekNumber: number
  date: string
}
