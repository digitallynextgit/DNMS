import type { DeliverableStatus } from "./deliverable-lifecycle"

// =============================================================================
// Deliverables progress - the numbers behind the "My Progress" page
//
// Shared by the API route that computes them and the page that draws them, so
// the two cannot drift. Everything here is plain JSON: dates are YYYY-MM-DD
// strings, no Prisma types, nothing the browser cannot import.
// =============================================================================

/** One line of a "by project" or "by person" breakdown. */
export interface ProgressGroup {
  id: string
  label: string
  /** Client name for a project, designation for a person. May be empty. */
  sub: string
  total: number
  done: number
  open: number
  overdue: number
  sentBack: number
  late: number
  /** done / total, 0-100 */
  pct: number
  qty: number
  made: number
}

export interface ProgressItem {
  id: string
  title: string
  type: string
  status: DeliverableStatus
  projectId: string
  project: string
  employeeId: string | null
  employee: string | null
  /** "14-18 Sep 2026" / "due 20 Sep 2026" / "—" */
  period: string
  dueOn: string | null
  completedOn: string | null
  quantity: number
  deliveredQuantity: number
  late: boolean
  overdue: boolean
  /** Why it is not done yet. Empty for finished rows. */
  why: string
}

export interface ProgressTotals {
  total: number
  done: number
  open: number
  overdue: number
  sentBack: number
  /** Finished after the due date. */
  late: number
  /** Finished on or before the due date (only rows that had one). */
  onTime: number
  /** done / total, 0-100 */
  pct: number
  qty: number
  made: number
  byStatus: Record<DeliverableStatus, number>
}

export interface DeliverablesProgress {
  from: string
  to: string
  /** The employee the numbers were computed for. */
  me: string
  /** True when the window held more rows than we are willing to tally. */
  truncated: boolean
  totals: ProgressTotals
  byProject: ProgressGroup[]
  byPerson: ProgressGroup[]
  /** Open rows, soonest due first, each with the reason it is still open. */
  notDone: ProgressItem[]
  /** Finished rows, most recent first. */
  delivered: ProgressItem[]
}
