import { format, isSameDay, isSameYear, subDays } from "date-fns"

/**
 * Clock time on a bubble - the day it belongs to comes from the separator above.
 *
 * 12h ("6:31 pm"), which is what personal Chat has always shown. The rest of the
 * app writes 24h via formatDateTime(), but a conversation is not a report: this
 * is the one surface where the reading matches how people say the time out loud,
 * and both message surfaces now agree on it.
 */
export function formatClockTime(value: string | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return format(date, "h:mm a")
}

/**
 * The chip that sits between days in a conversation.
 *
 *   today      → "Today"
 *   yesterday  → "Yesterday"
 *   older      → "5 Aug 2026"
 *
 * Personal Chat's rule, now used by both message surfaces. Two deliberate
 * choices:
 *
 *   - No "Saturday" step. A weekday reads as recent, so seeing one on a chip you
 *     have scrolled a long way back to is more confusing than a plain date.
 *   - The year is ALWAYS written, not only when it differs from this one. A
 *     conversation is scrolled through, not dated at a glance: by the time you
 *     are looking at a separator you have usually lost track of which year you
 *     are in, and "5 Aug" alone makes you work it out.
 */
export function formatDaySeparator(value: string | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()

  if (isSameDay(date, now)) return "Today"
  if (isSameDay(date, subDays(now, 1))) return "Yesterday"
  return format(date, "d MMM yyyy")
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
