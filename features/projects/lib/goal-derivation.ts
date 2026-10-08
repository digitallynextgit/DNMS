import type { Prisma } from "@prisma/client"

import { todayUtc, daysBetween, startOfDayUTC } from "@/lib/dates"
import { typeKey } from "./deliverable-types"

// Goal maths, PURE (type-only Prisma import) so the Goals tab, Progress page and tests share it.
// Progress, in order of authority: targets met, else linked tasks + sub-goals weighted by the units
// of work under them, else the DONE flag. Deactivated/DISCARDED goals leave the sum (discarded
// output still counts). totalGoals/doneGoals count MAIN goals only.

export type GoalStatusValue = "NOT_STARTED" | "IN_PROGRESS" | "AT_RISK" | "DONE" | "DISCARDED"

const NOT_COUNTABLE: ReadonlySet<GoalStatusValue> = new Set<GoalStatusValue>(["DISCARDED"])

/** Does this goal count towards its parent's progress? */
export const counts = (g: { isActive: boolean; status: GoalStatusValue }): boolean =>
  g.isActive && !NOT_COUNTABLE.has(g.status)

/** Task statuses that mean the work will never be done: out of the sum. */
export const TASK_DROPPED: ReadonlySet<string> = new Set(["DISCARDED", "CANCELLED"])
/** Task statuses under which a task cannot be overdue. */
export const TASK_CLOSED: ReadonlySet<string> = new Set(["DONE", "DISCARDED", "CANCELLED"])

// Slipping is derived, never set: the calendar has moved further than the work by a clear margin.

/** How far behind the calendar the work has to fall before it is worth saying. */
export const SLIP_GAP = 0.25
/** Inside this many days of the target date, "nearly done" is the only safe place to be. */
export const SLIP_WINDOW_DAYS = 7
/** Under this ratio inside that window, it is not landing on time. */
export const SLIP_WINDOW_MIN = 0.75

/** One delivered thing. `typeKey` is case-folded; `completedOn` is the day the work landed. */
export interface GoalOutput {
  typeKey: string
  quantity: number
  completedOn: Date
}

/** Output by goal id, attributed ONCE (own goalId, else the task's) so subtrees can't double-count. */
export type GoalOutputMap = ReadonlyMap<string, readonly GoalOutput[]>

export const EMPTY_OUTPUTS: GoalOutputMap = new Map()

/** The deliverables feature's own key, so a target for "Reels" matches rows typed "reels". */
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

export interface GoalEvent {
  id: string
  type: "CREATED" | "STATUS_CHANGED" | "DEACTIVATED" | "REACTIVATED" | "EDITED"
  fromStatus: GoalStatusValue | null
  toStatus: GoalStatusValue | null
  reason: string | null
  actorName: string | null
  at: string
}

/** "20 reels, September". `made` is tallied over the goal's whole subtree. */
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
  /** They said there was nothing to log - don't chase it like missing output. */
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
  /** Worth to its parent: the units of work beneath it, or one for an empty manual leaf. */
  weight: number
  /** `weight` × this goal's ratio. What it actually contributes upwards. */
  doneWeight: number
  /** Progress from the work alone, shown beside `progress`. Null when there is no work under it. */
  taskProgress: number | null
  targets: GoalTarget[]
  /** Progress from the targets alone. Null when there are none. */
  outcomeProgress: number | null
  /** Secondary reading weighted by estimated hours (tasks only). Null when no task has an estimate. */
  hoursProgress: number | null
  /** How many units actually counted towards `progress`. */
  countableChildren: number
  /** Numerator behind `progress`, sent because the board may show a filtered subset. */
  doneChildren: number
  /** Linked tasks; each counts as one unit beside each sub-goal. */
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
  /** Every tag in use (sub-goals included), for filter + type-ahead. Follows `includeInactive`. */
  allTags: string[]
  /** Open tasks serving no goal - not an error, the manager's list to sort. */
  unlinkedOpenTasks: number
}

/** Exported so the portfolio query selects EXACTLY this shape - a second select would drift. */
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
  // Ordered by period so targets read as a calendar.
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

/** GOAL_SELECT without history: the Progress page never shows it (events are take: 25 per goal). */
export const GOAL_SELECT_LITE = (({ events: _events, ...rest }) => rest)(GOAL_SELECT)

/** A goal row with or without its history attached. */
export type GoalRowLite = Omit<GoalRow, "events"> & { events?: GoalRow["events"] }

/** Board reading order, shared so every caller sorts alike. */
export const GOAL_ORDER = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
] satisfies Prisma.ProjectGoalOrderByWithRelationInput[]

export const ymd = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null)

/** Ratio -> percent. 100 is reserved for FINISHED: 249 of 250 shows 99, not a rounded 100. */
const pct = (ratio: number): number => (ratio >= 1 ? 100 : Math.min(99, Math.round(ratio * 100)))

/** How much of one target exists: matched on case-folded type and the inclusive period, if any. */
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
  // Capped, so over-delivery can't hide a missed target beside it.
  const ratio = t.quantity > 0 ? Math.min(1, made / t.quantity) : 0
  return { made, ratio, met: made >= t.quantity }
}

/**
 * Behind the calendar? Either the GAP (share of time spent minus share of work done) exceeds
 * SLIP_GAP, or within SLIP_WINDOW_DAYS of the date it is under SLIP_WINDOW_MIN. Never for inactive,
 * discarded, finished, undated or unmeasurable goals; past-date goals are overdue instead.
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
  // Created on/after its own date: no runway to fall behind on (and no divide by zero).
  if (total <= 0) return false

  const expected = Math.min(1, Math.max(0, daysBetween(start, a.today) / total))
  const left = daysBetween(a.today, a.targetDate)
  return expected - a.ratio >= SLIP_GAP || (left <= SLIP_WINDOW_DAYS && a.ratio < SLIP_WINDOW_MIN)
}

/**
 * A goal's status, read off its sub-goals, tasks and targets. DISCARDED is kept; a manual AT_RISK is
 * kept unless everything is delivered, and never inferred. DONE needs every target met too.
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

/** Every distinct tag, deduped and sorted case-insensitively. */
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

interface Derived {
  node: GoalNode
  /** Subtree output, discarded branches included: dropping a goal doesn't un-make the work. */
  subtreeOutputs: GoalOutput[]
  /** Unrounded 0-1 progress; rounding before rolling up would lose a point per level. */
  ratio: number
}

/**
 * One project's goal rows -> nested summary. Shared by one project and the whole portfolio; `today`
 * and `outputs` are parameters so a portfolio caller uses one date and one outputs query.
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

    // Unfiltered by countability: see Derived.subtreeOutputs.
    const subtreeOutputs: GoalOutput[] = [...(outputs.get(r.id) ?? [])]
    for (const k of kidResults) subtreeOutputs.push(...k.subtreeOutputs)

    // Each linked task is one unit, like a manual sub-goal; discarded work leaves the sum.
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

    // Null rather than 0 when no task has an estimate: "no data" isn't "nothing done".
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

    // A sub-goal weighs the work it holds; an empty manual leaf weighs one.
    const ownUnits = countableTasks.length
    const kidWeight = countableKids.reduce((s, k) => s + k.node.weight, 0)
    const kidDone = countableKids.reduce((s, k) => s + k.node.doneWeight, 0)
    const units = ownUnits + kidWeight
    const weight = Math.max(1, units)
    const taskRatio = units > 0 ? (doneTasks.length + kidDone) / units : null

    // Tallied over the subtree. Sub-goal targets reach the parent only via the sub-goal's ratio, so
    // one delivery isn't counted at two levels.
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

    // Output wins over ticked tasks; with neither targets nor work, the DONE flag is all there is.
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
      // Units, not just sub-goals, so "3 of 5 done" reads the same however the goal was broken down.
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
