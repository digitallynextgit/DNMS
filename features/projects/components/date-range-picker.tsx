"use client"

import { useEffect, useState } from "react"
import { CalendarDays, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { parseDateString, toDateString } from "@/components/shared/date-field"
import { cn } from "@/lib/utils"

/** An inclusive span of calendar days, as the "yyyy-MM-dd" the API expects. */
export interface DayRange {
  from: string
  to: string
}

const MONTH_DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" })
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** "15 Jun - 15 Jul", with the year shown only when the span crosses one. */
function formatRange(range: DayRange): string {
  const from = parseDateString(range.from)
  const to = parseDateString(range.to)
  if (!from || !to) return "Custom"
  const sameYear = from.getFullYear() === to.getFullYear()
  const fmt = sameYear ? MONTH_DAY : MONTH_DAY_YEAR
  return `${fmt.format(from)} - ${MONTH_DAY_YEAR.format(to)}`
}

/**
 * Calendar range filter (shadcn Calendar in a Popover).
 *
 * Picking a range takes two clicks, and react-day-picker reports the first one
 * as a half-open range. Applying that immediately would fire a request for
 * "one day" every time somebody starts a selection, so the draft is held here
 * and only handed up once BOTH ends exist.
 */
export function DateRangePicker({
  value,
  onChange,
  onClear,
  className,
}: {
  value?: DayRange
  onChange: (range: DayRange) => void
  onClear?: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()

  // Re-seed the draft whenever the popover opens, so re-opening shows what is
  // currently applied rather than a half-finished selection from last time.
  useEffect(() => {
    if (!open) return
    setDraft(
      value ? { from: parseDateString(value.from), to: parseDateString(value.to) } : undefined,
    )
  }, [open, value])

  const handleSelect = (next: DateRange | undefined) => {
    setDraft(next)
    if (next?.from && next.to) {
      onChange({ from: toDateString(next.from), to: toDateString(next.to) })
      setOpen(false)
    }
  }

  return (
    <div className={cn("inline-flex items-center", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-auto rounded-[2px] px-2.5 py-1 text-xs font-medium",
              value && "border-primary/50 bg-muted",
              // Square off the inner edge so the button and the Clear control
              // next to it read as one control, not two.
              value && onClear && "rounded-r-none border-r-0",
            )}
          >
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
            {value ? formatRange(value) : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={parseDateString(value?.from) ?? new Date()}
            selected={draft}
            onSelect={handleSelect}
            // There is no data after today, so offering those days would only
            // ever return an empty chart.
            disabled={{ after: new Date() }}
            autoFocus
          />
          <div className="text-muted-foreground border-t px-3 py-2 text-xs">
            {draft?.from && !draft.to ? "Now pick the end date" : "Pick a start and end date"}
          </div>
        </PopoverContent>
      </Popover>

      {value && onClear && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Clear custom date range"
          onClick={onClear}
          className="border-primary/50 bg-muted h-auto rounded-[2px] rounded-l-none px-1.5 py-1"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
