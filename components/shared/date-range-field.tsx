"use client"

import { useEffect, useState } from "react"
import { Calendar as CalendarIcon, Check } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn, formatDate } from "@/lib/utils"
import { toDateString, parseDateString } from "@/components/shared/date-field"

export interface DatePreset {
  key: string
  label: string
  /** Null range means "no date filter at all". */
  range: () => { from: string; to: string } | null
}

/** Local yyyy-MM-dd, so a range never shifts a day across timezones. */
const key = (d: Date) => toDateString(d)
const shift = (days: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

/** Monday-start week containing today. */
function thisWeek() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start = new Date(now)
  start.setDate(start.getDate() - ((now.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { from: key(start), to: key(end) }
}

export const DATE_PRESETS: DatePreset[] = [
  { key: "all", label: "All time", range: () => null },
  { key: "week", label: "This week", range: thisWeek },
  {
    key: "last7",
    label: "Last 7 days",
    range: () => ({ from: key(shift(-6)), to: key(shift(0)) }),
  },
  {
    key: "last30",
    label: "Last 30 days",
    range: () => ({ from: key(shift(-29)), to: key(shift(0)) }),
  },
  {
    key: "next7",
    label: "Next 7 days",
    range: () => ({ from: key(shift(0)), to: key(shift(6)) }),
  },
]

export interface DateRangeValue {
  /** A preset key, or "custom" when the calendar was used. */
  preset: string
  from: string | null
  to: string | null
}

/** Resolve a preset to a value, for seeding initial state. */
export function presetValue(presetKey: string): DateRangeValue {
  const p = DATE_PRESETS.find((x) => x.key === presetKey) ?? DATE_PRESETS[0]!
  const r = p.range()
  return { preset: p.key, from: r?.from ?? null, to: r?.to ?? null }
}

function summarise(v: DateRangeValue): string {
  if (v.preset === "custom" && v.from) {
    return v.to ? `${formatDate(v.from)} - ${formatDate(v.to)}` : `${formatDate(v.from)} - …`
  }
  return DATE_PRESETS.find((p) => p.key === v.preset)?.label ?? "All time"
}

/**
 * Date-range control: presets on the left, calendar on the right, and nothing
 * takes effect until Apply.
 *
 * Staging matters here because the caller refetches on change - applying on
 * every click would fire a request for the start date of a range the user has
 * not finished choosing.
 */
export function DateRangeField({
  value,
  onChange,
  className,
}: {
  value: DateRangeValue
  onChange: (v: DateRangeValue) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRangeValue>(value)

  // Opening always starts from what is actually applied, so an abandoned
  // selection never leaks into the next visit.
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const draftRange: DateRange | undefined = draft.from
    ? { from: parseDateString(draft.from), to: parseDateString(draft.to ?? undefined) }
    : undefined

  // A custom range with only one end picked is not applyable yet.
  const incomplete = draft.preset === "custom" && !!draft.from && !draft.to

  const apply = () => {
    onChange(draft)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-8 justify-start gap-2 px-3 text-sm font-normal", className)}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {summarise(value)}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-col sm:flex-row">
          {/* Presets */}
          <div className="border-b p-1 sm:w-40 sm:border-r sm:border-b-0">
            {DATE_PRESETS.map((p) => {
              const active = draft.preset === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    const r = p.range()
                    setDraft({ preset: p.key, from: r?.from ?? null, to: r?.to ?? null })
                  }}
                  className={cn(
                    "hover:bg-muted flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-sm",
                    active && "font-medium",
                  )}
                >
                  <Check className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0")} />
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Calendar */}
          <div className="p-2">
            <p className="text-muted-foreground mb-1 px-1 text-xs">
              Custom range - click the start date, then the end date
            </p>
            <Calendar
              mode="range"
              numberOfMonths={2}
              captionLayout="dropdown"
              defaultMonth={parseDateString(draft.from ?? undefined)}
              selected={draftRange}
              onSelect={(r) =>
                setDraft({
                  preset: "custom",
                  from: r?.from ? key(r.from) : null,
                  to: r?.to ? key(r.to) : null,
                })
              }
            />
          </div>
        </div>

        {/* Nothing above has taken effect yet. */}
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
          <span className="text-muted-foreground text-xs">
            {incomplete ? "Pick an end date" : summarise(draft)}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={incomplete} onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
