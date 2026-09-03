"use client"

import { useState, useMemo } from "react"
import { Calendar as CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn, formatDate } from "@/lib/utils"

// Convert between the app's "yyyy-MM-dd" string and a Date for the calendar,
// staying in local time so the day never shifts across timezones.
export function parseDateString(s?: string): Date | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// =============================================================================
// Year-dropdown range
// =============================================================================
// react-day-picker's own default for a dropdown caption is:
//
//     endMonth = endOfYear(today)        // getNavMonth.js
//
// i.e. the year list STOPS AT THE CURRENT YEAR unless a caller passes endMonth.
// That silently made every future date unreachable in any field that did not
// think to pass one - a renewal expiring in 2028, leave booked for January,
// next year's holiday calendar. The field looked fine; the year simply was not
// in the list.
//
// So the range is OURS, not the library's. Callers that genuinely want a
// narrower window (attendance cannot be marked in the future, a date of birth
// cannot be next week) still pass their own and win.
const DEFAULT_START_YEAR = 1950
/** Domains and SSL certs are commonly bought 10 years out; 15 leaves headroom. */
const FUTURE_YEARS = 15

/**
 * Reusable shadcn date picker (calendar in a popover). Shared by the employee
 * create/edit form and the per-section edit modals so every date field across
 * the UI looks and behaves identically. Value is a "yyyy-MM-dd" string.
 */
export function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  startMonth,
  endMonth,
  disabled,
  modal,
  className,
}: {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  startMonth?: Date
  endMonth?: Date
  disabled?: (date: Date) => boolean
  /** Set when rendered inside a Dialog so the popover layers above it. */
  modal?: boolean
  /** Size/spacing override for the trigger, e.g. a compact filter-bar field. */
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // Computed once per mount rather than per render, so the dropdown options are
  // referentially stable while the popover is open.
  const bounds = useMemo(() => {
    const year = new Date().getFullYear()
    return {
      start: startMonth ?? new Date(DEFAULT_START_YEAR, 0),
      end: endMonth ?? new Date(year + FUTURE_YEARS, 11, 31),
    }
  }, [startMonth, endMonth])

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            // Matches Input/Select exactly (h-9, radius var) so a date field lines
            // up with the fields beside it.
            "border-input h-9 w-full justify-start rounded-sm px-3 text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={bounds.start}
          endMonth={bounds.end}
          defaultMonth={parseDateString(value)}
          selected={parseDateString(value)}
          onSelect={(date) => {
            onChange(date ? toDateString(date) : "")
            if (date) setOpen(false)
          }}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  )
}
