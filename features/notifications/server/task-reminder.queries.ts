import "server-only"

import { db } from "@/server/db"
import { DEFAULT_REMINDER_PREFERENCE } from "../constants"
import type { ReminderPreference } from "../types"

/** One employee's reminder settings, or the defaults if they never saved any. */
export async function getTaskReminderPreference(employeeId: string): Promise<ReminderPreference> {
  const row = await db.taskReminderPreference.findUnique({
    where: { employeeId },
    select: {
      enabled: true,
      leadMinutes: true,
      reminderCount: true,
      repeatEveryMinutes: true,
    },
  })
  return row ?? DEFAULT_REMINDER_PREFERENCE
}

/** Batch lookup for the cron (one query); read via `preferenceFor` - missing rows are absent. */
export async function getTaskReminderPreferences(
  employeeIds: string[],
): Promise<Map<string, ReminderPreference>> {
  if (employeeIds.length === 0) return new Map()
  const rows = await db.taskReminderPreference.findMany({
    where: { employeeId: { in: employeeIds } },
    select: {
      employeeId: true,
      enabled: true,
      leadMinutes: true,
      reminderCount: true,
      repeatEveryMinutes: true,
    },
  })
  return new Map(
    rows.map(({ employeeId, ...pref }) => [employeeId, pref satisfies ReminderPreference]),
  )
}

/** Read from the batch map with the defaults standing in for a missing row. */
export function preferenceFor(
  prefs: Map<string, ReminderPreference>,
  employeeId: string,
): ReminderPreference {
  return prefs.get(employeeId) ?? DEFAULT_REMINDER_PREFERENCE
}
