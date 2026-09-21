import "server-only"

import type { DbTransaction } from "@/server/db"

// =============================================================================
// Several tasks at once, each on its own clock.
//
// Time spent is MEASURED, not typed in: a clock starts when a task enters
// IN_PROGRESS and the elapsed stretch is banked into loggedHours when it stops.
// People genuinely work on more than one thing - a build running while you edit
// copy, two pages open side by side - so any number of a person's tasks may run
// at the same time.
//
// EVERY RUNNING TASK BANKS THE FULL STRETCH. Two tasks running across the same
// hour each bank an hour. A task's hours are its own: what else happened to be
// running beside it never changes them, so the figure on a task is simply how
// long that task was open.
//
// ── WHAT THAT MEANS FOR PER-PERSON TOTALS ────────────────────────────────────
// Summed across tasks, a person's day CAN exceed the hours in it: two clocks
// over a 6h 33m morning total 13h 6m. That is intended and is the deliberate
// trade for per-task figures that nothing else can dilute. These numbers answer
// "how long was this task open", NOT "how long was this person working".
// Anything needing the second question - capacity, utilisation, the real length
// of someone's day - has to measure attendance, because summing task clocks
// cannot answer it.
//
// Between 19 Aug and 21 Sep 2026 this worked the other way: concurrent clocks
// shared real time, each accruing 1/N, so a day always totalled the wall clock.
// That made a task's own figure depend on unrelated work running beside it -
// start a second task and the first silently halved - which is what this
// replaces.
//
// ── SETTLING ─────────────────────────────────────────────────────────────────
// Starting or stopping any clock still banks the stretch every running task has
// just finished and restarts them all from the same instant. At full rate that
// is arithmetically a no-op for the tasks left running - banking (t1-t0) now and
// (t2-t1) later is the same total as banking (t2-t0) at the end. It is kept
// because it also sweeps up a row whose status drifted out of IN_PROGRESS while
// the timestamp survived, which would otherwise accrue unnoticed for a week.
// =============================================================================

export interface SettledTask {
  id: string
  title: string
  /** Hours credited by this settle - the whole stretch that just ended. */
  creditedHours: number
}

/**
 * Bank the stretch every one of this person's running tasks has just finished,
 * and restart them all from `at`.
 *
 * Call this BEFORE starting or stopping a clock, so the stretch that is ending
 * is banked against the task that earned it. Runs inside the caller's
 * transaction: a settle without the status change it accompanies, or the
 * reverse, is how hours go missing.
 *
 * Each running task is credited the FULL stretch - concurrent clocks do not
 * divide it between them. Returns what was banked, for callers that want to
 * show it.
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

  // `inProgressSince: { not: null }` rather than status: the running clock IS
  // that column, and a row whose status drifted out of IN_PROGRESS while the
  // timestamp survived is a leak that keeps accruing unnoticed. This settles
  // and restarts those too, so they cannot silently bank a week.
  const running = await tx.projectTask.findMany({
    where: { assigneeId, inProgressSince: { not: null } },
    select: { id: true, title: true, loggedHours: true, inProgressSince: true },
  })
  if (running.length === 0) return []

  const settled: SettledTask[] = []

  for (const t of running) {
    // The WHOLE stretch, to every clock that was running for it. Running two
    // tasks side by side is not a reason to pay either of them less.
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
