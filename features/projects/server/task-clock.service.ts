import "server-only"

import type { DbTransaction } from "@/server/db"
import { recordStatusChange } from "./task-status-periods"

// =============================================================================
// One clock per person.
//
// Time spent is MEASURED, not typed in: a task's clock starts when it enters
// IN_PROGRESS and the elapsed stretch is banked into loggedHours when it leaves
// (see app/api/tasks/[id]/route.ts). Nothing, however, stopped a SECOND task
// starting while the first was still running - and then both banked the same
// wall-clock time.
//
// That is not a hypothetical. On 19 Aug 2026 two tasks were started three
// seconds apart and finished together; each banked 6h 33m, so one 6h 33m morning
// was booked as 13h 6m. A third task would have made it 19h 39m. The numbers
// feed the performance page, the progress buckets and the over-budget reminders,
// all of which were reading a day that could not physically have happened.
//
// So starting a task now pauses whatever else that person had running. The
// clock means "what I am on RIGHT NOW", which is the only reading under which
// measured time can never exceed the day it was measured in.
//
// ── WHY PAUSE RATHER THAN REFUSE ─────────────────────────────────────────────
// Blocking the second start would also keep the books straight, but it puts the
// burden on the person to remember to stop the old task first - and the failure
// mode of forgetting is an error message mid-work rather than correct data.
// Pausing needs nothing remembered, and no time is lost: the stretch already
// worked is banked on the way out, exactly as an explicit pause would.
//
// The paused task goes back to TODO because there is no PAUSED status and never
// was one - stopping a task has always meant moving it out of IN_PROGRESS.
// =============================================================================

export interface PausedTask {
  id: string
  title: string
  /** Hours banked by this pause - the stretch that had been running. */
  bankedHours: number
}

/**
 * Bank and stop every OTHER task this person has running.
 *
 * Runs inside the caller's transaction: a task started without the previous one
 * stopping is the double-count this exists to prevent, so the two must land
 * together or not at all.
 *
 * Returns what was paused so the caller can say so - a task that silently moves
 * itself out of In Progress is worse than the double-count, because the person
 * cannot tell whether their time was recorded.
 */
export async function pauseOtherRunningTasks(
  tx: DbTransaction,
  args: {
    /** Whose clock. Null (unassigned) means there is nobody to pause for. */
    assigneeId: string | null
    /** The task just started - never pauses itself. */
    exceptTaskId: string
    actorId: string
    at?: Date
  },
): Promise<PausedTask[]> {
  const { assigneeId, exceptTaskId, actorId } = args
  if (!assigneeId) return []
  const at = args.at ?? new Date()

  // `inProgressSince: { not: null }` rather than status alone: the running clock
  // IS that column, and a row whose status drifted out of IN_PROGRESS while the
  // timestamp survived is exactly the leak that keeps accruing unnoticed. This
  // catches those too and closes them.
  const running = await tx.projectTask.findMany({
    where: {
      assigneeId,
      id: { not: exceptTaskId },
      inProgressSince: { not: null },
    },
    select: {
      id: true,
      title: true,
      status: true,
      loggedHours: true,
      inProgressSince: true,
      createdAt: true,
    },
  })
  if (running.length === 0) return []

  const paused: PausedTask[] = []
  for (const t of running) {
    // Same arithmetic as the route's own stop path, to the second, so a stretch
    // ended by this pause and one ended by hand cannot bank different totals.
    const elapsed = Math.max(0, (at.getTime() - t.inProgressSince!.getTime()) / 3_600_000)
    const banked = Math.round((t.loggedHours + elapsed) * 3600) / 3600

    await tx.projectTask.update({
      where: { id: t.id },
      data: { loggedHours: banked, inProgressSince: null, status: "TODO" },
    })

    // The history has to show the pause. Without it the timeline reads as one
    // unbroken IN_PROGRESS stretch that silently stopped counting, which is the
    // same unexplained gap the raw bug produced.
    if (t.status === "IN_PROGRESS") {
      await recordStatusChange(tx, {
        taskId: t.id,
        from: "IN_PROGRESS",
        to: "TODO",
        actorId,
        taskCreatedAt: t.createdAt,
        at,
        note: "Paused automatically - another task was started",
      })
    }

    paused.push({
      id: t.id,
      title: t.title,
      bankedHours: Math.round(elapsed * 3600) / 3600,
    })
  }
  return paused
}
