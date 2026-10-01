// =============================================================================
// Hours a person actually spent on each task, per IST working day.
//
// The source is the task clock's IN_PROGRESS periods (TaskStatusPeriod), not
// ProjectTask.loggedHours: loggedHours is a lifetime total with no day attached,
// and between 19 Aug and 21 Sep 2026 it was banked as a 1/N share of parallel
// clocks, so it cannot be split back into days. The periods can.
//
// Three rules turn raw periods into hours somebody would sign off on:
//   1. Only office time counts: a period is clipped to that day's attendance
//      window (check-in to check-out), or 09:30-19:30 IST with no usable punch.
//   2. A clock left running past the day it started (or still running) means the
//      status was never moved on when the work stopped. It counts on its start
//      day only, and for no longer than the task's estimate.
//   3. Two tasks running at once share the time between them, so a person's day
//      can never add up to more than the hours they were there.
// Days that are not working days for the person (weekends, holidays, full-day
// leave) are skipped entirely - the caller decides which days those are.
// =============================================================================

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const MS_PER_HOUR = 3_600_000
/** A check-out this close to the check-in is a double tap, not a day's work. */
const MIN_PUNCH_SPAN_MS = MS_PER_HOUR

/** "YYYY-MM-DD" of the IST calendar day an instant falls on. */
export function istDayKey(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** The instant of hh:mm IST on an IST calendar day ("YYYY-MM-DD"). */
export function istInstant(day: string, hours: number, minutes = 0): Date {
  return new Date(
    Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS + (hours * 60 + minutes) * 60_000,
  )
}

export interface DayWindow {
  start: Date
  end: Date
}

/** Office hours assumed when there is no usable attendance punch. */
export function defaultWindow(day: string): DayWindow {
  return { start: istInstant(day, 9, 30), end: istInstant(day, 19, 30) }
}

/**
 * The stretch of a day that counts. Both punches -> exactly that stretch. A
 * single punch (or a check-out within an hour of the check-in) keeps the punch
 * we trust and falls back to 19:30 for the end.
 */
export function attendanceWindow(
  day: string,
  log: { checkIn: Date | null; checkOut: Date | null } | undefined,
): DayWindow {
  const fallback = defaultWindow(day)
  if (!log?.checkIn) return fallback
  const { checkIn, checkOut } = log
  if (checkOut && checkOut.getTime() - checkIn.getTime() > MIN_PUNCH_SPAN_MS) {
    return { start: checkIn, end: checkOut }
  }
  return { start: checkIn, end: fallback.end }
}

export interface ClockPeriod {
  taskId: string
  startedAt: Date
  /** null = the clock is still running. */
  endedAt: Date | null
}

export interface CappedPeriod {
  taskId: string
  day: string
  /** How long the clock was actually left running, in hours. */
  leftRunningHours: number
  /** What the report counts for it instead, before any overlap split. */
  countedHours: number
}

export interface TaskHoursInput {
  periods: ClockPeriod[]
  /** Estimated hours per task id; missing or 0 = no estimate to cap at. */
  estimates: Map<string, number | null>
  /** IST day keys that count. Periods starting on any other day are ignored. */
  workingDays: Set<string>
  /** Attendance window per IST day; days without one use `defaultWindow`. */
  windows: Map<string, DayWindow>
  /** "Now", for clocks that are still running. */
  now: Date
}

export interface TaskHoursResult {
  /** day -> taskId -> hours (after the overlap split). */
  byDay: Map<string, Map<string, number>>
  capped: CappedPeriod[]
}

interface Interval {
  start: number
  end: number
  key: string
}

/** Hours per key over a set of intervals, splitting overlapping time evenly. */
export function splitOverlaps(intervals: Interval[]): Map<string, number> {
  const out = new Map<string, number>()
  const points = Array.from(new Set(intervals.flatMap((i) => [i.start, i.end]))).sort(
    (a, b) => a - b,
  )
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const live = intervals.filter((iv) => iv.start <= a && iv.end >= b)
    if (live.length === 0) continue
    const share = (b - a) / MS_PER_HOUR / live.length
    for (const iv of live) out.set(iv.key, (out.get(iv.key) ?? 0) + share)
  }
  return out
}

export function computeTaskHours(input: TaskHoursInput): TaskHoursResult {
  const perDay = new Map<string, Interval[]>()
  const capped: CappedPeriod[] = []

  for (const p of input.periods) {
    const day = istDayKey(p.startedAt)
    if (!input.workingDays.has(day)) continue
    const window = input.windows.get(day) ?? defaultWindow(day)

    let end = p.endedAt ?? input.now
    const forgotten = p.endedAt === null || istDayKey(p.endedAt) !== day
    if (forgotten) {
      let capEnd = window.end
      const estimate = input.estimates.get(p.taskId)
      if (estimate && estimate > 0) {
        capEnd = new Date(
          Math.min(capEnd.getTime(), p.startedAt.getTime() + estimate * MS_PER_HOUR),
        )
      }
      const counted = Math.max(
        0,
        Math.min(capEnd.getTime(), window.end.getTime()) -
          Math.max(p.startedAt.getTime(), window.start.getTime()),
      )
      capped.push({
        taskId: p.taskId,
        day,
        leftRunningHours: round1((end.getTime() - p.startedAt.getTime()) / MS_PER_HOUR),
        countedHours: round1(counted / MS_PER_HOUR),
      })
      end = capEnd
    }

    const start = Math.max(p.startedAt.getTime(), window.start.getTime())
    const stop = Math.min(end.getTime(), window.end.getTime())
    if (start >= stop) continue
    const list = perDay.get(day) ?? []
    list.push({ start, end: stop, key: p.taskId })
    perDay.set(day, list)
  }

  const byDay = new Map<string, Map<string, number>>()
  for (const [day, intervals] of perDay) byDay.set(day, splitOverlaps(intervals))
  return { byDay, capped }
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
