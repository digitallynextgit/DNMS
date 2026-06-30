"use client"

import { cn, formatWorkHours } from "@/lib/utils"
import type { CalendarDay, CalendarDayStatus } from "@/features/attendance/hooks/use-attendance"

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
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm", className)} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

function DayCell({ d }: { d: CalendarDay }) {
  const showTimes =
    d.status === "PRESENT" || d.status === "HALF_DAY" || d.status === "MISSING_PUNCH"
  const showHours = (d.status === "PRESENT" || d.status === "HALF_DAY") && d.workHours != null
  const showLabel =
    d.label && (d.status === "HOLIDAY" || d.status === "LEAVE" || d.status === "WFH")
  return (
    <div
      title={d.label ?? d.status}
      className={cn("flex min-h-[76px] flex-col rounded-md p-1.5 text-left", cellStyle(d.status))}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-semibold">{d.day}</span>
        {showHours && (
          <span className="text-[10px] font-semibold tabular-nums">
            {formatWorkHours(d.workHours!)}
          </span>
        )}
        {d.status === "MISSING_PUNCH" && (
          <span className="text-[9px] font-semibold">Missing punch</span>
        )}
      </div>
      {showTimes ? (
        <span className="mt-auto text-[10px] leading-tight tabular-nums">
          {fmtTime(d.checkIn)}
          <br />
          {fmtTime(d.checkOut)}
        </span>
      ) : showLabel ? (
        <span className="mt-auto line-clamp-2 text-[9px] leading-tight">{d.label}</span>
      ) : null}
    </div>
  )
}

/** Presentational month grid. The page owns the selected month + navigation. */
export function AttendanceCalendar({ days }: { days: CalendarDay[] }) {
  const firstDow = days[0]?.dow ?? 0
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-muted-foreground py-1 text-center text-xs font-medium">
            {w}
          </div>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((d) => (
          <DayCell key={d.date} d={d} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
        <LegendItem className="bg-green-100 dark:bg-green-950/40" label="Present" />
        <LegendItem className="bg-orange-100 dark:bg-orange-950/40" label="Half day" />
        <LegendItem className="bg-purple-100 dark:bg-purple-950/40" label="Missing punch" />
        <LegendItem className="bg-red-100 dark:bg-red-950/40" label="Leave" />
        <LegendItem className="bg-yellow-100 dark:bg-yellow-950/40" label="Work from home" />
        <LegendItem className="bg-blue-100 dark:bg-blue-950/40" label="Holiday" />
        <LegendItem className="bg-muted" label="Weekend" />
      </div>
    </div>
  )
}
