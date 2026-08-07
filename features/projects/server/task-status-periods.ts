import "server-only"

import { db } from "@/server/db"
import { getTaskEditHistory, type TaskEdit } from "@/features/projects/server/task-audit"
import type { Prisma, TaskStatus } from "@prisma/client"

/**
 * Per-status time tracking for a task.
 *
 * The invariant: a task has exactly one OPEN period (endedAt = null) and it
 * names the status the task is in right now. Every transition closes the open
 * one with its duration and opens the next, so "how long was this in Progress"
 * is a stored number rather than something reconstructed from an activity feed.
 */

type Tx = Prisma.TransactionClient | typeof db

/**
 * Record a status transition. Closes the currently open period and opens one for
 * `to`.
 *
 * If no open period exists (the task predates this table, or its first row was
 * never written) one is synthesised from `taskCreatedAt` so the history starts
 * at the task's birth instead of at the first change anyone happened to make.
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
  },
) {
  const { taskId, from, to, actorId, taskCreatedAt } = args
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
    data: { taskId, status: to, actorId, startedAt: at },
  })
}

/** Open the first period for a freshly created task. */
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
}

export interface TaskTimeline {
  createdAt: string
  /** When the task first entered IN_PROGRESS, null if it never has. */
  startedAt: string | null
  /** When it first reached DONE, null if it has not. */
  completedAt: string | null
  entries: TaskTimelineEntry[]
  /** Total seconds per status across every stretch, closed periods only. */
  totals: Record<string, number>
  /** Field edits - who changed what, from what to what. */
  edits: TaskEdit[]
  estimatedHours: number | null
  loggedHours: number
  inProgressSince: string | null
}

/** Full status history for one task, oldest first. */
export async function getTaskTimeline(taskId: string): Promise<TaskTimeline | null> {
  const task = await db.projectTask.findUnique({
    where: { id: taskId },
    select: {
      createdAt: true,
      status: true,
      completedAt: true,
      estimatedHours: true,
      loggedHours: true,
      inProgressSince: true,
    },
  })
  if (!task) return null

  const [periods, edits] = await Promise.all([
    db.taskStatusPeriod.findMany({
      where: { taskId },
      orderBy: { startedAt: "asc" },
      include: { actor: { select: { id: true, firstName: true, lastName: true } } },
    }),
    getTaskEditHistory(taskId),
  ])

  // A task that has never changed status has no row yet: show its current status
  // as running since creation rather than an empty history.
  const entries: TaskTimelineEntry[] =
    periods.length > 0
      ? periods.map((p) => ({
          id: p.id,
          status: p.status,
          startedAt: p.startedAt.toISOString(),
          endedAt: p.endedAt?.toISOString() ?? null,
          durationSeconds: p.durationSeconds,
          actor: p.actor,
        }))
      : [
          {
            id: "synthetic-initial",
            status: task.status,
            startedAt: task.createdAt.toISOString(),
            endedAt: null,
            durationSeconds: null,
            actor: null,
          },
        ]

  const totals: Record<string, number> = {}
  for (const e of entries) {
    if (e.durationSeconds != null) totals[e.status] = (totals[e.status] ?? 0) + e.durationSeconds
  }

  return {
    createdAt: task.createdAt.toISOString(),
    startedAt: entries.find((e) => e.status === "IN_PROGRESS")?.startedAt ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    entries,
    totals,
    edits,
    estimatedHours: task.estimatedHours,
    loggedHours: task.loggedHours,
    inProgressSince: task.inProgressSince?.toISOString() ?? null,
  }
}
