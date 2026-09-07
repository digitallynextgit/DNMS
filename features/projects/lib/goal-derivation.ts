import type { Prisma } from "@prisma/client"

import { todayUtc, daysBetween, startOfDayUTC } from "@/lib/dates"
import { typeKey } from "./deliverable-types"

// =============================================================================
// How a goal's number is worked out.
//
// PURE. No Prisma client, no `server-only`, no fetch. It takes rows and returns
// a summary, which is why the Goals tab, the portfolio roll-up on the Progress
// page and the test suite can all run the SAME arithmetic. A second copy of
// this maths is how one project ends up showing two different percentages
// depending on which screen you opened it from.
//
// The Prisma import is `import type` and stays that way: the SELECT shapes live
// here so the query and the summariser cannot drift, but nothing here runs a
// query.
//
// ── PROGRESS IS DERIVED FROM COMPLETION, NEVER TYPED IN ──────────────────────
//
// A goal is measured by three things, in order of authority:
//
//   TARGETS  - "20 reels this month". What was actually PROMISED. When a goal
//              carries targets they decide its number outright, because output
//              is the thing the client bought; tasks are how we got there.
//   TASKS    - each linked task is one unit of work, exactly as each sub-goal
//              is. Count-based (the way Asana and Linear roll up) so a 1h task
//              and a 10h task move the bar the same and the figure survives
//              being explained out loud.
//   THE FLAG - a leaf with neither is 100 when someone marked it DONE, else 0.
//
// ── A SUB-GOAL IS WORTH ITS WORK, NOT ONE TICK ───────────────────────────────
// A parent used to average its sub-goals, so a sub-goal holding twenty tasks
// counted for exactly as much as one holding a single task. Now every node
// carries a WEIGHT - how many units of work sit under it - and a parent's ratio
// is done weight over total weight. A manual leaf with nothing under it weighs
// one, which is what it weighed before, so a plain checklist of sub-goals reads
// exactly as it always did.
//
// COUNTABLE excludes two things, and both matter:
//
//   deactivated - soft-deleted. "We stopped tracking this." It should not drag
//                 a project down, and it should not flatter it either, so it
//                 leaves the sum entirely rather than counting as done.
//   DISCARDED   - abandoned on purpose, with a reason. Same maths, but it stays
//                 VISIBLE: a goal that was dropped, and why, is part of the
//                 project's record in a way a hidden row is not.
//
// Discarded work leaves the PROGRESS sum but NOT the output tally: a reel that
// was made is a reel that was made, whatever happened to the goal afterwards.
//
// ── A SUB-GOAL IS PART OF ITS PARENT, NOT A GOAL BESIDE IT ───────────────────
// totalGoals and doneGoals count MAIN goals only. "Launch the storefront" with
// three sub-goals is one goal, not four, and a summary that said "1 of 4 done"
// would be counting the same work twice.
// =============================================================================

export type GoalStatusValue = "NOT_STARTED" | "IN_PROGRESS" | "AT_RISK" | "DONE" | "DISCARDED"

/** Statuses that take a goal out of the progress calculation. */
const NOT_COUNTABLE: ReadonlySet<GoalStatusValue> = new Set<GoalStatusValue>(["DISCARDED"])

/** Does this goal count towards its parent's progress? */
export const counts = (g: { isActive: boolean; status: GoalStatusValue }): boolean =>
  g.isActive && !NOT_COUNTABLE.has(g.status)

/** Task statuses that mean the work will never be done: out of the sum. */
export const TASK_DROPPED: ReadonlySet<string> = new Set(["DISCARDED", "CANCELLED"])
/** Task statuses under which a task cannot be overdue. */
export const TASK_CLOSED: ReadonlySet<string> = new Set(["DONE", "DISCARDED", "CANCELLED"])

// ─────────────────────────────────────────────────────────────────────────────
// Slipping
//
// Not a status - nobody sets it, and it has to be able to clear itself the
// moment the work catches up. A goal is slipping when the calendar has moved
// further than the work has, by enough of a margin that it is a signal rather
// than noise.
// ─────────────────────────────────────────────────────────────────────────────

/** How far behind the calendar the work has to fall before it is worth saying. */
export const SLIP_GAP = 0.25
/** Inside this many days of the target date, "nearly done" is the only safe place to be. */
export const SLIP_WINDOW_DAYS = 7
/** Under this ratio inside that window, it is not landing on time. */
export const SLIP_WINDOW_MIN = 0.75

// ─────────────────────────────────────────────────────────────────────────────
// Output attributed to a goal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One delivered thing, reduced to the three facts a target cares about.
 *
 * `typeKey` is already case-folded (see normaliseType) so "Reel" and "reel"
 * cannot split a count, and `completedOn` is the day it counts for - the day
 * the work landed, not the day somebody got around to logging it.
 */
export interface GoalOutput {
  typeKey: string
  quantity: number
  completedOn: Date
}

/**
 * Output by goal id, ATTRIBUTED ONCE.
 *
 * Each deliverable belongs to exactly one goal (its own `goalId`, else its
 * task's), so a parent that sums its subtree cannot double-count a row that
 * matched both. The loader does the attribution; this map is the result.
 */
export type GoalOutputMap = ReadonlyMap<string, readonly GoalOutput[]>

export const EMPTY_OUTPUTS: GoalOutputMap = new Map()

/**
 * The grouping key for a deliverable type.
 *
 * Deliberately the same function the deliverables feature uses rather than a
 * lookalike: a target for "Reels" that silently failed to match rows typed
 * "reels" would read as "0 of 20 done" on a goal that was actually finished.
 */
export const normaliseType = (t: string): string => typeKey(t)

/** Every distinct type any target on these rows measures, case-folded. */
export function targetTypeKeys(
  rows: readonly { targets: { deliverableType: string }[] }[],
): string[] {
  const seen = new Set<string>()
  for (const r of rows) {
    for (const t of r.targets) {
      const key = normaliseType(t.deliverableType)
      if (key) seen.add(key)
    }
  }
  return [...seen]
}

// ─────────────────────────────────────────────────────────────────────────────
// Types on the wire
// ─────────────────────────────────────────────────────────────────────────────

export interface GoalEvent {
  id: string
  type: "CREATED" | "STATUS_CHANGED" | "DEACTIVATED" | "REACTIVATED" | "EDITED"
  fromStatus: GoalStatusValue | null
  toStatus: GoalStatusValue | null
  reason: string | null
  actorName: string | null
  at: string
}

/**
 * A promise with a number on it: "20 reels, September".
 *
 * The one place a goal states what SUCCESS looks like rather than what work was
 * planned. `made` is tallied over the goal's whole subtree, so a target set on
 * a parent is met by whichever sub-goal actually produced the thing.
 */
export interface GoalTarget {
  id: string
  /** As stored - the project's own casing ("Reel"), for display. */
  type: string
  /** Case-folded, for matching. */
  typeKey: string
  quantity: number
  /** yyyy-MM-dd. Null on both ends = counts everything ever attributed here. */
  periodStart: string | null
  periodEnd: string | null
  /** Quantity delivered inside the period. May exceed `quantity`. */
  made: number
  met: boolean
  /** 0-100, capped: over-delivery reads as 100, not 140. */
  progress: number
}

export interface GoalTaskLink {
  id: string
  title: string
  status: string
  dueDate: string | null
  overdue: boolean
  assigneeName: string | null
  producesOutput: boolean
  outputs: number
  estimatedHours: number | null
  /**
   * Somebody was asked for the output and said there was nothing to log.
   *
   * The difference between "no output logged" (chase it) and "nothing to log"
   * (leave them alone), which is the difference between a useful nudge and the
   * reason people stop reading nudges.
   */
  outputSkipped: boolean
}

export interface GoalNode {
  id: string
  title: string
  description: string | null
  /** As stored on a leaf; rolled up from countable children on a parent. */
  status: GoalStatusValue
  statusReason: string | null
  /** 0-100. Derived from targets, then tasks and sub-goals, then the flag. */
  progress: number
  targetDate: string | null
  /** Free text, as typed. Deduplicated case-insensitively, order preserved. */
  tags: string[]
  sortOrder: number
  isActive: boolean
  createdByName: string | null
  /** Accountable for it landing. Null reads as "the account manager". */
  ownerId: string | null
  ownerName: string | null
  /** ISO. The clock a slipping check runs against starts here. */
  createdAt: string
  children: GoalNode[]
  progressIsDerived: boolean
  /**
   * How much this goal is worth to its parent - the units of work beneath it,
   * or one for a manual leaf that holds nothing.
   */
  weight: number
  /** `weight` × this goal's ratio. What it actually contributes upwards. */
  doneWeight: number
  /**
   * Progress from the WORK alone: done units over countable units. Kept beside
   * `progress` rather than folded into it so a goal with targets can say
   * "tasks 100%, output 2 of 5" instead of picking one and hiding the other.
   * Null when there is no work under it.
   */
  taskProgress: number | null
  /** What was promised, and how much of it exists. */
  targets: GoalTarget[]
  /** Progress from the targets alone. Null when there are none. */
  outcomeProgress: number | null
  /**
   * Progress weighted by the linked tasks' ESTIMATED HOURS - done hours over
   * estimated hours. The secondary reading, offered beside the count-based
   * `progress` rather than replacing it: a 10h task and a 1h task move this
   * bar differently, which is truer for an agency and harder to explain at a
   * glance. Null when no linked task carries an estimate. Sub-goals have no
   * hours and are not in this figure.
   */
  hoursProgress: number | null
  /** How many units actually counted towards `progress`. */
  countableChildren: number
  /**
   * How many of those are done - the numerator behind `progress`.
   *
   * Sent rather than left to the board to count, because the board may be
   * showing a FILTERED subset of a goal's sub-goals and counting the rows on
   * screen would report "1 of 4 done" for a goal that has three done sub-goals
   * outside the current date range.
   */
  doneChildren: number
  /**
   * The tasks linked to this goal - the work behind the number. Progress
   * counts each as one unit alongside each sub-goal (see summariseGoalRows).
   */
  tasks: GoalTaskLink[]
  /** Linked tasks that count (not discarded). */
  countableTasks: number
  doneTasks: number
  /** Deliverables logged against the linked tasks - what came OUT of this goal. */
  outputCount: number
  overdue: boolean
  /** Behind where the calendar says it should be. Derived, never stored. */
  slipping: boolean
  events: GoalEvent[]
}

export interface ProjectGoalsSummary {
  goals: GoalNode[]
  overallProgress: number
  /** Countable MAIN goals. Sub-goals belong to their parent and are not added. */
  totalGoals: number
  /** Of `totalGoals`, how many are DONE. */
  doneGoals: number
  /** Flat, sub-goals included: these describe rows on the board, not goals. */
  discardedGoals: number
  inactiveGoals: number
  overdueGoals: number
  /** Flagged at risk by a person - a judgement, not arithmetic. */
  atRiskGoals: number
  /** Behind the calendar without anyone having said so yet. */
  slippingGoals: number
  /** Earliest upcoming target across every countable goal, sub-goals included. */
  nextTargetDate: string | null
  /**
   * Every tag in use on this project, sub-goals included.
   *
   * Sent with the tree rather than fetched separately: the filter list and the
   * type-ahead both need it the moment the board renders, and it is already in
   * memory here. Reflects `includeInactive` - a tag that survives only on a
   * deactivated goal appears exactly when that goal does.
   */
  allTags: string[]
  /**
   * Open tasks on the project that serve no goal. Not an error - forcing a goal
   * at creation produces junk goals - but the manager's list of work to sort:
   * either it belongs to a goal, or the goal is missing.
   */
  unlinkedOpenTasks: number
}

// ─────────────────────────────────────────────────────────────────────────────
// The SELECT shapes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The columns a goal summary is built from.
 *
 * Exported so the portfolio query (goals-portfolio.queries.ts) selects EXACTLY
 * the same shape and can hand its rows to summariseGoalRows below. A second
 * hand-written select would drift, and the first symptom of drift is a progress
 * figure that differs between the Goals tab and the Progress page - two numbers
 * for one project, with no way to tell which is right.
 */
export const GOAL_SELECT = {
  id: true,
  parentId: true,
  title: true,
  description: true,
  status: true,
  statusReason: true,
  targetDate: true,
  tags: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  createdBy: { select: { firstName: true, lastName: true } },
  owner: { select: { id: true, firstName: true, lastName: true } },
  // What was PROMISED. Ordered by period so a goal's targets read as a calendar
  // rather than in whatever order somebody happened to add them.
  targets: {
    select: {
      id: true,
      deliverableType: true,
      quantity: true,
      periodStart: true,
      periodEnd: true,
    },
    orderBy: [{ periodStart: "asc" }, { createdAt: "asc" }],
  },
  // The work behind the goal. Progress derives from these (with the sub-goals)
  // when any are linked - see summariseGoalRows.
  tasks: {
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      producesOutput: true,
      outputSkippedAt: true,
      estimatedHours: true,
      assignee: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { deliverables: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  events: {
    orderBy: { createdAt: "desc" },
    // Enough to answer "what happened lately" without shipping a decade of rows
    // for a goal nobody is looking at in detail.
    take: 25,
    select: {
      id: true,
      type: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ProjectGoalSelect

export type GoalRow = Prisma.ProjectGoalGetPayload<{ select: typeof GOAL_SELECT }>

/**
 * GOAL_SELECT without the history.
 *
 * The portfolio roll-up (Progress page) shows trees, never event trails, and
 * the events relation is `take: 25` PER GOAL - so asking for it there shipped
 * ~64 rows across the portfolio that nothing on the page renders, growing with
 * every status change anyone ever makes. Only the Goals tab reads history, and
 * it fetches one project at a time.
 */
export const GOAL_SELECT_LITE = (({ events: _events, ...rest }) => rest)(GOAL_SELECT)

/** A goal row with or without its history attached. */
export type GoalRowLite = Omit<GoalRow, "events"> & { events?: GoalRow["events"] }

/** The order a board reads in. Shared for the same reason GOAL_SELECT is. */
export const GOAL_ORDER = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
] satisfies Prisma.ProjectGoalOrderByWithRelationInput[]

// ─────────────────────────────────────────────────────────────────────────────
// The maths
// ─────────────────────────────────────────────────────────────────────────────

export const ymd = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null)

/**
 * A ratio as a percentage, and the one rounding rule that matters: 100 is
 * reserved for FINISHED. 249 of 250 tasks rounds to 100 and reads as done to
 * anybody scanning a board, which is a lie told by arithmetic. It shows 99.
 */
const pct = (ratio: number): number => (ratio >= 1 ? 100 : Math.min(99, Math.round(ratio * 100)))

/**
 * How much of one target exists.
 *
 * Matched on the case-folded type, and on the period when one is set - both
 * bounds inclusive, because "September" means the 1st and the 30th are in.
 * A target with no period counts everything ever attributed to the goal, which
 * is what an ongoing commitment ("50 pages, eventually") actually means.
 */
export function tallyTarget(
  t: { typeKey: string; quantity: number; periodStart: Date | null; periodEnd: Date | null },
  outputs: readonly GoalOutput[],
): { made: number; ratio: number; met: boolean } {
  let made = 0
  for (const o of outputs) {
    if (o.typeKey !== t.typeKey) continue
    if (t.periodStart && o.completedOn < t.periodStart) continue
    if (t.periodEnd && o.completedOn > t.periodEnd) continue
    made += o.quantity
  }
  // Over-delivery is not extra credit that can hide a missed target beside it,
  // so the ratio is capped before it is averaged with anything.
  const ratio = t.quantity > 0 ? Math.min(1, made / t.quantity) : 0
  return { made, ratio, met: made >= t.quantity }
}

/**
 * Is this goal further behind than the calendar says it should be?
 *
 * Two ways to qualify, because one threshold cannot cover both a quarter-long
 * goal and one due on Friday:
 *
 *   the GAP    - the share of the runway spent, minus the share of the work
 *                done. A quarter goal 50% through its time at 20% done is
 *                behind by a margin worth a chip; 5 points behind is noise.
 *   the WINDOW - inside a week of the date, anything under three-quarters done
 *                is not landing, however evenly it was tracking before.
 *
 * Deliberately silent on four kinds of goal: deactivated or discarded ones (no
 * one is working on them), finished ones, ones with no date to slip against,
 * and ones with nothing measurable under them - a manual leaf is a checkbox,
 * and a checkbox is never "40% done and falling behind". A goal already PAST
 * its date is overdue, which is its own flag and a louder one.
 */
export function isSlipping(a: {
  status: GoalStatusValue
  isActive: boolean
  measurable: boolean
  ratio: number
  createdAt: Date
  targetDate: Date | null
  today: Date
}): boolean {
  if (!a.isActive || !a.measurable) return false
  if (a.status === "DONE" || a.status === "DISCARDED") return false
  if (!a.targetDate || a.targetDate <= a.today) return false

  const start = startOfDayUTC(a.createdAt)
  const total = daysBetween(start, a.targetDate)
  // Created on or after its own target date: there is no runway to fall behind
  // on, and dividing by it would report every such goal as slipping.
  if (total <= 0) return false

  const expected = Math.min(1, Math.max(0, daysBetween(start, a.today) / total))
  const left = daysBetween(a.today, a.targetDate)
  return expected - a.ratio >= SLIP_GAP || (left <= SLIP_WINDOW_DAYS && a.ratio < SLIP_WINDOW_MIN)
}

/**
 * A goal's status, read off everything countable underneath it.
 *
 * A goal with sub-goals, tasks or targets has no status control of its own -
 * they ARE its status - so the stored value would otherwise freeze at whatever
 * it was when the first one was added.
 *
 * DISCARDED is left alone: a goal dropped on purpose, with a reason, stays
 * dropped however its parts move. AT_RISK set on the goal itself is kept too,
 * unless everything under it is delivered - a goal whose parts are all done is
 * done, and the risk has passed. AT_RISK is never INFERRED from tasks: an
 * overdue task is a fact about the task, and whether the goal is actually at
 * risk is the owner's call.
 *
 * DONE needs every target met as well as every task and sub-goal finished. The
 * work being finished and the thing being delivered are different claims, and
 * a goal that promised 20 reels and produced 12 is not done because somebody
 * ticked the last task.
 */
export function derivedStatus(
  stored: GoalStatusValue,
  countableKids: readonly { status: GoalStatusValue }[],
  countableTasks: readonly { status: string }[],
  targets: readonly { made: number; met: boolean }[] = [],
): GoalStatusValue {
  const units = countableKids.length + countableTasks.length
  if (stored === "DISCARDED" || (units === 0 && targets.length === 0)) return stored
  const allDone =
    countableKids.every((k) => k.status === "DONE") &&
    countableTasks.every((t) => t.status === "DONE") &&
    targets.every((t) => t.met)
  if (allDone) return "DONE"
  if (stored === "AT_RISK" || countableKids.some((k) => k.status === "AT_RISK")) return "AT_RISK"
  const anyStarted =
    countableKids.some((k) => k.status !== "NOT_STARTED") ||
    countableTasks.some((t) => t.status !== "TODO") ||
    targets.some((t) => t.made > 0)
  return anyStarted ? "IN_PROGRESS" : "NOT_STARTED"
}

/**
 * Every distinct tag in use on a project, for the filter list and the
 * type-ahead on the add-goal row.
 *
 * Deduped the same way a single goal's tags are - one entry per tag regardless
 * of how it was capitalised - and sorted case-insensitively so the list reads
 * alphabetically rather than putting every capitalised tag first.
 */
function collectTags(rows: readonly { tags: string[] }[]): string[] {
  const seen = new Map<string, string>()
  for (const row of rows) {
    for (const tag of row.tags) {
      const key = tag.toLowerCase()
      if (!seen.has(key)) seen.set(key, tag)
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}

/** What one recursion step produces: the node, plus what the parent needs from it. */
interface Derived {
  node: GoalNode
  /**
   * Output attributed anywhere in this goal's subtree, DISCARDED branches
   * included. A parent's target is met by work that happened, and dropping the
   * goal afterwards does not un-make the reels.
   */
  subtreeOutputs: GoalOutput[]
  /** The node's unrounded 0-1 progress. Rounding it before rolling up loses a
   *  point per level, which on a three-deep tree is visible. */
  ratio: number
}

/**
 * Turn one project's goal rows into its summary: nest them, roll progress and
 * status up, and tally the board-level counts.
 *
 * Split out from the query so the SAME arithmetic serves one project and a whole
 * portfolio. The portfolio fetches every project's goals in a single findMany
 * and calls this per group - one query instead of one per project, and no second
 * implementation of the rollup to keep in step.
 *
 * PURE. It takes rows and returns a summary; `today` is a parameter so a caller
 * summarising many projects cannot have the date move underneath it mid-loop,
 * and `outputs` is a parameter so that caller can load every project's
 * deliverables in ONE query and hand the same map to each group.
 */
export function summariseGoalRows(
  rows: readonly GoalRowLite[],
  today: Date = todayUtc(),
  outputs: GoalOutputMap = EMPTY_OUTPUTS,
): ProjectGoalsSummary {
  const byParent = new Map<string | null, GoalRowLite[]>()
  for (const r of rows) {
    const list = byParent.get(r.parentId)
    if (list) list.push(r)
    else byParent.set(r.parentId, [r])
  }

  const name = (p: { firstName: string; lastName: string | null } | null) =>
    p ? `${p.firstName} ${p.lastName ?? ""}`.trim() : null

  const toNode = (r: GoalRowLite): Derived => {
    const kidResults = (byParent.get(r.id) ?? []).map(toNode)
    const kids = kidResults.map((k) => k.node)
    const countableKids = kidResults.filter((k) => counts(k.node))

    // ── What came out of this goal, and everything beneath it ────────────
    // Unfiltered by countability on purpose: see Derived.subtreeOutputs.
    const subtreeOutputs: GoalOutput[] = [...(outputs.get(r.id) ?? [])]
    for (const k of kidResults) subtreeOutputs.push(...k.subtreeOutputs)

    // ── The work behind the goal ─────────────────────────────────────────
    // Every linked task is one UNIT, exactly as a manual sub-goal is one unit.
    // Discarded work leaves the sum rather than counting as zero, same as a
    // discarded sub-goal.
    const tasks = (r.tasks ?? []).map(
      (t): GoalTaskLink => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: ymd(t.dueDate),
        overdue: Boolean(t.dueDate && t.dueDate < today && !TASK_CLOSED.has(t.status)),
        assigneeName: name(t.assignee),
        producesOutput: t.producesOutput,
        outputs: t._count.deliverables,
        estimatedHours: t.estimatedHours,
        outputSkipped: t.outputSkippedAt != null,
      }),
    )
    const countableTasks = tasks.filter((t) => !TASK_DROPPED.has(t.status))
    const doneTasks = countableTasks.filter((t) => t.status === "DONE")

    // The hours reading, over tasks that carry an estimate. Null rather than
    // 0 when none do: "no data" and "nothing done" must not look alike.
    const estimated = countableTasks.filter((t) => (t.estimatedHours ?? 0) > 0)
    const estimatedTotal = estimated.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)
    const hoursProgress =
      estimatedTotal > 0
        ? Math.round(
            (estimated
              .filter((t) => t.status === "DONE")
              .reduce((s, t) => s + (t.estimatedHours ?? 0), 0) /
              estimatedTotal) *
              100,
          )
        : null

    // ── Weight ───────────────────────────────────────────────────────────
    // A sub-goal contributes the work it holds, not one tick. A manual leaf
    // holds nothing and weighs one - which is exactly what it weighed before
    // weighting existed, so plain checklists of sub-goals are unchanged.
    const ownUnits = countableTasks.length
    const kidWeight = countableKids.reduce((s, k) => s + k.node.weight, 0)
    const kidDone = countableKids.reduce((s, k) => s + k.node.doneWeight, 0)
    const units = ownUnits + kidWeight
    const weight = Math.max(1, units)
    const taskRatio = units > 0 ? (doneTasks.length + kidDone) / units : null

    // ── Targets ──────────────────────────────────────────────────────────
    // Tallied over the whole subtree, so a target on a parent is met by
    // whichever sub-goal produced the thing. Sub-goal targets do NOT roll up
    // separately - they reach the parent through that sub-goal's ratio, which
    // is what stops one delivery being counted at two levels.
    const targetRatios: number[] = []
    const targets = (r.targets ?? []).map((t): GoalTarget => {
      const key = normaliseType(t.deliverableType)
      const { made, ratio, met } = tallyTarget(
        {
          typeKey: key,
          quantity: t.quantity,
          periodStart: t.periodStart,
          periodEnd: t.periodEnd,
        },
        subtreeOutputs,
      )
      targetRatios.push(ratio)
      return {
        id: t.id,
        type: t.deliverableType,
        typeKey: key,
        quantity: t.quantity,
        periodStart: ymd(t.periodStart),
        periodEnd: ymd(t.periodEnd),
        made,
        met,
        progress: pct(ratio),
      }
    })
    const outcomeRatio = targetRatios.length
      ? targetRatios.reduce((s, x) => s + x, 0) / targetRatios.length
      : null

    const derived = kids.length > 0 || tasks.length > 0 || targets.length > 0
    const status = derived
      ? derivedStatus(
          r.status as GoalStatusValue,
          countableKids.map((k) => k.node),
          countableTasks,
          targets,
        )
      : (r.status as GoalStatusValue)

    // OUTPUT WINS. A goal that promised 20 reels and shipped 4 is 20% done,
    // whatever proportion of the tasks somebody ticked on the way there. With
    // neither targets nor work there is nothing measurable under it: it is a
    // checkbox, and the flag is the only signal there is.
    const ratio = outcomeRatio ?? taskRatio ?? (status === "DONE" ? 1 : 0)

    const overdue = Boolean(
      r.targetDate &&
      r.targetDate < today &&
      status !== "DONE" &&
      // A discarded or deactivated goal is not "late" - nobody is working on it.
      counts({ isActive: r.isActive, status }),
    )

    const node: GoalNode = {
      id: r.id,
      title: r.title,
      description: r.description,
      status,
      statusReason: r.statusReason,
      progress: pct(ratio),
      targetDate: ymd(r.targetDate),
      tags: r.tags,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      createdByName: name(r.createdBy),
      ownerId: r.owner?.id ?? null,
      ownerName: name(r.owner),
      createdAt: r.createdAt.toISOString(),
      children: kids,
      progressIsDerived: derived,
      weight,
      doneWeight: weight * ratio,
      taskProgress: taskRatio === null ? null : pct(taskRatio),
      targets,
      outcomeProgress: outcomeRatio === null ? null : pct(outcomeRatio),
      hoursProgress,
      // Units, not just sub-goals: linked tasks and the work inside sub-goals
      // count here too, so "3 of 5 done" reads the same whether the goal was
      // broken into milestones or straight into work.
      countableChildren: units,
      doneChildren: Math.round(doneTasks.length + kidDone),
      tasks,
      countableTasks: countableTasks.length,
      doneTasks: doneTasks.length,
      outputCount: tasks.reduce((s, t) => s + t.outputs, 0),
      overdue,
      slipping: isSlipping({
        status,
        isActive: r.isActive,
        measurable: units > 0 || targets.length > 0,
        ratio,
        createdAt: r.createdAt,
        targetDate: r.targetDate,
        today,
      }),
      // Absent when the caller selected without history (GOAL_SELECT_LITE).
      events: (r.events ?? []).map((e) => ({
        id: e.id,
        type: e.type,
        fromStatus: (e.fromStatus as GoalStatusValue) ?? null,
        toStatus: (e.toStatus as GoalStatusValue) ?? null,
        reason: e.reason,
        actorName: name(e.actor),
        at: e.createdAt.toISOString(),
      })),
    }

    return { node, subtreeOutputs, ratio }
  }

  const goals = (byParent.get(null) ?? []).map((r) => toNode(r).node)

  const flat: GoalNode[] = []
  const walk = (n: GoalNode) => {
    flat.push(n)
    n.children.forEach(walk)
  }
  goals.forEach(walk)

  const countableMains = goals.filter(counts)
  const countableFlat = flat.filter(counts)
  const upcoming = countableFlat
    .map((g) => g.targetDate)
    .filter((d): d is string => Boolean(d))
    .filter((d) => d >= ymd(today)!)
    .sort()

  return {
    goals,
    overallProgress:
      countableMains.length === 0
        ? 0
        : Math.round(countableMains.reduce((s, g) => s + g.progress, 0) / countableMains.length),
    totalGoals: countableMains.length,
    doneGoals: countableMains.filter((g) => g.status === "DONE").length,
    discardedGoals: flat.filter((g) => g.isActive && g.status === "DISCARDED").length,
    inactiveGoals: flat.filter((g) => !g.isActive).length,
    overdueGoals: flat.filter((g) => g.overdue).length,
    atRiskGoals: countableFlat.filter((g) => g.status === "AT_RISK").length,
    slippingGoals: countableFlat.filter((g) => g.slipping).length,
    nextTargetDate: upcoming[0] ?? null,
    allTags: collectTags(rows),
    // Needs a query the pure summariser cannot run; the callers fill it in.
    unlinkedOpenTasks: 0,
  }
}
