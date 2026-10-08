"use client"

import type { ComponentType } from "react"
import { PageHeader } from "@/components/shared/page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUrlState } from "@/hooks/use-url-state"
import { CALENDARS, DEFAULT_CALENDAR, calendarFor, type CalendarId } from "../calendars"
import { HolidaysCalendarView } from "./holidays-calendar-view"
import { HolidaysAdminView } from "./holidays-admin-view"
import { BirthdaysCalendarView } from "./birthdays-calendar-view"

// Which calendars exist lives in ../calendars.ts; this map only says what draws each one.
const VIEWS: Record<CalendarId, ComponentType> = {
  holidays: HolidaysCalendarView,
  birthdays: BirthdaysCalendarView,
}

/** A calendar drawn differently on one page - e.g. HR's manageable holidays. */
type ViewOverrides = Partial<Record<CalendarId, { view: ComponentType; description?: string }>>

export function CompanyCalendar({ overrides }: { overrides?: ViewOverrides } = {}) {
  const [view, setView] = useUrlState("view", DEFAULT_CALENDAR)
  const calendar = calendarFor(view)
  const override = overrides?.[calendar.id]
  const View = override?.view ?? VIEWS[calendar.id]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description={override?.description ?? calendar.description}
        actions={
          <Select value={calendar.id} onValueChange={setView}>
            <SelectTrigger className="w-56" aria-label="Which calendar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CALENDARS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <c.icon className="h-4 w-4" />
                    {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {/* Keyed: switching calendars starts the other one fresh (its own year/month). */}
      <View key={calendar.id} />
    </div>
  )
}

const HR_OVERRIDES: ViewOverrides = {
  holidays: {
    view: HolidaysAdminView,
    description: "Manage company holidays and optional days off, and approve floating requests.",
  },
}

/** HR version: the Holiday Calendar in its manageable form; every other calendar as employees see it. */
export function HrCalendar() {
  return <CompanyCalendar overrides={HR_OVERRIDES} />
}
