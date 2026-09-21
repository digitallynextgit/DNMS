"use client"

import * as React from "react"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  formatMonthShort,
  MONTH_LABELS,
  NO_MONTH_LABEL,
  parseMonth,
  stepEdition,
  type CalendarSeries,
  type YearMonth,
} from "../../lib/calendar-months"
import type { WorkbookIndexEntry } from "../../lib/sheet-types"
import { PersonAvatar } from "./person-bits"

// =============================================================================
// Picking a calendar, and then a month of it.
//
// Two controls, because there are two questions and they used to be collapsed
// into one. A calendar's name used to carry its month - "Performance Marketing
// Calendar(H2S-Sept)" - which made the dropdown a list of near-identical
// strings and left September and October as unrelated rows. The name picks the
// calendar; the stepper picks the month.
//
// ── STEPPING WALKS THE MONTHS THAT EXIST ─────────────────────────────────────
// Not the calendar year. A project that ran August and October has no
// September, and a stepper that walked the year would land on an empty month
// and make the user press again. The arrows jump to the next edition that is
// actually there, and stop at the ends.
// =============================================================================

type Series = CalendarSeries<WorkbookIndexEntry>

/** The calendar itself: one row per NAME, whatever months sit behind it. */
export function CalendarNamePicker({
  series,
  activeName,
  onPick,
}: {
  series: Series[]
  activeName: string | null
  onPick: (name: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          // No width cap and no truncation: the name of the calendar you are in
          // is the one label on this bar that has to be readable in full. The
          // strip wraps, so a long name costs a line, not sense.
          className="gap-1.5 px-2.5 font-medium"
          aria-label="Switch calendar"
          title={activeName ?? undefined}
        >
          <span className="whitespace-nowrap">{activeName ?? "No calendar yet"}</span>
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[24rem]">
        <DropdownMenuLabel className="text-muted-foreground text-[11px] font-medium">
          {series.length} {series.length === 1 ? "calendar" : "calendars"}
        </DropdownMenuLabel>
        {series.map((s) => {
          const dated = s.editions.filter((e) => e.periodMonth)
          const newest = dated[0]
          const oldest = dated[dated.length - 1]
          return (
            <DropdownMenuItem
              key={s.name}
              onSelect={() => onPick(s.name)}
              className={cn(
                "flex-col items-start gap-0.5",
                s.name === activeName && "bg-primary/10 text-primary font-medium",
              )}
            >
              {/* Wrapped, never truncated - two calendars whose names differ
                  only at the end are the same calendar to an ellipsis. */}
              <span className="min-w-0 break-words whitespace-normal">{s.name}</span>
              {/* The second line says whether stepping is even meaningful,
                  before you commit to opening it. */}
              <span className="flex w-full items-center gap-1.5 text-[11px] opacity-70">
                {dated.length > 0 ? (
                  <>
                    {dated.length} {dated.length === 1 ? "month" : "months"}
                    {newest && oldest && (
                      <span>
                        ·{" "}
                        {newest === oldest
                          ? formatMonthShort(newest.periodMonth)
                          : `${formatMonthShort(oldest.periodMonth)} – ${formatMonthShort(newest.periodMonth)}`}
                      </span>
                    )}
                  </>
                ) : (
                  <span>Not monthly</span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  {(newest ?? s.editions[0])?.assignedTo && (
                    <PersonAvatar
                      person={(newest ?? s.editions[0])!.assignedTo!}
                      className="h-4 w-4"
                    />
                  )}
                </span>
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The month, with arrows either side and a jump list behind the label.
 *
 * MonthNav in components/shared is not reused here, deliberately: it renders
 * "label then arrows" and its label is plain text. This one needs the label to
 * BE the jump menu, because getting from September 2026 back to last October
 * should not be twelve presses. Changing the shared one would move the
 * attendance and holiday calendars for no reason.
 */
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

  /** Editions grouped by year, for the jump list. */
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

  // A calendar with no dated editions at all is not a monthly calendar, and a
  // stepper over nothing is worse than no stepper: it invites a press that
  // cannot do anything.
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
    <span className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
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
            className="h-8 gap-1 px-2 text-sm font-medium"
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
        className="h-8 w-8"
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
