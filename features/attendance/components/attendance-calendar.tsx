"use client"

import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CalendarLegend, type CalendarLegendItem } from "@/components/shared/calendar-legend"
import { StatusBadge } from "@/components/shared/status-badge"
import { cn, formatWorkHours } from "@/lib/utils"
import type { CalendarDay, CalendarDayStatus } from "@/features/attendance/hooks/use-attendance"

// Reuses the calendar's own colour language rather than the app-wide attendance
// map: this grid has statuses (MISSING_PUNCH, WFH, UPCOMING) the log table does
// not, and the badge should match the cell the user just tapped.
const STATUS_LABEL: Record<CalendarDayStatus, string> = {
  PRESENT: "Present",
  HALF_DAY: "Half day",
  MISSING_PUNCH: "Missing punch",
  LEAVE: "Leave",
  WFH: "Work from home",
  HOLIDAY: "Holiday",
  WEEKEND: "Weekend",
  UPCOMING: "Upcoming",
  NONE: "No record",
}

const STATUS_TONE: Record<CalendarDayStatus, string> = {
  PRESENT: "bg-green-500/10 text-green-600 dark:text-green-400",
  HALF_DAY: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  MISSING_PUNCH: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  LEAVE: "bg-red-500/10 text-red-600 dark:text-red-400",
  WFH: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  HOLIDAY: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  WEEKEND: "bg-muted text-muted-foreground",
  UPCOMING: "bg-muted text-muted-foreground",
  NONE: "bg-muted text-muted-foreground",
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// Status → cell fill. Office colour key: present=green, half=orange, leave=red,
// WFH=yellow, single-punch=purple, holiday=blue, weekend=grey.
function cellStyle(status: CalendarDayStatus): string {
  switch (status) {
    case "PRESENT":
      return "bg-green-100 text-green-900 ring-1 ring-green-200 dark:bg-green-950/40 dark:text-green-200 dark:ring-green-900/50"
    case "HALF_DAY":
      return "bg-orange-100 text-orange-900 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900/50"
    case "MISSING_PUNCH":
      return "bg-purple-100 text-purple-900 ring-1 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:ring-purple-900/50"
    case "LEAVE":
      return "bg-red-100 text-red-900 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/50"
    case "WFH":
      return "bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:ring-yellow-900/50"
    case "HOLIDAY":
      return "bg-blue-100 text-blue-900 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/50"
    case "WEEKEND":
      return "bg-muted text-muted-foreground"
    default: // UPCOMING / NONE
      return "text-muted-foreground border border-dashed"
  }
}

function fmtTime(t: string | null): string {
  if (!t) return "--:--"
  // Always render in IST (the device/office timezone), independent of the
  // viewer's browser timezone.
  return new Date(t).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  })
}

const LEGEND: CalendarLegendItem[] = [
  { swatch: "bg-green-100 dark:bg-green-950/40", label: "Present" },
  { swatch: "bg-orange-100 dark:bg-orange-950/40", label: "Half day" },
  { swatch: "bg-purple-100 dark:bg-purple-950/40", label: "Missing punch" },
  { swatch: "bg-red-100 dark:bg-red-950/40", label: "Leave" },
  { swatch: "bg-yellow-100 dark:bg-yellow-950/40", label: "Work from home" },
  { swatch: "bg-blue-100 dark:bg-blue-950/40", label: "Holiday" },
  { swatch: "bg-muted", label: "Weekend" },
]

function DayCell({ d, onSelect }: { d: CalendarDay; onSelect: (d: CalendarDay) => void }) {
  const showTimes =
    d.status === "PRESENT" || d.status === "HALF_DAY" || d.status === "MISSING_PUNCH"
  const showHours = (d.status === "PRESENT" || d.status === "HALF_DAY") && d.workHours != null
  const showLabel =
    d.label && (d.status === "HOLIDAY" || d.status === "LEAVE" || d.status === "WFH")
  return (
    // Below `sm` a cell is only ~33px wide (a 320px screen / 7 columns), which
    // cannot hold "09:32" let alone "Missing punch" - so the phone cell carries
    // just the day number and leans on the status colour, and the punch detail
    // returns from `sm` up. The native title tooltip keeps it reachable.
    <button
      type="button"
      onClick={() => onSelect(d)}
      title={d.label ?? d.status}
      aria-label={`${d.day} - ${STATUS_LABEL[d.status]}. View details`}
      className={cn(
        "flex aspect-square w-full flex-col items-center justify-center rounded-sm p-1 text-center transition-shadow hover:ring-2 hover:ring-inset focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:aspect-auto sm:min-h-19 sm:items-stretch sm:justify-start sm:p-1.5 sm:text-left",
        cellStyle(d.status),
      )}
    >
      <div className="flex w-full items-start justify-center gap-1 sm:justify-between">
        <span className="text-xs font-semibold">{d.day}</span>
        {showHours && (
          <span className="hidden text-[10px] font-semibold tabular-nums sm:inline">
            {formatWorkHours(d.workHours!)}
          </span>
        )}
        {d.status === "MISSING_PUNCH" && (
          <span className="hidden text-[9px] font-semibold sm:inline">Missing punch</span>
        )}
      </div>
      {showTimes ? (
        <span className="mt-auto hidden text-[10px] leading-tight tabular-nums sm:inline">
          {fmtTime(d.checkIn)}
          <br />
          {fmtTime(d.checkOut)}
        </span>
      ) : showLabel ? (
        <span className="mt-auto line-clamp-2 hidden text-[9px] leading-tight sm:inline">
          {d.label}
        </span>
      ) : null}
    </button>
  )
}

/**
 * The day detail a phone cell has no room for. Tapping any day opens it, so the
 * punch times and hours the narrow grid hides are one tap away rather than lost.
 */
function DayDetailDialog({ day, onClose }: { day: CalendarDay | null; onClose: () => void }) {
  const heading = day
    ? new Date(day.date).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : ""

  const rows: [string, string][] = day
    ? [
        ["Check in", fmtTime(day.checkIn)],
        ["Check out", fmtTime(day.checkOut)],
        ["Work hours", day.workHours != null ? formatWorkHours(day.workHours) : "-"],
      ]
    : []

  return (
    <Dialog open={!!day} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{heading}</DialogTitle>
          {day?.label && <DialogDescription className="text-xs">{day.label}</DialogDescription>}
        </DialogHeader>

        {day && (
          <div className="space-y-4">
            <StatusBadge
              status={day.status}
              colorMap={STATUS_TONE}
              labelMap={STATUS_LABEL}
              size="sm"
            />

            {/* Punch detail only means something on a day that had (or should
                have had) punches - a weekend or holiday row of dashes is noise. */}
            {(day.status === "PRESENT" ||
              day.status === "HALF_DAY" ||
              day.status === "MISSING_PUNCH") && (
              <dl className="divide-border divide-y">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                    <dd className="text-sm font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {day.status === "MISSING_PUNCH" && (
              <p className="text-muted-foreground text-xs">
                One punch is missing for this day. Raise a regularization request if this looks
                wrong.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Presentational month grid. The page owns the selected month + navigation. */
export function AttendanceCalendar({ days }: { days: CalendarDay[] }) {
  const firstDow = days[0]?.dow ?? 0
  const [selected, setSelected] = useState<CalendarDay | null>(null)
  return (
    <div className="bg-card rounded-sm border p-2 sm:p-4">
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-muted-foreground py-1 text-center text-[10px] font-medium sm:text-xs"
          >
            {w}
          </div>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((d) => (
          <DayCell key={d.date} d={d} onSelect={setSelected} />
        ))}
      </div>

      <DayDetailDialog day={selected} onClose={() => setSelected(null)} />

      <CalendarLegend items={LEGEND} />
    </div>
  )
}
