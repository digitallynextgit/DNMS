/**
 * How far along a team's month is, and whether it may be called done.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────
 * A team that promised 4 items has to have handed over 4 things before its row
 * can read DONE. What counts as "a thing handed over" is a LINK or a FILE,
 * added together: some work ships as a URL (a published page, a task, a Drive
 * folder) and some as a file, and which one it is says nothing about whether
 * the work happened.
 *
 * The count is the only evidence the calendar has. Without it, DONE is a
 * checkbox somebody ticks on the last day of the month, and a month of DONE
 * rows with nothing attached tells you nothing you did not already believe.
 *
 * ── WHY quantity 0 IS EXEMPT ─────────────────────────────────────────────────
 * 0 means "on the plan, not yet quantified" (see the column comment), not "owes
 * nothing". A row nobody has put a number against must not be held to a number,
 * so it may be closed whenever the team says it is closed.
 *
 * Pure and dependency-free: the server enforces this and the client renders it,
 * and the two must not be able to disagree about what "done" means.
 */

export const WORKBOOK_TEAM_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "STUCK", "DISCARDED"] as const

export type WorkbookTeamStatus = (typeof WORKBOOK_TEAM_STATUSES)[number]

export const STATUS_LABEL: Record<WorkbookTeamStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  STUCK: "Stuck",
  DISCARDED: "Discarded",
}

/** One line each, so the picker explains itself rather than being a guess. */
export const STATUS_HINT: Record<WorkbookTeamStatus, string> = {
  TODO: "Agreed, not started",
  IN_PROGRESS: "Being worked on",
  DONE: "Everything promised is handed over",
  STUCK: "Blocked, but still owed",
  DISCARDED: "Dropped without being made",
}

export interface TeamProgress {
  /** Links plus files - what has actually been handed over. */
  handedIn: number
  /** What was promised. 0 = never quantified. */
  quantity: number
  /** 0-1, and 1 whenever nothing was quantified. */
  fraction: number
  /** How many more are needed before DONE is allowed. 0 when it already is. */
  shortBy: number
  /** Whether DONE is reachable right now. */
  canComplete: boolean
}

export function teamProgress(input: {
  quantity: number
  links: readonly unknown[]
  attachments: readonly unknown[]
}): TeamProgress {
  const handedIn = input.links.length + input.attachments.length
  const quantity = Math.max(0, input.quantity)
  if (quantity === 0) {
    return { handedIn, quantity: 0, fraction: 1, shortBy: 0, canComplete: true }
  }
  const shortBy = Math.max(0, quantity - handedIn)
  return {
    handedIn,
    quantity,
    fraction: Math.min(1, handedIn / quantity),
    shortBy,
    canComplete: shortBy === 0,
  }
}

/**
 * Why a status change is refused, or null when it is allowed.
 *
 * Only DONE is gated. STUCK and DISCARDED must stay reachable at any count -
 * they are how a team says the work is NOT going to arrive, and a rule that
 * demanded the work first to admit it is not coming would be absurd.
 */
export function statusProblem(next: WorkbookTeamStatus, progress: TeamProgress): string | null {
  if (next !== "DONE") return null
  if (progress.canComplete) return null
  return `${progress.handedIn} of ${progress.quantity} handed in. Add ${progress.shortBy} more link${
    progress.shortBy === 1 ? "" : "s"
  } or file${progress.shortBy === 1 ? "" : "s"} before marking this done.`
}

/**
 * Does this row still count as owed?
 *
 * DISCARDED work was never made and DONE work has arrived; neither should show
 * up in "what is outstanding", and neither should make a month read as overdue.
 */
export function isOutstanding(status: WorkbookTeamStatus): boolean {
  return status !== "DONE" && status !== "DISCARDED"
}
