import { format, isSameDay, isSameYear, subDays } from "date-fns"

/** 12h clock ("6:31 pm") for chat; the rest of the app uses 24h. */
export function formatClockTime(value: string | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return format(date, "h:mm a")
}

/** "Today" / "Yesterday" / "5 Aug 2026". No weekday step, and the year is always shown. */
export function formatDaySeparator(value: string | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()

  if (isSameDay(date, now)) return "Today"
  if (isSameDay(date, subDays(now, 1))) return "Yesterday"
  return format(date, "d MMM yyyy")
}

export function dayKey(value: string | Date): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd")
}

/** "3:42 pm" today, "Yesterday", else "5 Aug" (year added when it differs). `withTime` adds the time. */
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
