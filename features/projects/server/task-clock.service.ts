import "server-only"

import type { DbTransaction } from "@/server/db"

// =============================================================================
// Several tasks at once, without billing the same hour twice.
//
// Time spent is MEASURED, not typed in: a clock starts when a task enters
// IN_PROGRESS and the elapsed stretch is banked into loggedHours when it stops.
// People genuinely work on more than one thing - a build running while you edit
// copy, two pages open side by side - so any number of a person's tasks may run
// at the same time.
//
// ── THE PROBLEM THAT CREATES, AND THE FIX ────────────────────────────────────
// Two clocks over one morning used to bank the morning TWICE. On 19 Aug 2026
// two tasks were started three seconds apart and finished together; each banked
// 6h 33m, so a 6h 33m morning was booked as 13h 6m. Three tasks would have made
// it 19h 39m. Those numbers feed the performance page, the progress buckets and
// the over-budget reminders, all of which were reading a day that could not
// physically have happened.
//
// So concurrent tasks SHARE the clock. While N of a person's tasks are running,
// each accrues at 1/N of real time. Two tasks over 6h 33m get 3h 16m each; the
// day still totals 6h 33m, which is the only total that can be true.
//
// ── HOW THE SHARING STAYS EXACT ──────────────────────────────────────────────
// Not by tracking attention, which nothing can do, but by SETTLING the whole
// running set every time it changes. Starting or stopping any task first credits
// every running task with `elapsed / N` for the stretch just ended, then resets
// them all to the same instant. Each stretch is therefore paid out at the rate
// that was true while it ran:
//
//   t0  A starts                      A alone
//   t1  B starts   -> settle: A += (t1-t0)/1        both now marked from t1
//   t2  A stops    -> settle: A += (t2-t1)/2, B += (t2-t1)/2
//   t3  B stops    -> settle: B += (t3-t2)/1
//
//   A + B  =  (t1-t0) + (t2-t1) + (t3-t2)  =  t3 - t0.  Exactly the wall clock.
//
// The one thing this cannot know is which task you were really looking at. Start
// three and walk away and all three earn a third each. That is a fair split of a
// real hour rather than three invented ones, and it is the honest answer
// available without asking someone to click every time their attention moves.
// =============================================================================

export interface SettledTask {
  id: string
  title: string
  /** Hours credited by this settle - the stretch's share. */
  creditedHours: number
  /** How many clocks were sharing the stretch. 1 = it ran alone. */
  sharedWith: number
}

/**
 * Bank the stretch every one of this person's running tasks has just finished,
 * and restart them all from `at`.
 *
 * Call this BEFORE starting or stopping a clock, so the stretch that is ending
 * is paid at the rate that applied while it ran rather than the rate that is
 * about to apply. Runs inside the caller's transaction: a settle without the
 * status change it accompanies, or the reverse, is how hours go missing.
 *
 * Returns only the tasks that actually shared with another (sharedWith > 1), so
 * a caller can tell the user their time was split without narrating the ordinary
 * single-clock case.
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

  const share = running.length
  const settled: SettledTask[] = []

  for (const t of running) {
    const elapsed = Math.max(0, (at.getTime() - t.inProgressSince!.getTime()) / 3_600_000)
    const credited = elapsed / share
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
      sharedWith: share,
    })
  }

  return share > 1 ? settled : []
}

/**
 * How many of a person's clocks are running right now.
 *
 * The live figure on a sheet is `loggedHours` plus the stretch in flight, and
 * that stretch is being shared - so a caller showing live time has to divide by
 * this or it over-reports until the next settle. See weekly-hours.queries.ts.
 */
export function liveShare(runningCount: number): number {
  return runningCount > 0 ? runningCount : 1
}
