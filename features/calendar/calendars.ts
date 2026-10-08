import { Cake, PartyPopper, type LucideIcon } from "lucide-react"

// Every calendar the page can show, in picker order. To add one: an entry here, a view in
// components/ and a line in the VIEWS map in components/company-calendar.tsx.

export interface CalendarDefinition {
  id: string
  label: string
  /** The page subtitle while this calendar is open. */
  description: string
  icon: LucideIcon
}

export const CALENDARS = [
  {
    id: "holidays",
    label: "Holiday Calendar",
    description: "Company holidays for the year, and your floating-holiday requests.",
    icon: PartyPopper,
  },
  {
    id: "birthdays",
    label: "Birthday Calendar",
    description: "Everyone's birthdays - day and month only.",
    icon: Cake,
  },
] as const satisfies readonly CalendarDefinition[]

export type CalendarId = (typeof CALENDARS)[number]["id"]

export const DEFAULT_CALENDAR: CalendarId = "holidays"

/** The calendar for a ?view= value; anything unknown falls back to the default. */
export function calendarFor(id: string | null | undefined): (typeof CALENDARS)[number] {
  return CALENDARS.find((c) => c.id === id) ?? CALENDARS[0]
}
