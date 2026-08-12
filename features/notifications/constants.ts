// Shared by the client form and the server engine - NO server-only imports.

import type { ReminderPreference } from "./types"

/**
 * What an employee gets before they have ever opened the settings: one warning,
 * a quarter of an hour before the time booked for the task runs out. Reminders
 * are opt-OUT on purpose - a deadline nobody is told about is the problem this
 * feature exists to solve.
 */
export const DEFAULT_REMINDER_PREFERENCE: ReminderPreference = {
  enabled: true,
  leadMinutes: 15,
  reminderCount: 1,
  repeatEveryMinutes: 5,
}

/**
 * Bounds for the three numbers. Enforced by the zod schema (so the API cannot be
 * talked past the form) and reused as the input min/max, so the field and the
 * validator can never disagree.
 *
 * The lead cap is 8 hours: past a full working day the warning stops being about
 * this task. The count cap is 10 because a reminder that arrives eleven times is
 * noise the employee will turn off entirely.
 */
export const REMINDER_LIMITS = {
  leadMinutes: { min: 1, max: 480 },
  reminderCount: { min: 1, max: 10 },
  repeatEveryMinutes: { min: 1, max: 120 },
} as const

/** Quick picks in the form, so the common case is one click rather than typing. */
export const LEAD_MINUTE_PRESETS = [5, 10, 15, 30, 60] as const
