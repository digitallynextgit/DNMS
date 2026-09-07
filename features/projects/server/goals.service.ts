import "server-only"

import type { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { ValidationError, NotFoundError } from "@/lib/errors"
import { todayUtc } from "@/lib/dates"
import {
  EMPTY_OUTPUTS,
  GOAL_ORDER,
  GOAL_SELECT,
  normaliseType,
  summariseGoalRows,
  targetTypeKeys,
  ymd,
  type GoalOutput,
  type GoalOutputMap,
  type GoalStatusValue,
  type ProjectGoalsSummary,
} from "../lib/goal-derivation"

// =============================================================================
// Project goals: reading, writing, and the history behind both.
//
// A project has main goals; a main goal has sub-goals. ONE level, and no more.
// Arbitrary nesting reads fine in a schema and badly on a screen, so the depth
// limit is enforced here rather than left to whoever calls it.
//
// ── THE ARITHMETIC LIVES NEXT DOOR ───────────────────────────────────────────
// Everything that turns rows into numbers - the SELECT shapes, the weighting,
// the derived status, the slipping check - is in ../lib/goal-derivation.ts,
// which is PURE and therefore testable and shareable with the portfolio
// roll-up. This file is the half that needs a database: it fetches, validates
// and writes. The whole derivation module is re-exported below so the existing
// importers of this file (the API routes, goals-portfolio.queries.ts) did not
// have to move.
//
// ── HISTORY IS APPEND-ONLY ───────────────────────────────────────────────────
// Every status change, deactivation and edit writes a ProjectGoalEvent. The
// current row cannot answer "when did this slip, and what did they say at the
// time", and that answer is worth more than the row the moment anyone asks why
// a date moved.
//
// ── TAGS ARE THE TEAM'S WORDS, NOT OURS ──────────────────────────────────────
// A goal carries free-text tags - "weekly", "primary", "q4 push" - typed by
// whoever set it. No enum, no admin screen to add one: a fixed list would need
// a migration every time somebody named a cadence they already run, and the
// half-answer ("Other") is exactly the value that makes a filter untrustworthy.
//
// What IS enforced here is the small set of rules that keep a free-text field
// from becoming unfilterable: trimmed, whitespace-collapsed, deduplicated
// CASE-INSENSITIVELY, capped in length and in count. "Weekly" and "weekly" must
// not become two rows in the filter list, or the filter starts lying by
// omission. Casing is otherwise preserved, because "Q4 Push" lower-cased reads
// like a typo.
// =============================================================================

// The derivation module, re-exported wholesale. Callers ask this file for
// GOAL_SELECT, GoalNode, summariseGoalRows and friends exactly as they always
// did; where those live is an implementation detail of the feature.
export * from "../lib/goal-derivation"

/** Statuses that must be accompanied by a reason. */
const REASON_REQUIRED: ReadonlySet<GoalStatusValue> = new Set<GoalStatusValue>([
  "AT_RISK",
  "DISCARDED",
])

/** Long enough for "quarterly review", short enough to stay a chip on a row. */
const MAX_TAG_LENGTH = 24
/** Past this a row is a wall of chips and the tag stops being a signal. */
const MAX_TAGS_PER_GOAL = 6

/**
 * Clean one goal's tags into something a filter can be trusted with.
 *
 * The case-insensitive dedupe is the important line. Tags are typed by hand on
 * every goal, so "Weekly" and "weekly" WILL both get typed, and a filter list
 * holding both is a filter that quietly hides half the matches behind the entry
 * the user did not click.
 */
function normaliseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new ValidationError("Tags must be a list of words.")

  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== "string") continue
    const tag = item.trim().replace(/\s+/g, " ")
    if (!tag) continue
    if (tag.length > MAX_TAG_LENGTH) {
      throw new ValidationError(
        `Keep tags under ${MAX_TAG_LENGTH} characters - "${tag}" is longer.`,
      )
    }
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }

  if (out.length > MAX_TAGS_PER_GOAL) {
    throw new ValidationError(`A goal can carry at most ${MAX_TAGS_PER_GOAL} tags.`)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// What came OUT of a goal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The columns a target tally needs, and nothing else.
 *
 * `task.goalId` is here because a deliverable can reach a goal two ways - set
 * on the row itself, or inherited from the task it came out of - and the
 * attribution has to happen in one place or a row that has both would be
 * counted twice.
 */
export const GOAL_OUTPUT_SELECT = {
  goalId: true,
  type: true,
  quantity: true,
  completedOn: true,
  task: { select: { goalId: true } },
} satisfies Prisma.ProjectDeliverableSelect

/**
 * Every delivered thing attributed to a goal on these projects, of the types
 * some target actually measures.
 *
 * ONE QUERY FOR THE WHOLE SWEEP. The portfolio summarises dozens of projects
 * and hands each group the SAME map, so the outcome figures cost one round trip
 * rather than one per project. Returns an empty map the moment there is nothing
 * to look for - a project with no targets pays nothing for the feature.
 *
 * ONLY DELIVERED AND ACCEPTED COUNT. A PLANNED row is a promise, not output,
 * and counting owed work towards a target would let a goal report itself done
 * on the strength of things nobody has made yet. REJECTED is excluded for the
 * same reason from the other end: the client sent it back.
 */
export async function loadGoalOutputs(
  projectIds: string[],
  typeKeys: string[],
): Promise<GoalOutputMap> {
  if (projectIds.length === 0 || typeKeys.length === 0) return EMPTY_OUTPUTS

  const rows = await db.projectDeliverable.findMany({
    where: {
      projectId: { in: projectIds },
      status: { in: ["DELIVERED", "ACCEPTED"] },
      completedOn: { not: null },
      // Case-insensitive because the type is free text: a target for "Reels"
      // must find rows somebody typed as "reels".
      type: { in: typeKeys, mode: "insensitive" },
      OR: [{ goalId: { not: null } }, { task: { is: { goalId: { not: null } } } }],
    },
    select: GOAL_OUTPUT_SELECT,
  })

  const map = new Map<string, GoalOutput[]>()
  for (const r of rows) {
    // Single attribution: the row's own goal wins, the task's goal is the
    // fallback. This is what makes a parent's subtree tally disjoint.
    const goalId = r.goalId ?? r.task?.goalId
    if (!goalId || !r.completedOn) continue
    const entry: GoalOutput = {
      typeKey: normaliseType(r.type),
      quantity: r.quantity,
      completedOn: r.completedOn,
    }
    const list = map.get(goalId)
    if (list) list.push(entry)
    else map.set(goalId, [entry])
  }
  return map
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
    orderBy: GOAL_ORDER,
    select: GOAL_SELECT,
  })
  // Both extra reads depend only on the rows already in hand, so they go out
  // together rather than one after the other.
  const [outputs, unlinkedOpenTasks] = await Promise.all([
    loadGoalOutputs([projectId], targetTypeKeys(rows)),
    countUnlinkedOpenTasks(projectId),
  ])
  return { ...summariseGoalRows(rows, todayUtc(), outputs), unlinkedOpenTasks }
}

/** Open tasks on a project that serve no goal - the manager's list to sort. */
export async function countUnlinkedOpenTasks(projectId: string): Promise<number> {
  return db.projectTask.count({
    where: { projectId, goalId: null, status: { notIn: ["DONE", "DISCARDED", "CANCELLED"] } },
  })
}

export interface GoalInput {
  title: string
  description?: string | null
  parentId?: string | null
  status?: GoalStatusValue
  /** Required when moving to AT_RISK or DISCARDED. */
  reason?: string | null
  targetDate?: string | null
  /** The complete set, not a delta: what is sent replaces what is stored. */
  tags?: string[]
  /** Who is accountable for it landing. Null = the account manager. */
  ownerId?: string | null
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

/** An owner must be a real employee; "" and null both mean "clear it". */
async function normaliseOwner(raw: string | null | undefined): Promise<string | null> {
  if (!raw) return null
  const who = await db.employee.findUnique({ where: { id: raw }, select: { id: true } })
  if (!who) throw new ValidationError("That owner is not an employee here.")
  return who.id
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
  // Validated before the transaction opens, so a bad tag costs a 422 rather
  // than a rolled-back write.
  const tags = input.tags === undefined ? [] : normaliseTags(input.tags)
  const ownerId = await normaliseOwner(input.ownerId)

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
        tags,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdById: actorId,
        ownerId,
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
    select: {
      id: true,
      status: true,
      title: true,
      targetDate: true,
      tags: true,
      ownerId: true,
      _count: { select: { children: true, tasks: true } },
    },
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
  if (input.ownerId !== undefined) {
    const ownerId = await normaliseOwner(input.ownerId)
    if (ownerId !== existing.ownerId) {
      data.ownerId = ownerId
      const who = ownerId
        ? await db.employee.findUnique({
            where: { id: ownerId },
            select: { firstName: true, lastName: true },
          })
        : null
      edits.push(
        who ? `owner set to ${who.firstName} ${who.lastName ?? ""}`.trim() : "owner cleared",
      )
    }
  }
  if (input.tags !== undefined) {
    const tags = normaliseTags(input.tags)
    // Compared as a set, not a list: re-saving the same tags in a different
    // order is not a change worth a line in the history.
    const before = new Set(existing.tags.map((t) => t.toLowerCase()))
    const after = new Set(tags.map((t) => t.toLowerCase()))
    if (before.size !== after.size || [...after].some((t) => !before.has(t))) {
      data.tags = tags
      edits.push(tags.length ? `tagged ${tags.join(", ")}` : "tags cleared")
    }
  }
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
    // A DERIVED goal - one with sub-goals or linked tasks - gets NOT_STARTED /
    // IN_PROGRESS / DONE from them, and a value set by hand would be overwritten
    // on the next read. Refused with the reason, rather than silently ignored.
    // AT_RISK and DISCARDED stay manual (they are judgements, not arithmetic),
    // and clearing one of those back to a working state is allowed so the
    // derivation can take over again.
    const derived = existing._count.children > 0 || existing._count.tasks > 0
    const clearingFlag = existing.status === "AT_RISK" || existing.status === "DISCARDED"
    if (derived && !REASON_REQUIRED.has(input.status) && !clearingFlag) {
      throw new ValidationError(
        "This goal's status comes from its sub-goals and tasks - move those instead. You can still flag it at risk or discard it.",
      )
    }
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
