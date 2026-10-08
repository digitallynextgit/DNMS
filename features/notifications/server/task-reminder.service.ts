import "server-only"

import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
// Direct import, not the projects barrel: the barrel pulls in every project component.
import { projectHref } from "@/features/projects/lib/project-href"
import { taskReminderPreferenceSchema } from "../schemas/task-reminder.schema"
import { getTaskReminderPreferences, preferenceFor } from "./task-reminder.queries"
import {
  budgetDeadline,
  dueReminderCount,
  minutesUntil,
  reminderMessage,
  reminderTimes,
} from "../lib/reminder-schedule"
import type { ReminderPreference } from "../types"

/** Save the employee's own settings (the row is created lazily on first save). */
export async function saveTaskReminderPreference(
  employeeId: string,
  input: unknown,
): Promise<ReminderPreference> {
  const data = taskReminderPreferenceSchema.parse(input)
  const row = await db.taskReminderPreference.upsert({
    where: { employeeId },
    create: { employeeId, ...data },
    update: data,
    select: {
      enabled: true,
      leadMinutes: true,
      reminderCount: true,
      repeatEveryMinutes: true,
    },
  })
  return row
}

export interface ReminderRunResult {
  /** Running tasks considered this pass. */
  scanned: number
  sent: number
  /** Spent states removed. */
  pruned: number
}

/** How long a finished run's state is kept - longer than any stretch of work, so a running
 *  task is never re-reminded from zero. */
const STATE_RETENTION_DAYS = 7

/** Prune at most hourly (the cron runs every minute). A process-local throttle, not a lock. */
const PRUNE_INTERVAL_MS = 3_600_000
let lastPrunedAt = 0

/**
 * Send the "time on this task is nearly up" reminders that are due (cron, every minute). State is
 * derived from live tasks, so a missed run only delays a reminder. Progress is tracked per run
 * (task + inProgressSince), and only the latest due reminder is sent per task per pass.
 */
export async function runTaskReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const running = await db.projectTask.findMany({
    where: {
      status: "IN_PROGRESS",
      inProgressSince: { not: null },
      assigneeId: { not: null },
      estimatedHours: { not: null, gt: 0 },
      // A task nobody can act on any more should not be nagging its assignee.
      assignee: { is: { isActive: true } },
    },
    select: {
      id: true,
      title: true,
      assigneeId: true,
      estimatedHours: true,
      loggedHours: true,
      inProgressSince: true,
      projectId: true,
      project: { select: { id: true, slug: true } },
      team: { select: { projectId: true } },
    },
  })

  if (running.length === 0) {
    return { scanned: 0, sent: 0, pruned: await prune(now) }
  }

  const prefs = await getTaskReminderPreferences(
    Array.from(new Set(running.map((t) => t.assigneeId).filter((id): id is string => !!id))),
  )

  // Open state rows for all running tasks, keyed by run so an earlier run's state can't match.
  const states = await db.taskReminderState.findMany({
    where: { taskId: { in: running.map((t) => t.id) } },
    select: { taskId: true, runStartedAt: true, sentCount: true },
  })
  const sentByRun = new Map(
    states.map((s) => [runKey(s.taskId, s.runStartedAt), s.sentCount] as const),
  )

  let sent = 0

  for (const task of running) {
    const assigneeId = task.assigneeId
    const inProgressSince = task.inProgressSince
    const estimatedHours = task.estimatedHours
    if (!assigneeId || !inProgressSince || estimatedHours == null) continue

    const pref = preferenceFor(prefs, assigneeId)
    if (!pref.enabled) continue

    const deadline = budgetDeadline({
      estimatedHours,
      loggedHours: task.loggedHours,
      inProgressSince,
    })
    const due = dueReminderCount(reminderTimes(deadline, pref), now)
    if (due === 0) continue

    const alreadySent = sentByRun.get(runKey(task.id, inProgressSince)) ?? 0
    if (due <= alreadySent) continue

    // Claim before sending: of two overlapping passes only one wins, so one notification.
    const claimed = await claimReminder(task.id, inProgressSince, alreadySent, due, now)
    if (!claimed) continue

    const minutesLeft = minutesUntil(deadline, now)
    // A team-only task still belongs to the team's project.
    const projectId = task.project?.id ?? task.team?.projectId ?? task.projectId

    await createNotification({
      employeeId: assigneeId,
      title: minutesLeft > 0 ? "Task time almost up" : "Task over its estimate",
      message: reminderMessage(task.title, minutesLeft),
      type: minutesLeft > 0 ? "warning" : "error",
      // Adhoc work belongs to no project, and My Tasks is where it lives.
      link: projectId
        ? projectHref({ id: projectId, slug: task.project?.slug })
        : "/projects/my-tasks",
    })
    sent++
  }

  return { scanned: running.length, sent, pruned: await prune(now) }
}

/** Drop spent run states, at most once an hour. Returns how many went. */
async function prune(now: Date): Promise<number> {
  if (now.getTime() - lastPrunedAt < PRUNE_INTERVAL_MS) return 0
  lastPrunedAt = now.getTime()
  const { count } = await db.taskReminderState.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - STATE_RETENTION_DAYS * 86_400_000) } },
  })
  return count
}

function runKey(taskId: string, runStartedAt: Date): string {
  return `${taskId}|${runStartedAt.getTime()}`
}

/** Move a run's sent counter from `expected` to `next`; the conditional updateMany is the lock
 *  (0 rows when another pass won). */
async function claimReminder(
  taskId: string,
  runStartedAt: Date,
  expected: number,
  next: number,
  now: Date,
): Promise<boolean> {
  if (expected === 0) {
    try {
      await db.taskReminderState.create({
        data: { taskId, runStartedAt, sentCount: next, lastSentAt: now },
      })
      return true
    } catch {
      // Unique violation: a concurrent pass created the row; the conditional update decides.
    }
  }

  const { count } = await db.taskReminderState.updateMany({
    where: { taskId, runStartedAt, sentCount: { lt: next } },
    data: { sentCount: next, lastSentAt: now },
  })
  return count > 0
}
