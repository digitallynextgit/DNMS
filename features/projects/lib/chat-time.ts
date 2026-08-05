import { differenceInCalendarDays, format, isSameDay, isSameYear, subDays } from "date-fns"

/** Clock time on a bubble - the day it belongs to comes from the separator above it. */
export function formatClockTime(value: string | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  // 24h, matching formatDateTime() everywhere else in the app.
  return format(date, "HH:mm")
}

/**
 * The chip that sits between days in a conversation.
 *
 *   today            → "Today"
 *   yesterday        → "Yesterday"
 *   within the week  → "Saturday"
 *   older            → "5 Aug"  (or "5 Aug 2025" once the year differs)
 *
 * A weekday name is only useful while it is unambiguous - past six days back
 * "Saturday" could be any of several, so it becomes a date.
 */
export function formatDaySeparator(value: string | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()

  if (isSameDay(date, now)) return "Today"
  if (isSameDay(date, subDays(now, 1))) return "Yesterday"
  if (differenceInCalendarDays(now, date) < 7) return format(date, "EEEE")
  return isSameYear(date, now) ? format(date, "d MMM") : format(date, "d MMM yyyy")
}

/** Calendar-day key, for grouping messages under one separator. */
export function dayKey(value: string | Date): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd")
}

/**
 * Chat timestamps, the way every messaging app writes them.
 *
 *   today      → "3:42 pm"
 *   yesterday  → "Yesterday"
 *   older      → "5 Aug"  (or "5 Aug 2025" once the year differs)
 *
 * `formatRelativeTime` ("12 days ago") is right for an activity feed, where the
 * question is how long ago something happened. In a chat list the question is
 * WHEN, and "12 days ago" makes you do the arithmetic yourself.
 *
 * Pass `withTime` for the message bubbles: there are no day separators in the
 * thread, so an older bubble still has to say the time, not only the day.
 */
export function formatChatTime(value: string | Date, withTime = false): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const now = new Date()
  const time = format(date, "HH:mm")

  if (isSameDay(date, now)) return time
  if (isSameDay(date, subDays(now, 1))) return withTime ? `Yesterday, ${time}` : "Yesterday"

  const day = isSameYear(date, now) ? format(date, "d MMM") : format(date, "d MMM yyyy")
  return withTime ? `${day}, ${time}` : day
}
