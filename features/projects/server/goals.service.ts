import "server-only"

import type { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { ValidationError, NotFoundError } from "@/lib/errors"
import { todayUtc } from "@/lib/dates"
import {
  EMPTY_OUTPUTS,
  GOAL_ACTUAL_SOURCES,
  GOAL_ORDER,
  GOAL_SELECT,
  normaliseType,
  summariseGoalRows,
  targetTypeKeys,
  ymd,
  type GoalActualSource,
  type GoalOutput,
  type GoalOutputMap,
  type GoalStatusValue,
  type ProjectGoalsSummary,
} from "../lib/goal-derivation"
import { monthPeriod, periodKey, planMonthPeriod } from "../lib/goal-periods"
import { groupGoalPlans, type GoalPlans } from "../lib/goal-plan"
import { isProjectService, serviceInfo } from "../lib/project-services"
import {
  ensureGoalEditions,
  goalSeriesInfo,
  loadMetaActuals,
  serviceOwnerId,
} from "./goal-metrics.service"

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

/**
 * A project's goals, nested, with progress + history: one-time goals, plus the monthly editions of
 * its recurring goals for `month` ("2026-10"; default this month). `includeInactive` only changes
 * visibility.
 */
export async function getProjectGoals(
  projectId: string,
  includeInactive = false,
  month?: string | null,
): Promise<ProjectGoalsSummary> {
  // This month's editions exist before they are read; a failure only means last month shows.
  await ensureGoalEditions({ projectId }).catch((e) =>
    console.error("[goals] edition rollover failed", projectId, e),
  )
  const period = monthPeriod(month) ?? planMonthPeriod()
  const rows = await db.projectGoal.findMany({
    where: {
      projectId,
      ...(includeInactive ? {} : { isActive: true }),
      OR: [{ seriesId: null }, { periodStart: period.start }],
    },
    orderBy: GOAL_ORDER,
    select: GOAL_SELECT,
  })
  const [outputs, unlinkedOpenTasks, actuals, series, plans] = await Promise.all([
    loadGoalOutputs([projectId], targetTypeKeys(rows)),
    countUnlinkedOpenTasks(projectId),
    loadMetaActuals(projectId, rows),
    goalSeriesInfo(projectId),
    loadGoalPlans(
      projectId,
      rows.map((r) => r.id),
    ),
  ])
  return {
    ...summariseGoalRows(rows, todayUtc(), outputs, actuals),
    unlinkedOpenTasks,
    month: periodKey(period.start),
    series,
    plans,
  }
}

/** The deliverables serving these goals (directly or through their task), grouped by team. */
export async function loadGoalPlans(projectId: string, goalIds: string[]): Promise<GoalPlans> {
  if (goalIds.length === 0) return {}
  const rows = await db.projectDeliverable.findMany({
    where: {
      projectId,
      status: { not: "DISCARDED" },
      OR: [
        { goalId: { in: goalIds } },
        { goalId: null, task: { is: { goalId: { in: goalIds } } } },
      ],
    },
    select: {
      id: true,
      goalId: true,
      teamId: true,
      team: { select: { name: true, manager: { select: { firstName: true, lastName: true } } } },
      type: true,
      title: true,
      quantity: true,
      deliveredQuantity: true,
      status: true,
      dueOn: true,
      employeeId: true,
      employee: { select: { firstName: true, lastName: true } },
      task: { select: { goalId: true } },
    },
  })
  return groupGoalPlans(
    rows.flatMap((r) => {
      // Single attribution, as with outputs: the row's goal wins over its task's.
      const goalId = r.goalId ?? r.task?.goalId
      if (!goalId) return []
      return [
        {
          id: r.id,
          goalId,
          teamId: r.teamId,
          teamName: r.team?.name ?? null,
          teamManagerName: r.team?.manager
            ? `${r.team.manager.firstName} ${r.team.manager.lastName ?? ""}`.trim()
            : null,
          type: r.type,
          title: r.title,
          quantity: r.quantity,
          deliveredQuantity: r.deliveredQuantity,
          status: r.status,
          dueOn: r.dueOn,
          employeeId: r.employeeId,
          employeeName: r.employee
            ? `${r.employee.firstName} ${r.employee.lastName ?? ""}`.trim()
            : null,
        },
      ]
    }),
    todayUtc(),
  )
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
  /** What is counted ("Orders"). Null clears the number: the goal is measured by its work again. */
  metricLabel?: string | null
  /** The number to reach. Needs a metricLabel (a part inherits its parent's). */
  targetValue?: number | null
  /** A part's service (PROJECT_SERVICES code); its owner becomes accountable unless one is given. */
  service?: string | null
  actualSource?: GoalActualSource
  /** Main goals only: repeat every month from `startMonth` ("2026-10"; default this month). */
  recurring?: boolean
  startMonth?: string | null
  /** Main goals only: one numbered part per service, created with it. */
  split?: { service: string; targetValue: number; actualSource?: GoalActualSource }[]
}

const MAX_METRIC_LABEL = 40
const MAX_TARGET = 1_000_000_000

/** A label and a number belong together: a number with nothing to count is refused. */
function normaliseMetric(
  label: string | null | undefined,
  value: number | null | undefined,
): { metricLabel: string | null; targetValue: number | null } {
  const metricLabel = label?.trim().replace(/\s+/g, " ") || null
  if (metricLabel && metricLabel.length > MAX_METRIC_LABEL) {
    throw new ValidationError(`Keep what is counted under ${MAX_METRIC_LABEL} characters.`)
  }
  if (value === null || value === undefined) return { metricLabel, targetValue: null }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_TARGET) {
    throw new ValidationError("A target is a number above 0.")
  }
  if (!metricLabel) throw new ValidationError("Say what the number counts, e.g. Orders.")
  return { metricLabel, targetValue: value }
}

function normaliseSource(raw: unknown): GoalActualSource {
  if (raw === undefined || raw === null) return "MANUAL"
  if (!GOAL_ACTUAL_SOURCES.includes(raw as GoalActualSource)) {
    throw new ValidationError("That is not a source DNMS can read results from.")
  }
  return raw as GoalActualSource
}

/** A service must be one this project includes. */
async function projectService(projectId: string, raw: string | null | undefined) {
  if (!raw) return null
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { services: true },
  })
  if (!isProjectService(raw) || !project?.services.includes(raw)) {
    throw new ValidationError("This project doesn't include that service.")
  }
  return raw
}

/** A part's default title: the service's name ("Website"). */
const partTitle = (service: string) => serviceInfo(service)?.name ?? service

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

  const parent = input.parentId
    ? await db.projectGoal.findFirst({
        where: { id: input.parentId, projectId },
        select: {
          id: true,
          parentId: true,
          metricLabel: true,
          seriesId: true,
          periodStart: true,
          periodEnd: true,
        },
      })
    : null
  if (input.parentId) {
    if (!parent) throw new NotFoundError("Parent goal")
    if (parent.parentId) throw new ValidationError("A sub-goal cannot have sub-goals of its own.")
  }

  const status = input.status ?? "NOT_STARTED"
  const reason = normaliseReason(status, input.reason)
  // Validated before the transaction, so a bad tag is a 422, not a rollback.
  const tags = input.tags === undefined ? [] : normaliseTags(input.tags)

  // A part counts what its parent counts unless it says otherwise.
  const metric = normaliseMetric(
    input.metricLabel ?? (input.targetValue != null ? parent?.metricLabel : null),
    input.targetValue,
  )
  const actualSource = normaliseSource(input.actualSource)
  if (actualSource !== "MANUAL" && !metric.targetValue) {
    throw new ValidationError("Only a goal with a number can read its results from Meta.")
  }
  if (input.service && !parent) {
    throw new ValidationError("A service belongs to a part of a goal - add it as a sub-goal.")
  }
  const service = await projectService(projectId, input.service)
  if (service && parent) {
    const twin = await db.projectGoal.findFirst({
      where: { parentId: parent.id, service, isActive: true },
      select: { id: true },
    })
    if (twin) throw new ValidationError(`${partTitle(service)} already has a part in this goal.`)
  }
  // The service's owner is accountable for its part unless someone else is named.
  const ownerId =
    (await normaliseOwner(input.ownerId)) ??
    (service ? await serviceOwnerId(projectId, service) : null)

  // A recurring goal's month: the parent's for a part, else the chosen start month.
  const recurring = !parent && input.recurring === true
  const period = parent?.seriesId
    ? { start: parent.periodStart!, end: parent.periodEnd! }
    : recurring
      ? (monthPeriod(input.startMonth) ?? planMonthPeriod())
      : null
  const targetDate = period ? period.end : parseTargetDate(input.targetDate)

  // The split: one numbered part per service, made with the goal.
  const split = parent ? [] : (input.split ?? [])
  if (split.length > 0 && !metric.targetValue) {
    throw new ValidationError("Give the goal its number before splitting it by service.")
  }
  const seen = new Set<string>()
  const parts: { service: string; targetValue: number; actualSource: GoalActualSource }[] = []
  for (const item of split) {
    const code = await projectService(projectId, item?.service)
    if (!code) throw new ValidationError("Each part of the split needs a service.")
    if (seen.has(code)) throw new ValidationError(`${partTitle(code)} is in the split twice.`)
    seen.add(code)
    const value = normaliseMetric(metric.metricLabel, item.targetValue).targetValue
    if (!value) throw new ValidationError(`Give ${partTitle(code)} its share of the number.`)
    parts.push({
      service: code,
      targetValue: value,
      actualSource: normaliseSource(item.actualSource),
    })
  }
  const partOwners = new Map<string, string | null>()
  for (const part of parts)
    partOwners.set(part.service, await serviceOwnerId(projectId, part.service))

  const last = await db.projectGoal.findFirst({
    where: { projectId, parentId: input.parentId ?? null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })

  // The goal, its parts and their first history entries land together, or none do.
  return db.$transaction(async (tx) => {
    const seriesId = parent?.seriesId
      ? parent.seriesId
      : recurring
        ? (
            await tx.projectGoalSeries.create({
              data: { projectId, title, createdById: actorId },
              select: { id: true },
            })
          ).id
        : null
    const goal = await tx.projectGoal.create({
      data: {
        projectId,
        parentId: input.parentId ?? null,
        title,
        description: input.description?.trim() || null,
        status,
        statusReason: reason,
        targetDate,
        tags,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdById: actorId,
        ownerId,
        metricLabel: metric.metricLabel,
        targetValue: metric.targetValue,
        service,
        actualSource,
        seriesId,
        periodStart: period?.start ?? null,
        periodEnd: period?.end ?? null,
      },
      select: { id: true },
    })
    await tx.projectGoalEvent.create({
      data: { goalId: goal.id, type: "CREATED", toStatus: status, reason, actorId },
    })
    for (const [i, part] of parts.entries()) {
      const child = await tx.projectGoal.create({
        data: {
          projectId,
          parentId: goal.id,
          title: partTitle(part.service),
          status: "NOT_STARTED",
          targetDate,
          sortOrder: i,
          createdById: actorId,
          ownerId: partOwners.get(part.service) ?? null,
          metricLabel: metric.metricLabel,
          targetValue: part.targetValue,
          service: part.service,
          actualSource: part.actualSource,
          seriesId,
          periodStart: period?.start ?? null,
          periodEnd: period?.end ?? null,
        },
        select: { id: true },
      })
      await tx.projectGoalEvent.create({
        data: { goalId: child.id, type: "CREATED", toStatus: "NOT_STARTED", actorId },
      })
    }
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
      parentId: true,
      status: true,
      title: true,
      targetDate: true,
      tags: true,
      ownerId: true,
      metricLabel: true,
      targetValue: true,
      service: true,
      actualSource: true,
      seriesId: true,
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
  // An edition's date is its month's last day; only a one-time goal's can move.
  if (input.targetDate !== undefined && !existing.seriesId) {
    const d = parseTargetDate(input.targetDate)
    if (ymd(d) !== ymd(existing.targetDate)) {
      data.targetDate = d
      edits.push(`target date set to ${ymd(d) ?? "none"}`)
    }
  }
  if (input.metricLabel !== undefined || input.targetValue !== undefined) {
    const m = normaliseMetric(
      input.metricLabel !== undefined ? input.metricLabel : existing.metricLabel,
      input.targetValue !== undefined ? input.targetValue : existing.targetValue,
    )
    if (m.metricLabel !== existing.metricLabel || m.targetValue !== existing.targetValue) {
      data.metricLabel = m.metricLabel
      data.targetValue = m.targetValue
      edits.push(
        m.targetValue
          ? `target set to ${m.targetValue.toLocaleString("en-IN")} ${m.metricLabel}`
          : "number removed",
      )
      // Meta can only fill a goal that has a number.
      if (!m.targetValue && existing.actualSource !== "MANUAL") data.actualSource = "MANUAL"
    }
  }
  if (input.actualSource !== undefined) {
    const src = normaliseSource(input.actualSource)
    const hasNumber = (data.targetValue ?? existing.targetValue) != null
    if (src !== "MANUAL" && !hasNumber) {
      throw new ValidationError("Only a goal with a number can read its results from Meta.")
    }
    if (src !== existing.actualSource) {
      data.actualSource = src
      edits.push(
        src === "META_PURCHASES"
          ? "results now come from Meta purchases"
          : "results now entered by hand",
      )
    }
  }
  if (input.service !== undefined) {
    if (!existing.parentId && input.service) {
      throw new ValidationError("A service belongs to a part of a goal, not the goal itself.")
    }
    const service = await projectService(projectId, input.service)
    if (service !== existing.service) {
      if (service) {
        const twin = await db.projectGoal.findFirst({
          where: { parentId: existing.parentId, service, isActive: true, id: { not: goalId } },
          select: { id: true },
        })
        if (twin)
          throw new ValidationError(`${partTitle(service)} already has a part in this goal.`)
      }
      data.service = service
      edits.push(service ? `service set to ${partTitle(service)}` : "service cleared")
    }
  }

  const statusChanged = input.status !== undefined && input.status !== existing.status
  let reason: string | null = null
  if (input.status !== undefined) {
    // A goal with sub-goals, tasks or a number derives NOT_STARTED/IN_PROGRESS/DONE, so setting one
    // by hand is refused. AT_RISK and DISCARDED stay manual; clearing them lets the derivation lead.
    const derived =
      existing._count.children > 0 || existing._count.tasks > 0 || existing.targetValue !== null
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
