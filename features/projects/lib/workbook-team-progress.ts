/**
 * DONE needs as many links + files handed in as the quantity promised. Quantity 0 means "not yet
 * quantified" (not "owes nothing") and is exempt. Shared by server and client.
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

/** Why a status change is refused, or null. Only DONE is gated; STUCK/DISCARDED never are. */
export function statusProblem(next: WorkbookTeamStatus, progress: TeamProgress): string | null {
  if (next !== "DONE") return null
  if (progress.canComplete) return null
  return `${progress.handedIn} of ${progress.quantity} handed in. Add ${progress.shortBy} more link${
    progress.shortBy === 1 ? "" : "s"
  } or file${progress.shortBy === 1 ? "" : "s"} before marking this done.`
}

/** DISCARDED (never made) and DONE (arrived) are not owed and never make a month overdue. */
export function isOutstanding(status: WorkbookTeamStatus): boolean {
  return status !== "DONE" && status !== "DISCARDED"
}
