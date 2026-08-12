import "server-only"

import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
// Imported from the module rather than the projects barrel on purpose (as
// my-tasks/page.tsx does): the barrel re-exports every project COMPONENT, and a
// cron job has no business pulling those in to build one URL.
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

/**
 * Save an employee's own settings. Upsert rather than update: the row is created
 * lazily on first save, so nothing has to seed a preference per employee.
 */
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
  /** Reminders actually delivered. */
  sent: number
  /** Spent states removed. */
  pruned: number
}

/**
 * How long a finished run's state is kept before pruning. Comfortably longer
 * than any single stretch of work, so a state is never deleted out from under a
 * task that is still running and could otherwise be re-reminded from zero.
 */
const STATE_RETENTION_DAYS = 7

/**
 * The cron runs every minute, but a 7-day retention means the prune has nothing
 * to do on all but a handful of those passes. Rate-limiting it to hourly turns
 * ~1440 pointless DELETEs a day into 24. Process-local on purpose: it is a
 * throttle, not a lock, so a restart or a second instance simply prunes once
 * more than strictly needed - which costs nothing and cannot lose data.
 */
const PRUNE_INTERVAL_MS = 3_600_000
let lastPrunedAt = 0

/**
 * Send whatever "your time on this task is nearly up" reminders are due.
 *
 * Meant to be run every minute by the cron route. Everything it needs is derived
 * from live task state, so a missed run costs at most a late reminder, never a
 * duplicated or a lost one:
 *
 *  - A task qualifies while it is IN_PROGRESS with hours booked and an assignee.
 *    Nothing is scheduled ahead of time, so re-estimating a task or handing it to
 *    someone else takes effect on the very next pass.
 *  - Progress is stored per RUN (task + inProgressSince). Pausing and restarting
 *    a task starts a fresh set of reminders, which matches what the employee
 *    sees: the clock restarted.
 *  - At most ONE reminder per task per pass, always the latest one due. A cron
 *    that was down for an hour therefore delivers a single current "you are 20
 *    minutes over" rather than replaying a schedule nobody can act on.
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

  // Nobody is working: the common case outside office hours, and there is
  // nothing left to look up. One query and out.
  if (running.length === 0) {
    return { scanned: 0, sent: 0, pruned: await prune(now) }
  }

  const prefs = await getTaskReminderPreferences(
    Array.from(new Set(running.map((t) => t.assigneeId).filter((id): id is string => !!id))),
  )

  // The open state row for each running task, in one query rather than one per
  // task. Keyed by `${taskId}|${runStartedAt}` so a state left over from an
  // earlier run of the same task cannot be mistaken for this one's.
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

    // Claim the reminder BEFORE sending it. Two overlapping cron passes race on
    // the same row, and the loser's conditional update matches nothing - so the
    // employee gets one notification, not two.
    const claimed = await claimReminder(task.id, inProgressSince, alreadySent, due, now)
    if (!claimed) continue

    const minutesLeft = minutesUntil(deadline, now)
    // A task carrying only a team still belongs to that team's project; the id
    // stands in when the project row was not selected (no slug to prefer).
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

/**
 * Move a run's sent counter from `expected` to `next`, returning whether this
 * caller won it. `updateMany` with `sentCount: expected` in the WHERE is the
 * whole lock: it reports 0 rows changed when another pass got there first.
 */
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
      // Unique violation - a concurrent pass created the row first. Fall through
      // to the conditional update, which will claim it only if it is still behind.
    }
  }

  const { count } = await db.taskReminderState.updateMany({
    where: { taskId, runStartedAt, sentCount: { lt: next } },
    data: { sentCount: next, lastSentAt: now },
  })
  return count > 0
}
