import "server-only"

import { db } from "@/server/db"
import { DEFAULT_REMINDER_PREFERENCE } from "../constants"
import type { ReminderPreference } from "../types"

/**
 * One employee's reminder settings, falling back to the defaults when they have
 * never saved any. Callers therefore never handle null, and an employee who has
 * not touched the page is still warned.
 */
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

/**
 * The same lookup for a batch of employees, as one query - the reminder cron
 * reads a preference per running task and must not fan that into a query each.
 * Employees with no row are simply absent from the map; read through
 * `preferenceFor` below rather than indexing it directly.
 */
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
