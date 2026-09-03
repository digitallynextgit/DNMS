"use client"

import * as React from "react"
import { Check, Tags, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DateRangeField, type DateRangeValue } from "@/components/shared/date-range-field"
import { TagChip, type GoalNode, type GoalsSummary, type Status } from "./goal-status"

// ─────────────────────────────────────────────────────────────────────────────
// Narrowing the goal board to a date window and a set of tags.
//
// ── WHY THIS IS IN THE BROWSER AND NOT IN THE QUERY ──────────────────────────
// A project holds tens of goals, not thousands, and the whole tree is already
// fetched and cached for the Overview card. Filtering server-side would buy a
// round-trip per keystroke and would have to re-derive every parent's progress
// from a partial set of children - which is how a filtered board ends up
// disagreeing with the unfiltered one about the same goal.
//
// ── A PARENT'S NUMBERS ARE NEVER RECOMPUTED FROM WHAT SURVIVED THE FILTER ────
// `progress`, `status` and `countableChildren` come off the server's roll-up
// over ALL of a goal's sub-goals, and they stay that way here. "Launch the
// storefront: 40%" means 40% of the launch, not 40% of the two sub-goals that
// happened to fall inside the week you were looking at. Hiding a sub-goal
// changes what is on screen; it must not change what is true.
//
// What IS recomputed is the summary strip, over the goals still visible - and
// the strip says so in words, because "Done 1/2" with a filter on and no
// explanation is a number that looks wrong.
//
// ── AN UNDATED GOAL IS NOT IN ANY WEEK ───────────────────────────────────────
// A goal with no target date fails every date filter. The alternative - always
// keeping undated goals so nothing is "lost" - defeats the filter: ask for this
// week and you get this week plus the backlog. They come back the moment the
// date filter is cleared, and the board says how many are hidden.
// ─────────────────────────────────────────────────────────────────────────────

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

/**
 * Does this one goal match?
 *
 * Tags are matched case-insensitively - the server preserves the casing that was
 * typed, so a filter keyed on the exact string would miss "Weekly" when the user
 * clicked "weekly" on a different goal.
 */
function matches(goal: GoalNode, f: GoalFilters): boolean {
  if (f.tags.length > 0) {
    const own = new Set(goal.tags.map((t) => t.toLowerCase()))
    if (!f.tags.some((t) => own.has(t.toLowerCase()))) return false
  }
  if (f.date.from || f.date.to) {
    // yyyy-MM-dd compares correctly as a string, so no Date objects are built
    // here - and no timezone can shift a goal out of its own week.
    if (!goal.targetDate) return false
    if (f.date.from && goal.targetDate < f.date.from) return false
    if (f.date.to && goal.targetDate > f.date.to) return false
  }
  return true
}

/**
 * The summary strip, recomputed over whatever survived the filter.
 *
 * The formulas are the server's (see getProjectGoals) applied to a smaller set:
 * main goals only for the progress average and the done count, the whole visible
 * tree for the row-level tallies. Each goal's own `progress` is the server's
 * figure, untouched.
 */
function summarise(goals: GoalNode[]): Omit<GoalsSummary, "allTags"> {
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

    // A goal that is ITSELF in the window is shown whole - you asked for this
    // goal, so you get all of its parts, including the ones due later. A goal
    // that is only on screen because some of its sub-goals matched shows just
    // those sub-goals, which is the thing that was actually asked for.
    const children = self ? goal.children : kids
    hiddenSubs += goal.children.length - children.length
    goals.push(children === goal.children ? goal : { ...goal, children })
  }

  return {
    // allTags is the PROJECT's vocabulary, not this view's: the tag picker must
    // keep offering every tag, or filtering to one would empty the list you use
    // to filter by another.
    summary: { ...summarise(goals), allTags: summary.allTags },
    hiddenMains: summary.goals.length - goals.length,
    hiddenSubs,
    active: true,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The bar
// ─────────────────────────────────────────────────────────────────────────────

/** Multi-select over the tags a project actually uses. */
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
          className="h-8 justify-start gap-2 px-3 text-sm font-normal"
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
                className="hover:bg-muted flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left"
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

/**
 * Date range + tags, and a plain-English readout of what they left behind.
 *
 * The readout is not decoration. Every filtered board eventually gets looked at
 * by somebody who forgot a filter was on and reads the empty space as "we have
 * no goals this quarter"; saying "showing 3 of 12" next to a Clear button costs
 * a line and settles it.
 */
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

      {/* The chosen tags, each removable where it is read. */}
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
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onChange(NO_GOAL_FILTERS)}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </>
      )}
    </div>
  )
}
