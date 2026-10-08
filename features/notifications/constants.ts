// Shared by the client form and the server engine - NO server-only imports.

import type { ReminderPreference } from "./types"

/** Default before the employee opens settings: one warning 15 min before the booked time runs
 *  out (reminders are opt-out on purpose). */
export const DEFAULT_REMINDER_PREFERENCE: ReminderPreference = {
  enabled: true,
  leadMinutes: 15,
  reminderCount: 1,
  repeatEveryMinutes: 5,
}

/** Bounds used by both the zod schema and the inputs' min/max. Lead is capped at 8 hours (a
 *  working day), count at 10. */
export const REMINDER_LIMITS = {
  leadMinutes: { min: 1, max: 480 },
  reminderCount: { min: 1, max: 10 },
  repeatEveryMinutes: { min: 1, max: 120 },
} as const

/** Quick picks in the form, so the common case is one click rather than typing. */
export const LEAD_MINUTE_PRESETS = [5, 10, 15, 30, 60] as const
