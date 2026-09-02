import "server-only"

import { db } from "@/server/db"
import { ValidationError, NotFoundError } from "@/lib/errors"

// =============================================================================
// Project goals.
//
// A project has main goals; a main goal has sub-goals. ONE level, and no more.
// Arbitrary nesting reads fine in a schema and badly on a screen, so the depth
// limit is enforced here rather than left to whoever calls it.
//
// ── PROGRESS IS DERIVED FROM COMPLETION, NEVER TYPED IN ──────────────────────
//
//   a leaf   -> 100 when DONE, 0 otherwise
//   a parent -> the share of its COUNTABLE sub-goals that are DONE
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
// A parent whose sub-goals are all discarded or deactivated has nothing left to
// measure, so it reports 0 rather than dividing by zero.
//
// A parent's STATUS is derived the same way (see parentStatus). A goal with
// sub-goals has no status control of its own - the sub-goals are its status -
// so the stored value would otherwise freeze at whatever it was when the first
// sub-goal was added.
//
// ── A SUB-GOAL IS PART OF ITS PARENT, NOT A GOAL BESIDE IT ───────────────────
// totalGoals and doneGoals count MAIN goals only. "Launch the storefront" with
// three sub-goals is one goal, not four, and a summary that said "1 of 4 done"
// would be counting the same work twice.
//
// ── HISTORY IS APPEND-ONLY ───────────────────────────────────────────────────
// Every status change, deactivation and edit writes a ProjectGoalEvent. The
// current row cannot answer "when did this slip, and what did they say at the
// time", and that answer is worth more than the row the moment anyone asks why
// a date moved.
// =============================================================================

export type GoalStatusValue = "NOT_STARTED" | "IN_PROGRESS" | "AT_RISK" | "DONE" | "DISCARDED"

/** Statuses that must be accompanied by a reason. */
const REASON_REQUIRED: ReadonlySet<GoalStatusValue> = new Set<GoalStatusValue>([
  "AT_RISK",
  "DISCARDED",
])

/** Statuses that take a goal out of the progress calculation. */
const NOT_COUNTABLE: ReadonlySet<GoalStatusValue> = new Set<GoalStatusValue>(["DISCARDED"])

export interface GoalEvent {
  id: string
  type: "CREATED" | "STATUS_CHANGED" | "DEACTIVATED" | "REACTIVATED" | "EDITED"
  fromStatus: GoalStatusValue | null
  toStatus: GoalStatusValue | null
  reason: string | null
  actorName: string | null
  at: string
}

export interface GoalNode {
  id: string
  title: string
  description: string | null
  /** As stored on a leaf; rolled up from countable children on a parent. */
  status: GoalStatusValue
  statusReason: string | null
  /** 0-100. Derived from countable children when there are any. */
  progress: number
  targetDate: string | null
  sortOrder: number
  isActive: boolean
  createdByName: string | null
  children: GoalNode[]
  progressIsDerived: boolean
  /** How many children actually counted towards `progress`. */
  countableChildren: number
  overdue: boolean
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
  /** Earliest upcoming target across every countable goal, sub-goals included. */
  nextTargetDate: string | null
}

const ymd = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null)

function todayUtc(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

/** Does this goal count towards its parent's progress? */
const counts = (g: { isActive: boolean; status: GoalStatusValue }): boolean =>
  g.isActive && !NOT_COUNTABLE.has(g.status)

/**
 * A parent's status, read off its countable sub-goals.
 *
 * Keeps the badge on the tab, the donut on the Overview and "N of M done" all
 * telling the same story as the progress bar beside them.
 *
 * DISCARDED is left alone: a parent dropped on purpose, with a reason, stays
 * dropped however its sub-goals move. AT_RISK set on the parent itself is kept
 * too, unless every sub-goal is done - a goal whose parts are all delivered is
 * delivered, and the risk has passed.
 */
function parentStatus(stored: GoalStatusValue, countable: GoalNode[]): GoalStatusValue {
  if (stored === "DISCARDED" || countable.length === 0) return stored
  if (countable.every((k) => k.status === "DONE")) return "DONE"
  if (stored === "AT_RISK" || countable.some((k) => k.status === "AT_RISK")) return "AT_RISK"
  if (countable.some((k) => k.status !== "NOT_STARTED")) return "IN_PROGRESS"
  return "NOT_STARTED"
}

/**
 * Every goal on a project, nested, with progress rolled up and history attached.
 *
 * `includeInactive` decides whether deactivated goals come back at all. They
 * never affect the maths either way - the flag only controls visibility, so the
 * board can offer "show deactivated" without the numbers moving underneath it.
 */
export async function getProjectGoals(
  projectId: string,
  includeInactive = false,
): Promise<ProjectGoalsSummary> {
  const rows = await db.projectGoal.findMany({
    where: { projectId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      parentId: true,
      title: true,
      description: true,
      status: true,
      statusReason: true,
      targetDate: true,
      sortOrder: true,
      isActive: true,
      createdBy: { select: { firstName: true, lastName: true } },
      events: {
        orderBy: { createdAt: "desc" },
        // Enough to answer "what happened lately" without shipping a decade of
        // rows for a goal nobody is looking at in detail.
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
    },
  })

  const today = todayUtc()
  const byParent = new Map<string | null, typeof rows>()
  for (const r of rows) {
    if (!byParent.has(r.parentId)) byParent.set(r.parentId, [])
    byParent.get(r.parentId)!.push(r)
  }

  const name = (p: { firstName: string; lastName: string | null } | null) =>
    p ? `${p.firstName} ${p.lastName ?? ""}`.trim() : null

  const toNode = (r: (typeof rows)[number]): GoalNode => {
    const kids = (byParent.get(r.id) ?? []).map(toNode)
    const countable = kids.filter(counts)
    const derived = kids.length > 0
    const status = derived
      ? parentStatus(r.status as GoalStatusValue, countable)
      : (r.status as GoalStatusValue)
    const progress = derived
      ? countable.length === 0
        ? 0
        : Math.round((countable.filter((k) => k.status === "DONE").length / countable.length) * 100)
      : status === "DONE"
        ? 100
        : 0

    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status,
      statusReason: r.statusReason,
      progress,
      targetDate: ymd(r.targetDate),
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      createdByName: name(r.createdBy),
      children: kids,
      progressIsDerived: derived,
      countableChildren: countable.length,
      // A discarded or deactivated goal is not "late" - nobody is working on it.
      overdue: Boolean(
        r.targetDate &&
        r.targetDate < today &&
        status !== "DONE" &&
        counts({ isActive: r.isActive, status }),
      ),
      events: r.events.map((e) => ({
        id: e.id,
        type: e.type,
        fromStatus: (e.fromStatus as GoalStatusValue) ?? null,
        toStatus: (e.toStatus as GoalStatusValue) ?? null,
        reason: e.reason,
        actorName: name(e.actor),
        at: e.createdAt.toISOString(),
      })),
    }
  }

  const goals = (byParent.get(null) ?? []).map(toNode)

  const flat: GoalNode[] = []
  const walk = (n: GoalNode) => {
    flat.push(n)
    n.children.forEach(walk)
  }
  goals.forEach(walk)

  const countableMains = goals.filter(counts)
  const upcoming = flat
    .filter(counts)
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
    nextTargetDate: upcoming[0] ?? null,
  }
}

export interface GoalInput {
  title: string
  description?: string | null
  parentId?: string | null
  status?: GoalStatusValue
  /** Required when moving to AT_RISK or DISCARDED. */
  reason?: string | null
  targetDate?: string | null
}

function parseTargetDate(value: string | null | undefined): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("A target date must look like YYYY-MM-DD.")
  }
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new ValidationError("That target date is not a real date.")
  return d
}

/** Trim, cap, and insist on one where the status demands it. */
function normaliseReason(
  status: GoalStatusValue | undefined,
  raw: string | null | undefined,
): string | null {
  const reason = raw?.trim() || null
  if (status && REASON_REQUIRED.has(status) && !reason) {
    throw new ValidationError(
      status === "AT_RISK"
        ? "Say what has put this goal at risk."
        : "Say why this goal is being discarded.",
    )
  }
  if (reason && reason.length > 2000) {
    throw new ValidationError("Keep the reason under 2000 characters.")
  }
  return reason
}

export async function createGoal(
  projectId: string,
  input: GoalInput,
  actorId: string | null,
): Promise<{ id: string }> {
  const title = input.title?.trim()
  if (!title) throw new ValidationError("A goal needs a title.")
  if (title.length > 200) throw new ValidationError("Keep the title under 200 characters.")

  if (input.parentId) {
    const parent = await db.projectGoal.findFirst({
      where: { id: input.parentId, projectId },
      select: { id: true, parentId: true },
    })
    if (!parent) throw new NotFoundError("Parent goal")
    if (parent.parentId) throw new ValidationError("A sub-goal cannot have sub-goals of its own.")
  }

  const status = input.status ?? "NOT_STARTED"
  const reason = normaliseReason(status, input.reason)

  const last = await db.projectGoal.findFirst({
    where: { projectId, parentId: input.parentId ?? null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })

  // The goal and its first history entry land together, or neither does.
  return db.$transaction(async (tx) => {
    const goal = await tx.projectGoal.create({
      data: {
        projectId,
        parentId: input.parentId ?? null,
        title,
        description: input.description?.trim() || null,
        status,
        statusReason: reason,
        targetDate: parseTargetDate(input.targetDate),
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdById: actorId,
      },
      select: { id: true },
    })
    await tx.projectGoalEvent.create({
      data: { goalId: goal.id, type: "CREATED", toStatus: status, reason, actorId },
    })
    return goal
  })
}

export async function updateGoal(
  projectId: string,
  goalId: string,
  input: Partial<GoalInput>,
  actorId: string | null,
): Promise<void> {
  const existing = await db.projectGoal.findFirst({
    where: { id: goalId, projectId },
    select: { id: true, status: true, title: true, targetDate: true },
  })
  if (!existing) throw new NotFoundError("Goal")

  const data: Record<string, unknown> = {}
  const edits: string[] = []

  if (input.title !== undefined) {
    const t = input.title.trim()
    if (!t) throw new ValidationError("A goal needs a title.")
    if (t.length > 200) throw new ValidationError("Keep the title under 200 characters.")
    if (t !== existing.title) {
      data.title = t
      edits.push(`title changed to "${t}"`)
    }
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null
  if (input.targetDate !== undefined) {
    const d = parseTargetDate(input.targetDate)
    if (ymd(d) !== ymd(existing.targetDate)) {
      data.targetDate = d
      edits.push(`target date set to ${ymd(d) ?? "none"}`)
    }
  }

  const statusChanged = input.status !== undefined && input.status !== existing.status
  let reason: string | null = null
  if (input.status !== undefined) {
    reason = normaliseReason(input.status, input.reason)
    data.status = input.status
    // The reason belongs to the status that needed it. Moving to a status that
    // needs none clears it, so a stale "blocked on the client" cannot linger
    // beside a goal that is now done.
    data.statusReason = REASON_REQUIRED.has(input.status) ? reason : null
  }

  if (Object.keys(data).length === 0) return

  await db.$transaction(async (tx) => {
    await tx.projectGoal.update({ where: { id: goalId }, data })
    if (statusChanged) {
      await tx.projectGoalEvent.create({
        data: {
          goalId,
          type: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: input.status,
          reason,
          actorId,
        },
      })
    }
    if (edits.length > 0) {
      await tx.projectGoalEvent.create({
        data: { goalId, type: "EDITED", reason: edits.join(", "), actorId },
      })
    }
  })
}

/**
 * Take a goal off the board without destroying it.
 *
 * The default behind the delete button, and the reason that button opens a
 * dialog at all: "delete" on a goal somebody spent a quarter working towards
 * should be a decision, not a reflex. Deactivated goals keep their history and
 * count for nothing.
 */
export async function setGoalActive(
  projectId: string,
  goalId: string,
  isActive: boolean,
  actorId: string | null,
  reason?: string | null,
): Promise<void> {
  const existing = await db.projectGoal.findFirst({
    where: { id: goalId, projectId },
    select: { id: true, isActive: true },
  })
  if (!existing) throw new NotFoundError("Goal")
  if (existing.isActive === isActive) return

  await db.$transaction(async (tx) => {
    await tx.projectGoal.update({
      where: { id: goalId },
      data: { isActive, deactivatedAt: isActive ? null : new Date() },
    })
    // Sub-goals follow their parent: a deactivated goal whose children still
    // showed on the board would be half-hidden, which is worse than either.
    await tx.projectGoal.updateMany({
      where: { parentId: goalId },
      data: { isActive, deactivatedAt: isActive ? null : new Date() },
    })
    await tx.projectGoalEvent.create({
      data: {
        goalId,
        type: isActive ? "REACTIVATED" : "DEACTIVATED",
        reason: reason?.trim() || null,
        actorId,
      },
    })
  })
}

/** Permanent. Sub-goals and the whole history go with it (ON DELETE CASCADE). */
export async function deleteGoal(projectId: string, goalId: string): Promise<void> {
  const existing = await db.projectGoal.findFirst({
    where: { id: goalId, projectId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("Goal")
  await db.projectGoal.delete({ where: { id: goalId } })
}
