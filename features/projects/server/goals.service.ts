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

// Project goals: fetch, validate, write. Main goals have ONE level of sub-goals. The maths is in
// ../lib/goal-derivation.ts; every change appends a ProjectGoalEvent (history is append-only).

// Re-exported so callers keep importing GOAL_SELECT, GoalNode etc. from here.
export * from "../lib/goal-derivation"

/** Statuses that must be accompanied by a reason. */
const REASON_REQUIRED: ReadonlySet<GoalStatusValue> = new Set<GoalStatusValue>([
  "AT_RISK",
  "DISCARDED",
])

const MAX_TAG_LENGTH = 24
const MAX_TAGS_PER_GOAL = 6

/** Trim, cap and dedupe tags case-insensitively, so "Weekly"/"weekly" don't split the filter. */
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

/** Includes `task.goalId`: a deliverable reaches a goal via its own goalId or its task's. */
export const GOAL_OUTPUT_SELECT = {
  goalId: true,
  type: true,
  quantity: true,
  completedOn: true,
  task: { select: { goalId: true } },
} satisfies Prisma.ProjectDeliverableSelect

/**
 * Delivered output per goal across these projects, for the types some target measures - one query
 * for the whole sweep. Only DELIVERED/ACCEPTED count: planned work is a promise, rejected came back.
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
      // Case-insensitive: the type is free text.
      type: { in: typeKeys, mode: "insensitive" },
      OR: [{ goalId: { not: null } }, { task: { is: { goalId: { not: null } } } }],
    },
    select: GOAL_OUTPUT_SELECT,
  })

  const map = new Map<string, GoalOutput[]>()
  for (const r of rows) {
    // Single attribution - the row's goal wins over its task's - so subtree tallies stay disjoint.
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

/** A project's goals, nested, with progress + history. `includeInactive` only changes visibility. */
export async function getProjectGoals(
  projectId: string,
  includeInactive = false,
): Promise<ProjectGoalsSummary> {
  const rows = await db.projectGoal.findMany({
    where: { projectId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: GOAL_ORDER,
    select: GOAL_SELECT,
  })
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
  // Validated before the transaction, so a bad tag is a 422, not a rollback.
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
    // Compared as a set: reordering isn't a change.
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
    // A goal with sub-goals or tasks derives NOT_STARTED/IN_PROGRESS/DONE, so setting one by hand is
    // refused. AT_RISK and DISCARDED stay manual, and clearing them lets the derivation take over.
    const derived = existing._count.children > 0 || existing._count.tasks > 0
    const clearingFlag = existing.status === "AT_RISK" || existing.status === "DISCARDED"
    if (derived && !REASON_REQUIRED.has(input.status) && !clearingFlag) {
      throw new ValidationError(
        "This goal's status comes from its sub-goals and tasks - move those instead. You can still flag it at risk or discard it.",
      )
    }
    reason = normaliseReason(input.status, input.reason)
    data.status = input.status
    // Clear the reason when the new status needs none, so a stale one can't linger.
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

/** Soft-delete (the delete button's default): history kept, counts for nothing. */
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
    // Sub-goals follow their parent, so nothing is half-hidden.
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
