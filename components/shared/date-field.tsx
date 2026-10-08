"use client"

import { useState, useMemo } from "react"
import { Calendar as CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn, formatDate } from "@/lib/utils"

// "yyyy-MM-dd" <-> Date in local time, so the day never shifts across timezones.
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

// react-day-picker's year dropdown stops at the current year by default, hiding every future date.
// So the range is ours; callers needing a narrower one still pass their own.
const DEFAULT_START_YEAR = 1950
/** Domains and SSL certs are commonly bought 10 years out; 15 leaves headroom. */
const FUTURE_YEARS = 15

/** Shared date picker. Value is a "yyyy-MM-dd" string. */
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
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // Once per mount, so the dropdown options stay stable while open.
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
            // Default Button height (36px) matches Input/Select, so the fields line up.
            "border-input w-full justify-start rounded-sm px-3 text-left font-normal",
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
