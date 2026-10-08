"use client"

import * as React from "react"
import { Check, Tags, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DateRangeField, type DateRangeValue } from "@/components/shared/date-range-field"
import { TagChip, type GoalNode, type GoalsSummary, type Status } from "./goal-status"

// Filtered in the browser. A parent's progress/status always come from the server's roll-up over ALL
// its sub-goals; only the summary strip is recomputed. An undated goal fails every date filter.

export interface GoalFilters {
  /** Matched against a goal's TARGET date. `preset` drives the trigger label. */
  date: DateRangeValue
  /** OR, not AND: a goal matches if it carries ANY of these. */
  tags: string[]
}

export const NO_GOAL_FILTERS: GoalFilters = {
  date: { preset: "all", from: null, to: null },
  tags: [],
}

export const goalFiltersActive = (f: GoalFilters): boolean =>
  Boolean(f.date.from || f.date.to || f.tags.length > 0)

/** Mirrors NOT_COUNTABLE in goals.service.ts. */
const NOT_COUNTABLE: ReadonlySet<Status> = new Set<Status>(["DISCARDED"])
const counts = (g: GoalNode): boolean => g.isActive && !NOT_COUNTABLE.has(g.status)

/** UTC, matching the server, so "upcoming" means the same day on both sides. */
const todayKey = (): string => new Date().toISOString().slice(0, 10)

/** Tags match case-insensitively: the server keeps the casing that was typed. */
function matches(goal: GoalNode, f: GoalFilters): boolean {
  if (f.tags.length > 0) {
    const own = new Set(goal.tags.map((t) => t.toLowerCase()))
    if (!f.tags.some((t) => own.has(t.toLowerCase()))) return false
  }
  if (f.date.from || f.date.to) {
    // yyyy-MM-dd compares as a string, so no timezone can shift a goal's week.
    if (!goal.targetDate) return false
    if (f.date.from && goal.targetDate < f.date.from) return false
    if (f.date.to && goal.targetDate > f.date.to) return false
  }
  return true
}

/** The server's formulas (getProjectGoals) over the visible set; each goal's own `progress` is untouched. */
function summarise(goals: GoalNode[]): Omit<GoalsSummary, "allTags" | "unlinkedOpenTasks"> {
  const flat: GoalNode[] = []
  const walk = (n: GoalNode) => {
    flat.push(n)
    n.children.forEach(walk)
  }
  goals.forEach(walk)

  const mains = goals.filter(counts)
  const today = todayKey()
  const upcoming = flat
    .filter(counts)
    .map((g) => g.targetDate)
    .filter((d): d is string => Boolean(d))
    .filter((d) => d >= today)
    .sort()

  return {
    goals,
    overallProgress:
      mains.length === 0 ? 0 : Math.round(mains.reduce((s, g) => s + g.progress, 0) / mains.length),
    totalGoals: mains.length,
    doneGoals: mains.filter((g) => g.status === "DONE").length,
    discardedGoals: flat.filter((g) => g.isActive && g.status === "DISCARDED").length,
    inactiveGoals: flat.filter((g) => !g.isActive).length,
    overdueGoals: flat.filter((g) => g.overdue).length,
    // Countable set only, matching summariseGoalRows: a discarded goal is no longer a warning.
    atRiskGoals: flat.filter((g) => counts(g) && g.status === "AT_RISK").length,
    slippingGoals: flat.filter((g) => counts(g) && g.slipping).length,
    nextTargetDate: upcoming[0] ?? null,
  }
}

export interface FilteredGoals {
  /** The same shape the API returns, so every consumer stays unchanged. */
  summary: GoalsSummary
  /** Main goals the filter removed entirely. */
  hiddenMains: number
  /** Sub-goals hidden beneath a parent that survived. */
  hiddenSubs: number
  active: boolean
}

export function filterGoals(summary: GoalsSummary, f: GoalFilters): FilteredGoals {
  if (!goalFiltersActive(f)) {
    return { summary, hiddenMains: 0, hiddenSubs: 0, active: false }
  }

  let hiddenSubs = 0
  const goals: GoalNode[] = []

  for (const goal of summary.goals) {
    const self = matches(goal, f)
    const kids = goal.children.filter((c) => matches(c, f))
    if (!self && kids.length === 0) continue

    // A goal itself in the window shows whole; one shown only for matching sub-goals shows just those.
    const children = self ? goal.children : kids
    hiddenSubs += goal.children.length - children.length
    goals.push(children === goal.children ? goal : { ...goal, children })
  }

  return {
    // allTags is the project's vocabulary, so the tag picker keeps offering every tag.
    summary: {
      ...summarise(goals),
      allTags: summary.allTags,
      unlinkedOpenTasks: summary.unlinkedOpenTasks,
    },
    hiddenMains: summary.goals.length - goals.length,
    hiddenSubs,
    active: true,
  }
}

function TagFilter({
  allTags,
  selected,
  onChange,
}: {
  allTags: string[]
  selected: string[]
  onChange: (tags: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const picked = new Set(selected.map((t) => t.toLowerCase()))

  const toggle = (tag: string) => {
    const key = tag.toLowerCase()
    onChange(picked.has(key) ? selected.filter((t) => t.toLowerCase() !== key) : [...selected, tag])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={allTags.length === 0}
          className="justify-start gap-2 font-normal"
        >
          <Tags className="h-3.5 w-3.5" />
          {selected.length === 0
            ? allTags.length === 0
              ? "No tags yet"
              : "All tags"
            : `${selected.length} tag${selected.length === 1 ? "" : "s"}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <p className="text-muted-foreground px-2 py-1.5 text-[11px]">
          Show goals carrying any of these
        </p>
        <div className="max-h-64 overflow-y-auto">
          {allTags.map((tag) => {
            const on = picked.has(tag.toLowerCase())
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className="hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left"
              >
                <Check className={cn("h-3.5 w-3.5 shrink-0", on ? "opacity-100" : "opacity-0")} />
                <TagChip tag={tag} />
              </button>
            )
          })}
        </div>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-muted-foreground hover:text-foreground border-border/60 mt-1 w-full border-t px-2 py-1.5 text-left text-xs"
          >
            Clear tags
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Also says "showing 3 of 12", so a forgotten filter isn't read as "no goals". */
export function GoalFilterBar({
  value,
  onChange,
  allTags,
  shown,
  total,
  hiddenSubs,
}: {
  value: GoalFilters
  onChange: (f: GoalFilters) => void
  allTags: string[]
  shown: number
  total: number
  hiddenSubs: number
}) {
  const active = goalFiltersActive(value)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangeField
        value={value.date}
        onChange={(date) => onChange({ ...value, date })}
        className="h-8"
      />
      <TagFilter
        allTags={allTags}
        selected={value.tags}
        onChange={(tags) => onChange({ ...value, tags })}
      />

      {value.tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1">
          <TagChip tag={tag} />
          <button
            type="button"
            onClick={() => onChange({ ...value, tags: value.tags.filter((t) => t !== tag) })}
            aria-label={`Remove the "${tag}" filter`}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {active && (
        <>
          <span className="text-muted-foreground text-xs">
            Showing {shown} of {total} goal{total === 1 ? "" : "s"}
            {hiddenSubs > 0 && ` · ${hiddenSubs} sub-goal${hiddenSubs === 1 ? "" : "s"} hidden`}
          </span>
          <Button className="gap-1.5" variant="ghost" onClick={() => onChange(NO_GOAL_FILTERS)}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </>
      )}
    </div>
  )
}
