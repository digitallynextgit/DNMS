/** An employee's answer to "warn me when, and how often". */
export interface ReminderPreference {
  enabled: boolean
  /** Minutes before the booked time runs out that the first reminder fires. */
  leadMinutes: number
  /** Total reminders one run of a task may produce, the first included. */
  reminderCount: number
  /** Gap between consecutive reminders. */
  repeatEveryMinutes: number
}

/** The clock state of a task that is running right now. */
export interface RunningTaskTiming {
  /** Hours booked for the task. */
  estimatedHours: number
  /** Hours already banked from earlier IN_PROGRESS stretches. */
  loggedHours: number
  /** Start of the current stretch. */
  inProgressSince: Date
}
