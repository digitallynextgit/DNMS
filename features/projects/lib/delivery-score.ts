// One 0-100 delivery score for a person or a team over a period, always shown with its parts:
// goals they own (40%), deliverables made by their due day (35%) and tasks done by their due day
// (25%). A part with nothing in it is left out and the others are scaled up, so nobody is marked
// down for work they never had.

export const SCORE_WEIGHTS = { goals: 0.4, deliverables: 0.35, tasks: 0.25 } as const

export interface OnTimeCount {
  onTime: number
  due: number
}

export interface ScoreInputs {
  /** Each owned goal's achievement, 0-1 (see goalAchievement). */
  goalAchievements: number[]
  deliverables: OnTimeCount
  tasks: OnTimeCount
}

export interface DeliveryScore {
  /** Null when there is nothing to judge at all. */
  score: number | null
  goals: { score: number | null; count: number }
  deliverables: { score: number | null } & OnTimeCount
  tasks: { score: number | null } & OnTimeCount
  /** Goals + deliverables + tasks that counted - shown as "based on N items". */
  basedOn: number
}

const pct = (x: number) => Math.round(x * 100)

/** Reached ÷ what should be reached by now (the target once the period is over), capped at 1. */
export function goalAchievement(
  actual: number | null,
  target: number | null,
  pace: number | null,
): number | null {
  if (target === null || target <= 0) return null
  const expected = pace ?? target
  if (expected <= 0) return null
  return Math.min(1, Math.max(0, (actual ?? 0) / expected))
}

export function deliveryScore(i: ScoreInputs): DeliveryScore {
  const goals =
    i.goalAchievements.length > 0
      ? i.goalAchievements.reduce((s, a) => s + a, 0) / i.goalAchievements.length
      : null
  const ratio = (c: OnTimeCount) => (c.due > 0 ? Math.min(1, c.onTime / c.due) : null)
  const deliverables = ratio(i.deliverables)
  const tasks = ratio(i.tasks)

  const parts: [number | null, number][] = [
    [goals, SCORE_WEIGHTS.goals],
    [deliverables, SCORE_WEIGHTS.deliverables],
    [tasks, SCORE_WEIGHTS.tasks],
  ]
  const used = parts.filter((p): p is [number, number] => p[0] !== null)
  const weight = used.reduce((s, [, w]) => s + w, 0)
  const score = weight > 0 ? pct(used.reduce((s, [v, w]) => s + v * w, 0) / weight) : null

  return {
    score,
    goals: { score: goals === null ? null : pct(goals), count: i.goalAchievements.length },
    deliverables: { score: deliverables === null ? null : pct(deliverables), ...i.deliverables },
    tasks: { score: tasks === null ? null : pct(tasks), ...i.tasks },
    basedOn: i.goalAchievements.length + i.deliverables.due + i.tasks.due,
  }
}

const MADE = new Set(["DELIVERED", "ACCEPTED", "REJECTED"])

/**
 * A deliverable counts once its due day has passed or it is made: on time when made by that day.
 * Discarded work is no longer owed. Days are UTC midnights.
 */
export function deliverableTally(
  row: { status: string; dueOn: Date | null; completedOn: Date | null },
  today: Date,
): "on_time" | "late" | null {
  if (!row.dueOn || row.status === "DISCARDED") return null
  const made = MADE.has(row.status) && row.completedOn !== null
  if (made) return row.completedOn! <= row.dueOn ? "on_time" : "late"
  return row.dueOn < today ? "late" : null
}

/**
 * A task counts once its due day has passed or it is done: on time when done by the end of that day.
 * Discarded and held work is left out - it was dropped or parked on purpose.
 */
export function taskTally(
  row: { status: string; dueDate: Date | null; completedAt: Date | null },
  today: Date,
): "on_time" | "late" | null {
  if (!row.dueDate || ["DISCARDED", "CANCELLED", "ON_HOLD"].includes(row.status)) return null
  if (row.status === "DONE" && row.completedAt) {
    const dueEnd = new Date(row.dueDate.getTime() + 86_400_000 - 1)
    return row.completedAt <= dueEnd ? "on_time" : "late"
  }
  return row.dueDate < today ? "late" : null
}

export function addTally(c: OnTimeCount, t: "on_time" | "late" | null): void {
  if (t === null) return
  c.due++
  if (t === "on_time") c.onTime++
}
