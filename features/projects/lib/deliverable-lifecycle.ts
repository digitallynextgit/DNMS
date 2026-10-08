import { addDays, latestCalendarDay, todayUtc } from "@/lib/dates"

// Deliverable lifecycle as a table, so the server, the row buttons and the tests agree.
// PLANNED -> IN_PROGRESS -> DELIVERED -> ACCEPTED, or REJECTED with a reason. Client-safe.

export type DeliverableStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "ACCEPTED"
  | "REJECTED"
  | "STUCK"
  | "DISCARDED"

// Every status must be classified below, or it silently drops out of every report. STUCK is OPEN
// (still owed, still chased); DISCARDED is in neither set (never made, no longer owed).

/** The team produced it: capacity, hours, "what did we make in March". */
export const MADE_STATUSES = ["DELIVERED", "ACCEPTED", "REJECTED"] as const

/** It counts toward a goal target. A rejected thing does not, until it returns. */
export const OUTCOME_STATUSES = ["DELIVERED", "ACCEPTED"] as const

/** Owed: promised, nothing produced yet (STUCK included). */
export const OPEN_STATUSES = ["PLANNED", "IN_PROGRESS", "STUCK"] as const

/** What a new row may be created as. Verdicts and endings are not starts. */
export const CREATABLE_STATUSES = ["PLANNED", "IN_PROGRESS", "DELIVERED"] as const

/** Reading order for chips, filters and the status breakdown. */
export const STATUS_ORDER: DeliverableStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "STUCK",
  "DELIVERED",
  "ACCEPTED",
  "REJECTED",
  "DISCARDED",
]

/** Labels name what somebody has to DO ("Owed", "Awaiting revision"). */
export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  PLANNED: "To do",
  IN_PROGRESS: "In progress",
  // Matches the portal's "Made N of M" count.
  DELIVERED: "Made",
  ACCEPTED: "Accepted",
  REJECTED: "Awaiting revision",
  STUCK: "Stuck",
  DISCARDED: "Discarded",
}

export function isMadeStatus(status: DeliverableStatus): boolean {
  return (MADE_STATUSES as readonly string[]).includes(status)
}

export function isOutcomeStatus(status: DeliverableStatus): boolean {
  return (OUTCOME_STATUSES as readonly string[]).includes(status)
}

export function isOpenStatus(status: DeliverableStatus): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status)
}

/**
 * The caller's standing on ONE row. Staff actors are a ladder (higher may do anything lower may).
 * "client" is off the ladder - may accept but not start - so rules name it explicitly.
 */
export type DeliverableActor = "project_manager" | "team_manager" | "maker" | "none" | "client"

const RANK: Record<Exclude<DeliverableActor, "client">, number> = {
  none: 0,
  maker: 1,
  team_manager: 2,
  project_manager: 3,
}

/** What a transition still needs from the caller before it can be applied. */
export type TransitionNeed = "reason" | "completedOn"

export type TransitionCheck =
  | { ok: true; needs: TransitionNeed[] }
  | {
      ok: false
      /** Phrased for the person being refused; the API returns it verbatim. */
      why: string
      /** `actor` = right move, wrong person (403). `path` = not a move at all (422). */
      reason: "actor" | "path"
    }

interface Rule {
  /** The LOWEST staff standing that may do it. */
  actor: Exclude<DeliverableActor, "client">
  needs: TransitionNeed[]
  /** May the client do this too? Absent = no. */
  client?: boolean
  needsFromClient?: TransitionNeed[]
  /** Said to somebody who ranks below `actor`, or to a client where absent. */
  denied: string
}

const MAKER_SIDE = "Only the maker, their team manager or a project manager can do that."

/** Stop work, with a required reason (staff or client) - an unexplained stop can't be acted on. */
const STOP = (to: "STUCK" | "DISCARDED"): Rule => ({
  actor: "maker",
  needs: ["reason"],
  client: true,
  needsFromClient: ["reason"],
  denied:
    to === "STUCK"
      ? "Only the maker, their team manager, a project manager or the client can flag work as stuck."
      : "Only the maker, their team manager, a project manager or the client can discard work.",
})

/** Mark it made. Staff supply the day it counts for; a client doesn't (the server dates it today). */
const MARK_MADE: Rule = {
  actor: "maker",
  needs: ["completedOn"],
  client: true,
  needsFromClient: [],
  denied: MAKER_SIDE,
}

/** Put it back in the queue. No reason needed - the row speaks for itself. */
const REOPEN_TO = (): Rule => ({
  actor: "maker",
  needs: [],
  client: true,
  denied: MAKER_SIDE,
})

const RULES: Partial<Record<DeliverableStatus, Partial<Record<DeliverableStatus, Rule>>>> = {
  PLANNED: {
    IN_PROGRESS: REOPEN_TO(),
    // Makers can't skip IN_PROGRESS (it hides work underway); the AM and the client may mark it made.
    DELIVERED: { ...MARK_MADE, actor: "project_manager", denied: MAKER_SIDE },
    STUCK: STOP("STUCK"),
    DISCARDED: STOP("DISCARDED"),
  },
  IN_PROGRESS: {
    PLANNED: REOPEN_TO(),
    DELIVERED: MARK_MADE,
    STUCK: STOP("STUCK"),
    DISCARDED: STOP("DISCARDED"),
  },
  // Blocked, not finished: out to the queue, on to made, or dropped.
  STUCK: {
    PLANNED: REOPEN_TO(),
    IN_PROGRESS: REOPEN_TO(),
    DELIVERED: MARK_MADE,
    DISCARDED: STOP("DISCARDED"),
  },
  // Revived only back to the start, so nobody skips asking whether it was done.
  DISCARDED: {
    PLANNED: REOPEN_TO(),
  },
  // Checked twice: team manager, then account manager. Only the AM accepts; either may send back.
  DELIVERED: {
    // Accept/reject are staff-only - the portal tracks work, it doesn't sign off. The AM accepts on
    // the client's behalf.
    ACCEPTED: {
      actor: "project_manager",
      needs: [],
      denied: "Only the account manager can accept work.",
    },
    REJECTED: {
      actor: "team_manager",
      needs: ["reason"],
      denied: "Only the team manager or the account manager can send work back.",
    },
    // Made by mistake, or made and then blocked/dropped afterwards.
    IN_PROGRESS: REOPEN_TO(),
    STUCK: STOP("STUCK"),
    DISCARDED: STOP("DISCARDED"),
  },
  REJECTED: {
    DELIVERED: { actor: "maker", needs: ["completedOn"], denied: MAKER_SIDE },
  },
  ACCEPTED: {
    // Not open to the client: un-accepting is the account manager's call.
    DELIVERED: {
      actor: "project_manager",
      needs: ["reason"],
      denied: "Only a project manager can un-accept work.",
    },
  },
}

function whyNot(from: DeliverableStatus, to: DeliverableStatus): string {
  if (from === "ACCEPTED") {
    return to === "REJECTED" ? "Un-accept it first." : "Delete and re-plan instead."
  }
  if (from === "REJECTED") {
    return "Must go through a redelivery."
  }
  if (from === "PLANNED") {
    // The move a maker actually tries gets a specific answer.
    if (to === "DELIVERED") return "Start it first - move it to In progress."
    return isOpenStatus(to) ? "Delete and re-plan instead." : "Start it first."
  }
  if (from === "IN_PROGRESS") {
    return isOpenStatus(to)
      ? "Delete and re-plan instead."
      : "Nothing has been delivered yet - mark it delivered first."
  }
  // DELIVERED back to an open status.
  return "Delete and re-plan instead."
}

/** May `actor` move `from` -> `to`? `needs` says which values to ask for; the server checks them. */
export function allowedTransition(
  from: DeliverableStatus,
  to: DeliverableStatus,
  actor: DeliverableActor,
): TransitionCheck {
  if (from === to) {
    return {
      ok: false,
      why: `It is already ${DELIVERABLE_STATUS_LABELS[to].toLowerCase()}.`,
      reason: "path",
    }
  }
  const rule = RULES[from]?.[to]
  if (!rule) return { ok: false, why: whyNot(from, to), reason: "path" }

  // The client is checked by name, never by rank - see DeliverableActor.
  if (actor === "client") {
    if (!rule.client) {
      return { ok: false, why: "That is for the team to do.", reason: "actor" }
    }
    return { ok: true, needs: rule.needsFromClient ?? rule.needs }
  }

  if (RANK[actor] < RANK[rule.actor]) return { ok: false, why: rule.denied, reason: "actor" }
  return { ok: true, needs: rule.needs }
}

/** One row's buttons for this person, in reading order. */
export function nextActions(
  status: DeliverableStatus,
  actor: DeliverableActor,
): DeliverableStatus[] {
  return STATUS_ORDER.filter((to) => allowedTransition(status, to, actor).ok)
}

export interface ProofLike {
  links: readonly string[]
  files: readonly unknown[]
  notes: string | null
}

/** A link, a file or a written note - some real work (a call, a check) leaves no artefact. */
export function hasProof(r: ProofLike): boolean {
  return r.links.length > 0 || r.files.length > 0 || (r.notes?.trim().length ?? 0) > 0
}

/** Days a member may still correct their entry; after that only a PM can (logged as LOCKED_EDIT). */
export const LOCK_DAYS = 7

/** Is this entry's period still open for a member? Owed work always is; LOCK_DAYS old still is. */
export function periodOpen(
  completedOn: Date | null | undefined,
  today: Date = todayUtc(),
): boolean {
  if (!completedOn) return true
  return completedOn.getTime() >= addDays(today, -LOCK_DAYS).getTime()
}

/** The day an entry's period closed (or will) - the date the lock message names. */
export function periodClosesOn(completedOn: Date): Date {
  return addDays(completedOn, LOCK_DAYS)
}

/**
 * One deliverable's share of its task's hours, split by quantity over the task's WHOLE output (so
 * filtering doesn't change it). `quantityOnTask` is floored at `quantity` - never above 100%.
 */
export function splitTaskHours(
  loggedHours: number,
  quantity: number,
  quantityOnTask: number,
): number {
  const denominator = Math.max(quantityOnTask, quantity)
  if (!loggedHours || denominator <= 0) return 0
  return (loggedHours * quantity) / denominator
}

// Re-exported so forms bound the date picker with the server's rule.
export { latestCalendarDay }

/** Repeats lay down REAL owed rows up front, so each one can be edited or dropped on its own. */
export type RepeatEvery = "WEEK" | "MONTH"

/** A year of weeks. Long enough for any retainer, short enough to stay sane. */
export const MAX_REPEAT = 52

/** Add months, clamped: 31 Jan + 1 month = 28 Feb, so month-end commitments stay at month end. */
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate()
  const target = new Date(date.getTime())
  target.setUTCDate(1)
  target.setUTCMonth(target.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target
}

/** Due dates from `first` (included). Each is measured from `first`, so a clamp can't drift. */
export function repeatDueDates(first: Date, every: RepeatEvery, count: number): Date[] {
  const n = Math.max(1, Math.min(Math.floor(count) || 1, MAX_REPEAT))
  return Array.from({ length: n }, (_, i) =>
    i === 0
      ? new Date(first.getTime())
      : every === "WEEK"
        ? addDays(first, 7 * i)
        : addMonthsClamped(first, i),
  )
}
