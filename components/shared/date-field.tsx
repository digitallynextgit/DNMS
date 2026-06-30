"use client"

import { useState } from "react"
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
}: {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  startMonth?: Date
  endMonth?: Date
  disabled?: (date: Date) => boolean
  /** Set when rendered inside a Dialog so the popover layers above it. */
  modal?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "border-input h-10 w-full justify-start rounded px-3 text-left font-normal",
            !value && "text-muted-foreground",
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
          startMonth={startMonth}
          endMonth={endMonth}
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
