import "server-only"

import { db, type DbTransaction } from "@/server/db"
import { getTaskEditHistory, type TaskEdit } from "@/features/projects/server/task-audit"
import type { Prisma, TaskStatus } from "@prisma/client"

// Per-status time tracking: each task has exactly one OPEN period (endedAt null) for its current
// status; every transition closes it with a duration and opens the next.

type Tx = DbTransaction | typeof db

/**
 * Close the open period and open one for `to`. With no open period (older tasks), one is
 * synthesised from `taskCreatedAt` so history starts at the task's birth.
 */
export async function recordStatusChange(
  tx: Tx,
  args: {
    taskId: string
    from: TaskStatus
    to: TaskStatus
    actorId: string
    taskCreatedAt: Date
    at?: Date
    /** The hold or discard reason, kept here after the task's own reason field is cleared. */
    note?: string | null
  },
) {
  const { taskId, from, to, actorId, taskCreatedAt, note } = args
  const at = args.at ?? new Date()

  const open = await tx.taskStatusPeriod.findFirst({
    where: { taskId, endedAt: null },
    orderBy: { startedAt: "desc" },
  })

  const startedAt = open?.startedAt ?? taskCreatedAt
  // Clock skew or a backdated createdAt must not produce a negative duration.
  const durationSeconds = Math.max(0, Math.round((at.getTime() - startedAt.getTime()) / 1000))

  if (open) {
    await tx.taskStatusPeriod.update({
      where: { id: open.id },
      data: { endedAt: at, durationSeconds },
    })
  } else {
    await tx.taskStatusPeriod.create({
      data: { taskId, status: from, startedAt, endedAt: at, durationSeconds },
    })
  }

  await tx.taskStatusPeriod.create({
    data: { taskId, status: to, actorId, startedAt: at, note: note ?? null },
  })
}

export async function openFirstStatusPeriod(
  tx: Tx,
  args: { taskId: string; status: TaskStatus; actorId: string; at?: Date },
) {
  await tx.taskStatusPeriod.create({
    data: {
      taskId: args.taskId,
      status: args.status,
      actorId: args.actorId,
      startedAt: args.at ?? new Date(),
    },
  })
}

export interface TaskTimelineEntry {
  id: string
  status: TaskStatus
  startedAt: string
  endedAt: string | null
  /** Null while the period is still open - the client counts up from startedAt. */
  durationSeconds: number | null
  actor: { id: string; firstName: string; lastName: string } | null
  /** The hold or discard reason; null for older periods and statuses that need none. */
  note: string | null
  /** Which leg of the hold chain this belongs to - see TaskTimelineLeg. */
  legIndex: number
}

/** One task in a hold chain: work carried across three days is three task rows. */
export interface TaskTimelineLeg {
  id: string
  /** 1-based, oldest first. */
  index: number
  title: string
  createdAt: string
  /** The day this leg was planned for. */
  dueDate: string | null
  /** Hours booked on this leg - what was carried over into it. */
  estimatedHours: number | null
  /** True for the task whose history was actually opened. */
  isCurrent: boolean
}

export interface TaskTimeline {
  /** When the work began - the FIRST leg's creation, not this task's. */
  createdAt: string
  /** When the task first entered IN_PROGRESS, null if it never has. */
  startedAt: string | null
  /** When it first reached DONE, null if it has not. */
  completedAt: string | null
  entries: TaskTimelineEntry[]
  /** Total seconds per status across every stretch, closed periods only. */
  totals: Record<string, number>
  edits: (TaskEdit & { legIndex: number })[]
  estimatedHours: number | null
  loggedHours: number
  inProgressSince: string | null
  /** The day a task currently ON HOLD is expected to resume. Null otherwise. */
  holdExpectedDate: string | null
  /** Every task in the hold chain, oldest first. One entry = no chain. */
  legs: TaskTimelineLeg[]
  /** Hours actually spent across the whole chain. */
  chainLoggedHours: number
}

/** Guards against a cycle in resumed_from_id turning a walk into a hang. */
const MAX_CHAIN = 50

/** Every task in the same piece of work: up to the original, then down through all it spawned. */
async function resolveChain(taskId: string): Promise<string[]> {
  let rootId = taskId
  for (let i = 0; i < MAX_CHAIN; i++) {
    const parent = await db.projectTask.findUnique({
      where: { id: rootId },
      select: { resumedFromId: true },
    })
    if (!parent?.resumedFromId) break
    rootId = parent.resumedFromId
  }

  // Descendants form a tree, not a line: holding the work again can spawn a sibling.
  const ids = [rootId]
  let frontier = [rootId]
  for (let i = 0; i < MAX_CHAIN && frontier.length > 0; i++) {
    const children = await db.projectTask.findMany({
      where: { resumedFromId: { in: frontier } },
      select: { id: true },
    })
    frontier = children.map((c) => c.id).filter((id) => !ids.includes(id))
    ids.push(...frontier)
  }
  return ids
}

/** Full history across every leg of the hold chain, oldest first, with leg boundaries kept. */
export async function getTaskTimeline(taskId: string): Promise<TaskTimeline | null> {
  const chainIds = await resolveChain(taskId)

  const tasks = await db.projectTask.findMany({
    where: { id: { in: chainIds } },
    select: {
      id: true,
      title: true,
      createdAt: true,
      dueDate: true,
      status: true,
      completedAt: true,
      estimatedHours: true,
      loggedHours: true,
      inProgressSince: true,
      holdExpectedDate: true,
    },
    orderBy: { createdAt: "asc" },
  })
  if (tasks.length === 0) return null

  const task = tasks.find((t) => t.id === taskId)
  if (!task) return null

  const legs: TaskTimelineLeg[] = tasks.map((t, i) => ({
    id: t.id,
    index: i + 1,
    title: t.title,
    createdAt: t.createdAt.toISOString(),
    dueDate: t.dueDate?.toISOString() ?? null,
    estimatedHours: t.estimatedHours,
    isCurrent: t.id === taskId,
  }))
  const legIndexOf = new Map(legs.map((l) => [l.id, l.index]))

  const [periods, editsPerLeg] = await Promise.all([
    db.taskStatusPeriod.findMany({
      where: { taskId: { in: chainIds } },
      orderBy: { startedAt: "asc" },
      include: { actor: { select: { id: true, firstName: true, lastName: true } } },
    }),
    Promise.all(tasks.map((t) => getTaskEditHistory(t.id))),
  ])

  // Never changed status: show the current status as running since creation.
  const entries: TaskTimelineEntry[] =
    periods.length > 0
      ? periods.map((p) => ({
          id: p.id,
          status: p.status,
          startedAt: p.startedAt.toISOString(),
          endedAt: p.endedAt?.toISOString() ?? null,
          durationSeconds: p.durationSeconds,
          actor: p.actor,
          note: p.note,
          legIndex: legIndexOf.get(p.taskId) ?? 1,
        }))
      : [
          {
            id: "synthetic-initial",
            status: task.status,
            startedAt: task.createdAt.toISOString(),
            endedAt: null,
            durationSeconds: null,
            actor: null,
            note: null,
            legIndex: legIndexOf.get(task.id) ?? 1,
          },
        ]

  const edits = editsPerLeg.flatMap((legEdits, i) =>
    legEdits.map((e) => ({ ...e, legIndex: i + 1 })),
  )

  // Across the whole chain: hold time belongs to the work, not today's row.
  const totals: Record<string, number> = {}
  for (const e of entries) {
    if (e.durationSeconds != null) totals[e.status] = (totals[e.status] ?? 0) + e.durationSeconds
  }

  const finished = [...tasks].reverse().find((t) => t.completedAt)

  return {
    createdAt: tasks[0]!.createdAt.toISOString(),
    startedAt: entries.find((e) => e.status === "IN_PROGRESS")?.startedAt ?? null,
    completedAt: finished?.completedAt?.toISOString() ?? null,
    entries,
    totals,
    edits,
    estimatedHours: task.estimatedHours,
    loggedHours: task.loggedHours,
    inProgressSince: task.inProgressSince?.toISOString() ?? null,
    // Only meaningful while on hold.
    holdExpectedDate:
      task.status === "ON_HOLD" ? (task.holdExpectedDate?.toISOString() ?? null) : null,
    legs,
    chainLoggedHours: tasks.reduce((sum, t) => sum + t.loggedHours, 0),
  }
}
