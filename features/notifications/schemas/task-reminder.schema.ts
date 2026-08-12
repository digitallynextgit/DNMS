import { z } from "zod"
import { REMINDER_LIMITS } from "../constants"

const { leadMinutes, reminderCount, repeatEveryMinutes } = REMINDER_LIMITS

/**
 * The whole preference. Every field is required: the form always submits all
 * four, and a partial update would make "how often" ambiguous against the value
 * already stored.
 */
export const taskReminderPreferenceSchema = z.object({
  enabled: z.boolean(),
  leadMinutes: z
    .number()
    .int("Use whole minutes.")
    .min(leadMinutes.min, `Warn me at least ${leadMinutes.min} minute before.`)
    .max(leadMinutes.max, `${leadMinutes.max} minutes (8 hours) is the longest warning.`),
  reminderCount: z
    .number()
    .int("Use a whole number of reminders.")
    .min(reminderCount.min, "At least one reminder.")
    .max(reminderCount.max, `${reminderCount.max} reminders is the most per task.`),
  repeatEveryMinutes: z
    .number()
    .int("Use whole minutes.")
    .min(repeatEveryMinutes.min, "Reminders must be at least a minute apart.")
    .max(repeatEveryMinutes.max, `${repeatEveryMinutes.max} minutes is the longest gap.`),
})

export type TaskReminderPreferenceInput = z.infer<typeof taskReminderPreferenceSchema>
