"use client"

import * as React from "react"
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatMonth,
  MONTH_LABELS,
  NO_MONTH_LABEL,
  parseMonth,
  stepEdition,
  type CalendarSeries,
  type YearMonth,
} from "../../lib/calendar-months"
import type { WorkbookIndexEntry } from "../../lib/sheet-types"
import { PersonAvatar } from "./person-bits"

// The arrows step through the months that exist, not the calendar year.

type Series = CalendarSeries<WorkbookIndexEntry>

/**
 * The calendar itself: one row per NAME, whatever months sit behind it. Just the names, with a
 * search box, and the list scrolls once there are more than fit.
 */
export function CalendarNamePicker({
  series,
  activeName,
  onPick,
  onNew,
}: {
  series: Series[]
  activeName: string | null
  onPick: (name: string) => void
  /** "New calendar" at the foot of the list: switching and adding live in one place. */
  onNew?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const q = query.trim().toLowerCase()
  const shown = q ? series.filter((s) => s.name.toLowerCase().includes(q)) : series

  const close = () => {
    setOpen(false)
    setQuery("")
  }
  const pick = (name: string) => {
    onPick(name)
    close()
  }

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          // No width cap or truncation: this name must be readable in full; the strip wraps.
          className="gap-1.5 px-3 font-semibold"
          aria-label="Switch calendar"
          title={activeName ?? undefined}
        >
          <CalendarDays className="text-muted-foreground h-4 w-4 shrink-0" data-mod-icon="" />
          <span className="whitespace-nowrap">{activeName ?? "No calendar yet"}</span>
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter opens the first match, so type-and-go works without the mouse.
                if (e.key === "Enter" && shown[0]) {
                  e.preventDefault()
                  pick(shown[0].name)
                }
              }}
              placeholder={`Search ${series.length} ${series.length === 1 ? "calendar" : "calendars"}…`}
              aria-label="Search calendars"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <div role="listbox" aria-label="Calendars" className="max-h-72 overflow-y-auto p-1">
          {shown.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-xs">
              No calendar matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            shown.map((s) => {
              const active = s.name === activeName
              return (
                <button
                  key={s.name}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(s.name)}
                  className={cn(
                    "hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm focus-visible:outline-none",
                    active && "text-primary font-medium",
                  )}
                >
                  <span className="min-w-0 flex-1 break-words">{s.name}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              )
            })
          )}
        </div>
        {onNew && (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => {
                close()
                onNew()
              }}
              className="hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm focus-visible:outline-none"
            >
              <Plus className="h-3.5 w-3.5" /> New calendar
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Not the shared MonthNav: here the label itself is the jump menu. */
export function CalendarMonthPicker({
  series,
  month,
  onPickEdition,
  onNewMonth,
  onSetMonth,
  canCreate,
}: {
  series: Series | null
  /** The month on screen, or null when an undated edition is open. */
  month: YearMonth | null
  onPickEdition: (workbookId: string) => void
  onNewMonth: () => void
  /** Give an undated calendar a real month. Managers only. */
  onSetMonth: () => void
  canCreate: boolean
}) {
  const dated = React.useMemo(() => (series?.editions ?? []).filter((e) => e.periodMonth), [series])
  const undated = React.useMemo(
    () => (series?.editions ?? []).filter((e) => !e.periodMonth),
    [series],
  )

  const prev = stepEdition(series, month, -1)
  const next = stepEdition(series, month, 1)

  const byYear = React.useMemo(() => {
    const out = new Map<number, WorkbookIndexEntry[]>()
    for (const e of dated) {
      const ym = parseMonth(e.periodMonth)
      if (!ym) continue
      const list = out.get(ym.year)
      if (list) list.push(e)
      else out.set(ym.year, [e])
    }
    return [...out.entries()].sort((a, b) => b[0] - a[0])
  }, [dated])

  // No dated editions means it's not a monthly calendar, so no stepper.
  if (dated.length === 0) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs">Not monthly</span>
        {canCreate && (
          <Button variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={onSetMonth}>
            <CalendarDays className="h-3.5 w-3.5" /> Set a month…
          </Button>
        )}
      </span>
    )
  }

  const label = month
    ? formatMonth(`${month.year}-${String(month.month0 + 1).padStart(2, "0")}-01`)
    : NO_MONTH_LABEL

  return (
    // One joined control (previous | month | next), so it reads as a single month stepper.
    <span className="border-input inline-flex items-center overflow-hidden rounded-sm border">
      <Button
        variant="ghost"
        size="icon"
        className="h-[34px] rounded-none"
        onClick={() => prev && onPickEdition(prev.id)}
        disabled={!prev}
        aria-label="Previous month"
        title={prev ? formatMonth(prev.periodMonth) : "No earlier month"}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="border-input h-[34px] gap-1 rounded-none border-x px-3 font-semibold"
            aria-label="Jump to a month"
          >
            {label}
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="max-h-96 w-64 overflow-y-auto">
          {byYear.map(([year, editions]) => (
            <React.Fragment key={year}>
              <DropdownMenuLabel className="text-muted-foreground text-[11px] font-medium">
                {year}
              </DropdownMenuLabel>
              {editions.map((e) => {
                const ym = parseMonth(e.periodMonth)!
                const isOpen = month?.year === ym.year && month?.month0 === ym.month0
                return (
                  <DropdownMenuItem
                    key={e.id}
                    onSelect={() => onPickEdition(e.id)}
                    className={cn("gap-2", isOpen && "bg-primary/10 text-primary font-medium")}
                  >
                    <span className="flex-1">{MONTH_LABELS[ym.month0]}</span>
                    <span className="text-[11px] tabular-nums opacity-60">
                      {e.tabs.length} {e.tabs.length === 1 ? "tab" : "tabs"}
                    </span>
                    {e.assignedTo && <PersonAvatar person={e.assignedTo} className="h-4 w-4" />}
                  </DropdownMenuItem>
                )
              })}
            </React.Fragment>
          ))}

          {undated.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-[11px] font-medium">
                {NO_MONTH_LABEL}
              </DropdownMenuLabel>
              {undated.map((e) => (
                <DropdownMenuItem key={e.id} onSelect={() => onPickEdition(e.id)}>
                  <span className="truncate">{e.name}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {canCreate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onNewMonth} className="gap-2">
                <Plus className="h-3.5 w-3.5" /> New month…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="h-[34px] rounded-none"
        onClick={() => next && onPickEdition(next.id)}
        disabled={!next}
        aria-label="Next month"
        title={next ? formatMonth(next.periodMonth) : "No later month"}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </span>
  )
}
