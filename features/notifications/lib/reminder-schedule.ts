import type { ReminderPreference, RunningTaskTiming } from "../types"

// =============================================================================
// When a task's booked time runs out, and when to warn about it.
//
// Pure date maths, no DB and no server-only imports: the cron uses it to decide
// what to send, and the settings form uses it to show the employee exactly which
// warnings their numbers produce. One implementation, so the preview cannot
// promise something the engine does not do.
// =============================================================================

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000

/**
 * The moment the hours booked for a task run out, for the stretch it is in now.
 *
 * Measured from `inProgressSince` rather than the task's due date on purpose:
 * `dueDate` is a calendar day (@db.Date) and says nothing about a one-hour job,
 * whereas the clock DNMS already runs on a started task does. Time banked by
 * earlier stretches is subtracted, so a task booked for 2h that has already used
 * 1h30m gets its warning half an hour into the next stretch, not two hours in.
 *
 * Already over budget (`loggedHours` >= `estimatedHours`) yields a deadline in
 * the past, which is correct: every reminder is due at once, and the caller's
 * "send only the latest" rule collapses them into a single "over the estimate"
 * warning rather than a burst.
 */
export function budgetDeadline(task: RunningTaskTiming): Date {
  const remainingHours = task.estimatedHours - task.loggedHours
  return new Date(task.inProgressSince.getTime() + remainingHours * MS_PER_HOUR)
}

/**
 * The absolute times this employee's reminders are meant to fire, earliest
 * first. The first lands `leadMinutes` before the deadline and each next one
 * `repeatEveryMinutes` later, so lead 15 / count 3 / every 5 gives 15, 10 and 5
 * minutes out. A schedule that runs past the deadline is allowed and reads as
 * "over the estimate by N minutes" - being told you have overrun is the point.
 */
export function reminderTimes(deadline: Date, pref: ReminderPreference): Date[] {
  const count = Math.max(0, Math.trunc(pref.reminderCount))
  const times: Date[] = []
  for (let i = 0; i < count; i++) {
    const minutesBefore = pref.leadMinutes - i * pref.repeatEveryMinutes
    times.push(new Date(deadline.getTime() - minutesBefore * MS_PER_MINUTE))
  }
  return times
}

/**
 * The schedule as minutes BEFORE the deadline, earliest first - 15, 10, 5 for
 * lead 15 / count 3 / every 5. Negative means after it. Independent of any one
 * task, so the settings form can show an employee what their numbers do before
 * a single reminder has been sent.
 */
export function reminderOffsets(pref: ReminderPreference): number[] {
  const count = Math.max(0, Math.trunc(pref.reminderCount))
  return Array.from({ length: count }, (_, i) => pref.leadMinutes - i * pref.repeatEveryMinutes)
}

/** One offset as a phrase: "15 min before", "right on time", "5 min after". */
export function describeOffset(minutesBefore: number): string {
  if (minutesBefore > 0) return `${minutesBefore} min before`
  if (minutesBefore === 0) return "right on time"
  return `${Math.abs(minutesBefore)} min after`
}

/**
 * How many of `times` have come due by `now`. Compared against what has already
 * been sent, the difference is what the run owes; a cron that missed an hour
 * therefore catches up instead of replaying the whole schedule.
 */
export function dueReminderCount(times: Date[], now: Date): number {
  let due = 0
  for (const t of times) {
    if (t.getTime() <= now.getTime()) due++
  }
  return due
}

/**
 * Minutes between now and the deadline: positive means time left, negative
 * means the estimate is already overrun. Rounded to the nearest minute so the
 * message reads "15 minutes left", not "14.7".
 */
export function minutesUntil(deadline: Date, now: Date): number {
  return Math.round((deadline.getTime() - now.getTime()) / MS_PER_MINUTE)
}

/**
 * The one-line body of the reminder. Both halves are worth writing: before the
 * deadline it is a nudge, after it the employee is over their own estimate and
 * the task's hours need either finishing or re-estimating.
 */
export function reminderMessage(taskTitle: string, minutesLeft: number): string {
  const quoted = `"${taskTitle}"`
  if (minutesLeft > 0) {
    return `${formatMinutes(minutesLeft)} left of the time booked for ${quoted}.`
  }
  if (minutesLeft === 0) return `The time booked for ${quoted} is up.`
  return `${quoted} is ${formatMinutes(-minutesLeft)} over the time booked for it.`
}

/**
 * A minute count as something a person would say. Bare minutes stop reading as a
 * duration somewhere past an hour, and a task left In Progress overnight is
 * exactly the case that most needs the reminder - "14 hours 35 minutes over"
 * lands, "875 minutes over" does not.
 */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  if (minutes < 60) return `${minutes} ${plural(minutes, "minute")}`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) {
    return rest === 0
      ? `${hours} ${plural(hours, "hour")}`
      : `${hours} ${plural(hours, "hour")} ${rest} ${plural(rest, "minute")}`
  }

  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours === 0
    ? `${days} ${plural(days, "day")}`
    : `${days} ${plural(days, "day")} ${restHours} ${plural(restHours, "hour")}`
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`
}
