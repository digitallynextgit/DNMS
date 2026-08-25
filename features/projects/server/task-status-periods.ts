import "server-only"

import { db, type DbTransaction } from "@/server/db"
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

type Tx = DbTransaction | typeof db

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
    /** Why it moved here - the hold or discard reason. Kept on the period so the
     *  history still has it after the task's own reason field is cleared. */
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
  /** Why it was moved here - the hold or discard reason. Null for periods
   *  recorded before reasons were kept, and for statuses that need none. */
  note: string | null
  /** Which leg of the hold chain this belongs to - see TaskTimelineLeg. */
  legIndex: number
}

/**
 * One task in a hold chain.
 *
 * Holding work books its unfinished hours onto a new task for the day it should
 * resume, so a job carried across Monday, Tuesday and Wednesday is THREE task
 * rows. Each row knowing only its own day makes the history useless: opening
 * Wednesday's would show a task created that morning with no hint that it began
 * on Monday, or why it was parked twice. The legs let one log tell the whole
 * story.
 */
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
  /** Field edits - who changed what, from what to what. */
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

/**
 * Every task belonging to the same piece of work as `taskId`: walk up to the
 * original, then back down through everything it spawned. Opening ANY leg gives
 * the same full set, so the history reads the same from wherever you enter it.
 */
async function resolveChain(taskId: string): Promise<string[]> {
  // Up to the root.
  let rootId = taskId
  for (let i = 0; i < MAX_CHAIN; i++) {
    const parent = await db.projectTask.findUnique({
      where: { id: rootId },
      select: { resumedFromId: true },
    })
    if (!parent?.resumedFromId) break
    rootId = parent.resumedFromId
  }

  // Down through the descendants. A tree rather than a strict line: a follow-up
  // that was finished and the work held again spawns a sibling.
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

/**
 * Full history for a piece of work, oldest first - across every leg of its hold
 * chain, not just the task that was opened.
 *
 * Work carried across three days is three task rows, and a log that stops at
 * this row's own creation cannot answer "why was this parked on Monday". So the
 * whole chain is resolved and merged onto one chronology; the leg boundaries are
 * kept as markers rather than flattened away, because "carried over to Tuesday"
 * is itself part of the story.
 */
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

  // Across the WHOLE chain: "how long did this sit on hold" is a question about
  // the work, not about whichever row happens to hold it today.
  const totals: Record<string, number> = {}
  for (const e of entries) {
    if (e.durationSeconds != null) totals[e.status] = (totals[e.status] ?? 0) + e.durationSeconds
  }

  const finished = [...tasks].reverse().find((t) => t.completedAt)

  return {
    // The first leg's birth - when this work actually started being tracked.
    createdAt: tasks[0]!.createdAt.toISOString(),
    startedAt: entries.find((e) => e.status === "IN_PROGRESS")?.startedAt ?? null,
    completedAt: finished?.completedAt?.toISOString() ?? null,
    entries,
    totals,
    edits,
    estimatedHours: task.estimatedHours,
    loggedHours: task.loggedHours,
    inProgressSince: task.inProgressSince?.toISOString() ?? null,
    // Only meaningful while the task is actually on hold; any other status has
    // already cleared it.
    holdExpectedDate:
      task.status === "ON_HOLD" ? (task.holdExpectedDate?.toISOString() ?? null) : null,
    legs,
    chainLoggedHours: tasks.reduce((sum, t) => sum + t.loggedHours, 0),
  }
}
