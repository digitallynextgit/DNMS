import type { ReminderPreference, RunningTaskTiming } from "../types"

// Pure reminder date maths, shared by the cron and the settings preview so they always agree.

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000

/** When the booked hours run out for the current stretch: inProgressSince + (estimated - logged).
 *  Already over budget gives a past deadline, so all reminders collapse into one "over" warning. */
export function budgetDeadline(task: RunningTaskTiming): Date {
  const remainingHours = task.estimatedHours - task.loggedHours
  return new Date(task.inProgressSince.getTime() + remainingHours * MS_PER_HOUR)
}

/** When reminders fire, earliest first: `leadMinutes` before the deadline, then every
 *  `repeatEveryMinutes` (may run past the deadline, i.e. "over by N minutes"). */
export function reminderTimes(deadline: Date, pref: ReminderPreference): Date[] {
  const count = Math.max(0, Math.trunc(pref.reminderCount))
  const times: Date[] = []
  for (let i = 0; i < count; i++) {
    const minutesBefore = pref.leadMinutes - i * pref.repeatEveryMinutes
    times.push(new Date(deadline.getTime() - minutesBefore * MS_PER_MINUTE))
  }
  return times
}

/** The schedule as minutes before the deadline (15, 10, 5 for lead 15 / count 3 / every 5);
 *  negative = after. */
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

/** How many of `times` are due by `now` (compared with what was already sent). */
export function dueReminderCount(times: Date[], now: Date): number {
  let due = 0
  for (const t of times) {
    if (t.getTime() <= now.getTime()) due++
  }
  return due
}

/** Minutes to the deadline (negative = overrun), rounded to the nearest minute. */
export function minutesUntil(deadline: Date, now: Date): number {
  return Math.round((deadline.getTime() - now.getTime()) / MS_PER_MINUTE)
}

export function reminderMessage(taskTitle: string, minutesLeft: number): string {
  const quoted = `"${taskTitle}"`
  if (minutesLeft > 0) {
    return `${formatMinutes(minutesLeft)} left of the time booked for ${quoted}.`
  }
  if (minutesLeft === 0) return `The time booked for ${quoted} is up.`
  return `${quoted} is ${formatMinutes(-minutesLeft)} over the time booked for it.`
}

/** Minutes as a readable duration ("14 hours 35 minutes", not "875 minutes"). */
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
