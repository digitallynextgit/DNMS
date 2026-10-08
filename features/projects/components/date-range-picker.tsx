"use client"

import { useState } from "react"
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

/** Holds the draft until both ends are picked, so a half-open range never fires a request. */
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

  // Re-seed on open, so it shows what's applied rather than a stale half-selection.
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevValue, setPrevValue] = useState(value)
  if (open !== prevOpen || value !== prevValue) {
    setPrevOpen(open)
    setPrevValue(value)
    if (open) {
      setDraft(
        value ? { from: parseDateString(value.from), to: parseDateString(value.to) } : undefined,
      )
    }
  }

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
            className={cn(
              // Default height (36px) lines up with the SegmentedControl / Input beside it.
              "rounded-sm px-3 font-medium",
              value && "border-primary/50 bg-muted",
              // Square off the inner edge so this and the Clear button read as one control.
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
            // No data exists after today.
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
          aria-label="Clear custom date range"
          onClick={onClear}
          className="border-primary/50 bg-muted rounded-sm rounded-l-none px-2"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
