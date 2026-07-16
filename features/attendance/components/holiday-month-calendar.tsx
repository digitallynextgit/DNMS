"use client"

import { Check } from "lucide-react"
import { MonthNav } from "@/components/shared/month-nav"
import { CalendarLegend, type CalendarLegendItem } from "@/components/shared/calendar-legend"
import { cn } from "@/lib/utils"

// =============================================================================
// The ONE month-grid holiday calendar. Used by both the employee Holiday
// Calendar and the HR Holidays page - don't hand-roll another grid.
// =============================================================================

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const pad = (n: number) => String(n).padStart(2, "0")

export interface CalendarHoliday {
  id: string
  name: string
  date: string // ISO; only the first 10 chars are used
  isOptional: boolean
}

interface Props {
  year: number
  /** 0-11 */
  month: number
  onPrevMonth: () => void
  onNextMonth: () => void
  holidays: CalendarHoliday[]
  /** Holiday ids this employee has an APPROVED floating selection for. */
  approvedFloatingIds?: Set<string>
  /** Employee birthdays (a paid day off for that person). */
  birthdays?: { date: string; name: string }[]
  className?: string
}

export function HolidayMonthCalendar({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  holidays,
  approvedFloatingIds,
  birthdays,
  className,
}: Props) {
  const holidayByDay = new Map(holidays.map((h) => [h.date.slice(0, 10), h]))

  const birthdaysByDay = new Map<string, string[]>()
  for (const b of birthdays ?? []) {
    const arr = birthdaysByDay.get(b.date)
    if (arr) arr.push(b.name)
    else birthdaysByDay.set(b.date, [b.name])
  }

  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const legend: CalendarLegendItem[] = [
    { swatch: "bg-blue-100 dark:bg-blue-950/40", label: "Public holiday" },
    { swatch: "bg-amber-100 dark:bg-amber-950/40", label: "Floating holiday" },
    ...(birthdays && birthdays.length > 0
      ? [{ swatch: "bg-rose-100 dark:bg-rose-950/40", label: "Birthday" }]
      : []),
  ]

  return (
    <div className={cn("space-y-4", className)}>
      <MonthNav year={year} month={month} onPrev={onPrevMonth} onNext={onNextMonth} />

      <div className="bg-card rounded border p-4">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-muted-foreground py-1 text-center text-xs font-medium">
              {w}
            </div>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
            const h = holidayByDay.get(dateStr)
            const bdayNames = birthdaysByDay.get(dateStr)
            const isBirthday = !!bdayNames?.length
            const bdayLabel = bdayNames
              ? bdayNames.length === 1
                ? `🎂 ${bdayNames[0].split(" ")[0]}`
                : `🎂 ${bdayNames.length} birthdays`
              : ""
            const dow = new Date(Date.UTC(year, month, day)).getUTCDay()
            const weekend = dow === 0 || dow === 6
            // A floating holiday this employee applied for and HR approved is a
            // confirmed day off - show it with a tick, distinct from an
            // un-availed floating option.
            const approved = !!h && h.isOptional && !!approvedFloatingIds?.has(h.id)

            return (
              <div
                key={day}
                title={
                  isBirthday
                    ? `Birthday: ${bdayNames!.join(", ")}`
                    : h
                      ? `${h.name}${approved ? " - approved floating holiday" : h.isOptional ? " (Floating)" : ""}`
                      : undefined
                }
                className={cn(
                  "flex min-h-19 flex-col rounded p-1.5 text-left",
                  isBirthday
                    ? "bg-rose-100 text-rose-900 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200"
                    : h
                      ? h.isOptional
                        ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200"
                        : "bg-blue-100 text-blue-900 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200"
                      : weekend
                        ? "bg-muted text-muted-foreground"
                        : "border-border border",
                )}
              >
                <span className="flex items-center gap-1 text-xs font-semibold">
                  {day}
                  {approved && <Check className="h-3 w-3" />}
                </span>
                {(isBirthday || h) && (
                  <span className="mt-auto line-clamp-2 text-[10px] leading-tight font-medium">
                    {isBirthday ? bdayLabel : h?.name}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <CalendarLegend items={legend}>
          {approvedFloatingIds && (
            <span className="flex items-center gap-1.5">
              <Check className="h-3 w-3" />
              <span className="text-muted-foreground">Approved floating holiday</span>
            </span>
          )}
        </CalendarLegend>
      </div>
    </div>
  )
}
