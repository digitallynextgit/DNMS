import { addDays, latestCalendarDay, todayUtc } from "@/lib/dates"

// =============================================================================
// The life of a deliverable, as rules rather than prose.
//
// A row starts as a promise (PLANNED - "we owe them three reels"), becomes work
// (IN_PROGRESS), becomes a thing (DELIVERED), and then gets a verdict recorded
// against it by whoever runs the account: ACCEPTED, or REJECTED with a reason
// and a redelivery. Nothing here talks to a client - the verdict is STAFF
// RECORDED, so the ledger can say "they signed it off" without a portal.
//
// ── THREE SETS, THREE DIFFERENT QUESTIONS ────────────────────────────────────
// MADE      - the team produced it. Counts for capacity and hours, even if the
//             client sent it back: the work was done either way.
// OUTCOME   - it counts toward a goal target. A rejected reel is not a reel the
//             client has; it stops counting until it is redelivered.
// OPEN      - nothing exists yet. This is what "owed" means.
//
// ── WHY A TABLE AND NOT `if` STATEMENTS ──────────────────────────────────────
// The same six moves are asked about in three places: the server (may this
// request go through), the row actions (which buttons to draw), and the tests.
// One table answers all three, so a button can never offer a move the server
// then refuses.
//
// Pure and client-safe on purpose - no `server-only`, no Prisma, no db.
// =============================================================================

export type DeliverableStatus = "PLANNED" | "IN_PROGRESS" | "DELIVERED" | "ACCEPTED" | "REJECTED"

/** The team produced it: capacity, hours, "what did we make in March". */
export const MADE_STATUSES = ["DELIVERED", "ACCEPTED", "REJECTED"] as const

/** It counts toward a goal target. A rejected thing does not, until it returns. */
export const OUTCOME_STATUSES = ["DELIVERED", "ACCEPTED"] as const

/** Owed: promised, nothing produced yet. */
export const OPEN_STATUSES = ["PLANNED", "IN_PROGRESS"] as const

/** What a new row may be created as. ACCEPTED/REJECTED are verdicts, not starts. */
export const CREATABLE_STATUSES = ["PLANNED", "IN_PROGRESS", "DELIVERED"] as const

/** Reading order for chips, filters and the status breakdown. */
export const STATUS_ORDER: DeliverableStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "DELIVERED",
  "ACCEPTED",
  "REJECTED",
]

/**
 * "Owed" rather than "Planned" and "Awaiting revision" rather than "Rejected":
 * the label names what somebody has to DO about the row, which is the only
 * reason it is on their screen.
 */
export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  PLANNED: "Owed",
  IN_PROGRESS: "In progress",
  DELIVERED: "Delivered",
  ACCEPTED: "Accepted",
  REJECTED: "Awaiting revision",
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

// ─── Who is asking ────────────────────────────────────────────────────────────

/**
 * The caller's standing on ONE row, resolved once by the server.
 *
 * Higher implies lower: a project manager may do anything a maker may do. The
 * ranking is what lets the table say "maker" and mean "maker or above" instead
 * of listing three actors on every line.
 */
export type DeliverableActor = "project_manager" | "team_manager" | "maker" | "none"

const RANK: Record<DeliverableActor, number> = {
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
  /** The LOWEST standing that may do it. */
  actor: DeliverableActor
  needs: TransitionNeed[]
  /** Said to somebody who ranks below `actor`. */
  denied: string
}

const MAKER_SIDE = "Only the maker, their team manager or a project manager can do that."

const RULES: Partial<Record<DeliverableStatus, Partial<Record<DeliverableStatus, Rule>>>> = {
  PLANNED: {
    IN_PROGRESS: { actor: "maker", needs: [], denied: MAKER_SIDE },
    DELIVERED: { actor: "maker", needs: ["completedOn"], denied: MAKER_SIDE },
  },
  IN_PROGRESS: {
    DELIVERED: { actor: "maker", needs: ["completedOn"], denied: MAKER_SIDE },
  },
  DELIVERED: {
    ACCEPTED: {
      actor: "project_manager",
      needs: [],
      denied: "Only a project manager can accept work.",
    },
    REJECTED: {
      actor: "project_manager",
      needs: ["reason"],
      denied: "Only a project manager can send work back.",
    },
  },
  REJECTED: {
    DELIVERED: { actor: "maker", needs: ["completedOn"], denied: MAKER_SIDE },
  },
  ACCEPTED: {
    DELIVERED: {
      actor: "project_manager",
      needs: ["reason"],
      denied: "Only a project manager can un-accept work.",
    },
  },
}

/** Why a move that is not on the table is not on the table. */
function whyNot(from: DeliverableStatus, to: DeliverableStatus): string {
  if (from === "ACCEPTED") {
    return to === "REJECTED" ? "Un-accept it first." : "Delete and re-plan instead."
  }
  if (from === "REJECTED") {
    return "Must go through a redelivery."
  }
  if (from === "PLANNED" || from === "IN_PROGRESS") {
    return isOpenStatus(to)
      ? "Delete and re-plan instead."
      : "Nothing has been delivered yet - mark it delivered first."
  }
  // DELIVERED back to an open status.
  return "Delete and re-plan instead."
}

/**
 * May `actor` move a row from `from` to `to`, and what does it still need?
 *
 * `needs` is advisory, not a guarantee the caller supplied anything: the server
 * checks the values, this says WHICH values to ask for. A refusal carries the
 * sentence to show and whether it was the person or the move that was wrong.
 */
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
  if (RANK[actor] < RANK[rule.actor]) return { ok: false, why: rule.denied, reason: "actor" }
  return { ok: true, needs: rule.needs }
}

/**
 * The moves this person can make from here - one row's buttons, in reading
 * order. Empty means the row is done as far as they are concerned.
 */
export function nextActions(
  status: DeliverableStatus,
  actor: DeliverableActor,
): DeliverableStatus[] {
  return STATUS_ORDER.filter((to) => allowedTransition(status, to, actor).ok)
}

// ─── The period lock ──────────────────────────────────────────────────────────

/**
 * How long a member may keep correcting their own entry. After that the month
 * is being reported on and a quiet edit changes a number somebody already sent
 * a client; a project manager can still make the change, and it is written to
 * the row's history as a LOCKED_EDIT.
 */
export const LOCK_DAYS = 7

/**
 * Is this entry's period still open for a member?
 *
 * A row with no completed date (owed work) is always open - there is no period
 * to close. The boundary is inclusive: exactly LOCK_DAYS old is still editable.
 */
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

// ─── Effort against output ────────────────────────────────────────────────────

/**
 * The share of a task's hours that belongs to ONE of its deliverables.
 *
 * A task can produce several rows (three reels and a thumbnail) and its hours
 * are logged once, on the task. Splitting by quantity is the only division the
 * data supports, and it is stable under filtering: the denominator is the
 * task's WHOLE output (`quantityOnTask`), so looking at one reel in isolation
 * still says 2h, not 8h.
 *
 * `quantityOnTask` is floored at `quantity` because the two come from different
 * queries - a row can be counted here before the tally that includes it - and a
 * share above 100% of the task is never the right answer.
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

// Re-exported so a form can bound its date picker with the same rule the server
// applies, without reaching into @/lib/dates for one function.
export { latestCalendarDay }

// ─── Repeating commitments ────────────────────────────────────────────────────

/**
 * "Three reels a week" is the shape almost every retainer is written in, and
 * it used to mean typing the same row out twelve times.
 *
 * Repetition here lays down REAL owed rows up front rather than generating
 * them lazily from a rule. That costs a few more rows and buys a great deal:
 * the account manager sees exactly what has been committed, any single week
 * can be edited, reassigned or dropped without breaking the pattern, and there
 * is no hidden generator that can silently stop running.
 */
export type RepeatEvery = "WEEK" | "MONTH"

/** A year of weeks. Long enough for any retainer, short enough to stay sane. */
export const MAX_REPEAT = 52

/**
 * Add months while staying inside the month you land in.
 *
 * 31 Jan + 1 month is 28 Feb, not 3 March: a monthly commitment made on the
 * last day of a month is due on the last day of the next one. Rolling over
 * would also make the sequence drift, because March would then follow from
 * the 3rd rather than the 31st.
 */
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

/**
 * The due dates a repeating commitment covers, `first` included.
 *
 * Each date is measured from the FIRST one, never from the previous result, so
 * a clamped month (28 Feb) cannot drag the rest of the year back with it.
 */
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
