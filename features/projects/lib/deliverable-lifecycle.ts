import { addDays, latestCalendarDay, todayUtc } from "@/lib/dates"

// =============================================================================
// The life of a deliverable, as rules rather than prose.
//
// A row starts as a promise (PLANNED - "we owe them three reels"), becomes work
// (IN_PROGRESS), becomes a thing (DELIVERED), and then gets a verdict: ACCEPTED,
// or REJECTED with a reason and a redelivery.
//
// That verdict used to be staff-recorded only, so the ledger could say "they
// signed it off" without a portal. A client with the content plan module now
// gives it directly - the same two moves, from the same one state, by the
// person whose opinion they always represented.
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

export type DeliverableStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "ACCEPTED"
  | "REJECTED"
  | "STUCK"
  | "DISCARDED"

// ── Where STUCK and DISCARDED sit, and why ───────────────────────────────────
// Adding a status is easy; CLASSIFYING it is the part that quietly breaks
// reports, because a status missing from every set below simply stops being
// counted anywhere and nothing complains.
//
//   STUCK     - blocked, but nobody has been let off. It is OPEN and not MADE,
//               so it stays on "what do we owe", stays overdue when its window
//               passes, and stays on the digest's chase list. That visibility is
//               the entire reason for marking something stuck.
//   DISCARDED - dropped. In NEITHER set: it was never made, and nobody owes it
//               any more. Counting it as open would chase work that has been
//               called off; counting it as made would credit work nobody did.

/** The team produced it: capacity, hours, "what did we make in March". */
export const MADE_STATUSES = ["DELIVERED", "ACCEPTED", "REJECTED"] as const

/** It counts toward a goal target. A rejected thing does not, until it returns. */
export const OUTCOME_STATUSES = ["DELIVERED", "ACCEPTED"] as const

/** Owed: promised, nothing produced yet. STUCK is owed too - see above. */
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

/**
 * "Owed" rather than "Planned" and "Awaiting revision" rather than "Rejected":
 * the label names what somebody has to DO about the row, which is the only
 * reason it is on their screen.
 */
export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  PLANNED: "To do",
  IN_PROGRESS: "In progress",
  // "Made" rather than "Delivered": the portal reads this beside a "Made N of M"
  // count, and two words for one idea made the row look like it held two.
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

// ─── Who is asking ────────────────────────────────────────────────────────────

/**
 * The caller's standing on ONE row, resolved once by the server.
 *
 * Higher implies lower: a project manager may do anything a maker may do. The
 * ranking is what lets the table say "maker" and mean "maker or above" instead
 * of listing three actors on every line.
 *
 * ── WHY "client" IS NOT IN THE RANKING ───────────────────────────────────────
 * The other four are one ladder: more seniority, strictly more moves. A client
 * is not further up or further down that ladder, they are standing beside it.
 * They may accept work - which outranks a team manager - and may not start it -
 * which a maker can. Giving them a number would let one of those leak through
 * a >= comparison, so the rules name them explicitly instead and the ranking
 * never applies to them.
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
  /**
   * May the client do this too? Absent means no - every move is closed to the
   * portal until somebody writes it down here, which is the right default for
   * a table an outsider is measured against.
   */
  client?: boolean
  needsFromClient?: TransitionNeed[]
  /** Said to somebody who ranks below `actor`, or to a client where absent. */
  denied: string
}

const MAKER_SIDE = "Only the maker, their team manager or a project manager can do that."

/**
 * Stop work, with a reason. Reachable from every unfinished state, by staff or
 * by the client.
 *
 * The reason is not politeness - "stuck" or "dropped" with nothing said is a row
 * nobody can act on, which is the failure REJECTED's reason field already exists
 * to prevent. `needsFromClient` repeats it so the portal is held to the same bar.
 */
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

/**
 * Mark it made. Staff supply the day it counts for; the client does not - they
 * are recording that it happened, not filing it against a date, and the server
 * dates it today. That asymmetry is what `needsFromClient` is for.
 */
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
  // No PLANNED -> DELIVERED. Work that was never started cannot be finished,
  // and the jump skipped the only state that tells a manager it is underway.
  PLANNED: {
    IN_PROGRESS: REOPEN_TO(),
    // PLANNED -> DELIVERED is open to the CLIENT but not to staff, which looks
    // backwards until you read what each is recording. Staff marking work made
    // without ever starting it hides the state a manager needs; a client saying
    // "this exists now" is a statement about the world, not a workflow step, and
    // they were never in IN_PROGRESS to pass through.
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
  // Blocked, not finished: everything an unstarted row can do, a stuck one can
  // do too. Its way out is back into the queue, on to made, or dropped.
  STUCK: {
    PLANNED: REOPEN_TO(),
    IN_PROGRESS: REOPEN_TO(),
    DELIVERED: MARK_MADE,
    DISCARDED: STOP("DISCARDED"),
  },
  // Dropped work can be revived, but only back to the start - reviving it
  // straight to "made" would skip the question of whether it was ever done.
  DISCARDED: {
    PLANNED: REOPEN_TO(),
  },
  // Delivered work is checked TWICE: the team's manager first, the account
  // manager last. Accepting is the account manager's alone - it is the word
  // given to the client - but either of them can send it back at their own
  // stage, because a manager who spots a problem should not have to wait for
  // somebody senior to say so.
  DELIVERED: {
    // ── The approval loop is STAFF-ONLY now ──────────────────────────────────
    // Both of these used to carry `client: true`. The portal they belong to is
    // used to track an event's work, not to run sign-off, and a row that is
    // both "Made" and awaiting a verdict carries two ideas of done. Dropping
    // the flag is the whole removal: the portal draws its buttons from this
    // table, so nothing else has to know.
    //
    // Staff keep both. The account manager still accepts ON the client's
    // behalf, which is what it always meant before the portal existed.
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
    // Deliberately NOT open to the client. Their finalise is meant to be the
    // last word; reopening it is the account manager's call, which is exactly
    // the escape hatch that lets the last word be safe to give.
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
  if (from === "PLANNED") {
    // The one move a maker will actually try, so it gets the real answer
    // rather than the generic one.
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

// ─── Proof ───────────────────────────────────────────────────────────────────

/** The three ways an item can show what it produced. */
export interface ProofLike {
  links: readonly string[]
  files: readonly unknown[]
  notes: string | null
}

/**
 * Has the work actually been logged?
 *
 * A link or a file is the usual evidence, but plenty of real work leaves
 * neither - a call made, a page checked, an account reconciled - so a written
 * note counts. What does not count is nothing at all: that is the whole point
 * of the gate in front of Delivered.
 */
export function hasProof(r: ProofLike): boolean {
  return r.links.length > 0 || r.files.length > 0 || (r.notes?.trim().length ?? 0) > 0
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
