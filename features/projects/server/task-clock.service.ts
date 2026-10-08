import "server-only"

import type { DbTransaction } from "@/server/db"

// A clock runs while a task is IN_PROGRESS and banks into loggedHours when it stops. Several tasks
// may run at once and EACH banks the full stretch, so a person's summed hours can exceed the wall
// clock: task hours mean "how long the task was open", not time worked.

export interface SettledTask {
  id: string
  title: string
  /** Hours credited by this settle - the whole stretch that just ended. */
  creditedHours: number
}

/**
 * Bank the stretch each of this person's running tasks just finished and restart them from `at`.
 * Call BEFORE starting/stopping a clock, inside the caller's transaction.
 */
export async function settleRunningTasks(
  tx: DbTransaction,
  args: {
    /** Whose clocks. Null (unassigned) means there is nothing to settle. */
    assigneeId: string | null
    actorId: string
    at?: Date
  },
): Promise<SettledTask[]> {
  const { assigneeId } = args
  if (!assigneeId) return []
  const at = args.at ?? new Date()

  // Matches on the timestamp, not status, so a row whose status drifted is settled too.
  const running = await tx.projectTask.findMany({
    where: { assigneeId, inProgressSince: { not: null } },
    select: { id: true, title: true, loggedHours: true, inProgressSince: true },
  })
  if (running.length === 0) return []

  const settled: SettledTask[] = []

  for (const t of running) {
    const credited = Math.max(0, (at.getTime() - t.inProgressSince!.getTime()) / 3_600_000)
    await tx.projectTask.update({
      where: { id: t.id },
      data: {
        // Rounded to the second, so repeated start/stop cycles cannot drift.
        loggedHours: Math.round((t.loggedHours + credited) * 3600) / 3600,
        // Restarted, not stopped: the caller decides which clocks keep running.
        inProgressSince: at,
      },
    })
    settled.push({
      id: t.id,
      title: t.title,
      creditedHours: Math.round(credited * 3600) / 3600,
    })
  }

  return settled
}
