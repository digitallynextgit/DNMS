"use client"

import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// The shared vocabulary of a goal: its shape on the wire, its five states, and
// the one colour each state wears.
//
// Extracted from goals-tab.tsx once the Overview card started showing the same
// states. Two components rendering "at risk" from two private records is how a
// state ends up amber in one place and grey in the other - the exact drift the
// STATUS_STYLE note below warns about, so the record has to outrank both.
//
// Types mirror ProjectGoalsSummary in features/projects/server/goals.service.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type Status = "NOT_STARTED" | "IN_PROGRESS" | "AT_RISK" | "DONE" | "DISCARDED"

export interface GoalEvent {
  id: string
  type: "CREATED" | "STATUS_CHANGED" | "DEACTIVATED" | "REACTIVATED" | "EDITED"
  fromStatus: Status | null
  toStatus: Status | null
  reason: string | null
  actorName: string | null
  at: string
}

export interface GoalNode {
  id: string
  title: string
  status: Status
  statusReason: string | null
  progress: number
  targetDate: string | null
  isActive: boolean
  createdByName: string | null
  children: GoalNode[]
  progressIsDerived: boolean
  countableChildren: number
  overdue: boolean
  events: GoalEvent[]
}

export interface GoalsSummary {
  goals: GoalNode[]
  overallProgress: number
  totalGoals: number
  doneGoals: number
  discardedGoals: number
  inactiveGoals: number
  overdueGoals: number
  nextTargetDate: string | null
}

/**
 * What a component renders before the first response lands, and if the request
 * fails. A zeroed summary rather than a null check at every read site.
 */
export const EMPTY_SUMMARY: GoalsSummary = {
  goals: [],
  overallProgress: 0,
  totalGoals: 0,
  doneGoals: 0,
  discardedGoals: 0,
  inactiveGoals: 0,
  overdueGoals: 0,
  nextTargetDate: null,
}

export const STATUS_LABEL: Record<Status, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  AT_RISK: "At risk",
  DONE: "Done",
  DISCARDED: "Discarded",
}

/**
 * One colour per state, applied to every surface that shows it: the chip, the
 * dot on a sub-goal row, the select that sets it, the arrow in the history, and
 * the slice in the Overview donut.
 *
 * Semantic rather than brand: these are Tailwind palette colours, not the theme
 * accent, so a state reads the same on every surface even where the brand red
 * is doing a different job around it.
 *
 * Kept as one record rather than scattered class strings so a state cannot end
 * up amber in the chip and grey in the dropdown - which is exactly what happens
 * when each surface picks its own.
 */
export interface StatusStyle {
  /** Filled chip. */
  chip: string
  /** The dot on a sub-goal row, and the legend swatch. */
  dot: string
  /** Text on a plain background. */
  text: string
  /** The select trigger: tinted border + text, so the row carries its state. */
  trigger: string
  /**
   * The goal's own title.
   *
   * Separate from `text` because a title is body copy and has to stay readable
   * first. NOT_STARTED keeps the default foreground rather than going muted:
   * an unstarted goal is not less important than an active one, and greying it
   * says it is. DONE and DISCARDED are struck through, so on those two the
   * colour confirms the state rather than having to carry it alone.
   */
  title: string
  /**
   * The same colour as a CSS value, for SVG.
   *
   * Recharts writes `fill` inline and cannot take a Tailwind class, so a chart
   * that wants these colours has to restate them - which is how the donut and
   * the chips drift apart. Stating it here keeps one record authoritative.
   *
   * NOT_STARTED is a token rather than a hex so the neutral slice inverts with
   * the theme; the other four are the same palette steps as the classes above,
   * which read on both grounds.
   */
  fill: string
}

export const STATUS_STYLE: Record<Status, StatusStyle> = {
  NOT_STARTED: {
    chip: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    trigger: "border-border text-muted-foreground",
    title: "text-foreground",
    fill: "hsl(var(--muted-foreground) / 0.35)",
  },
  IN_PROGRESS: {
    chip: "bg-blue-500/12 text-blue-500",
    dot: "bg-blue-500",
    text: "text-blue-500",
    trigger: "border-blue-500/40 bg-blue-500/8 text-blue-500",
    title: "text-blue-500",
    fill: "#3b82f6",
  },
  AT_RISK: {
    chip: "bg-amber-500/12 text-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-500",
    trigger: "border-amber-500/40 bg-amber-500/8 text-amber-500",
    title: "text-amber-500",
    fill: "#f59e0b",
  },
  DONE: {
    chip: "bg-emerald-500/12 text-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-500",
    trigger: "border-emerald-500/40 bg-emerald-500/8 text-emerald-500",
    title: "text-emerald-500 line-through",
    fill: "#10b981",
  },
  DISCARDED: {
    // Red, and a step darker than the amber of AT_RISK so the two do not blur
    // into one warm blob on a row that holds both. The strike-through is what
    // says "out of play"; the red says the goal was dropped rather than met.
    chip: "bg-red-500/12 text-red-500",
    dot: "bg-red-500",
    text: "text-red-500",
    trigger: "border-red-500/40 bg-red-500/8 text-red-500",
    title: "text-red-500 line-through",
    fill: "#ef4444",
  },
}

export const STATUS_ORDER: Status[] = ["NOT_STARTED", "IN_PROGRESS", "AT_RISK", "DONE", "DISCARDED"]

/** Statuses the server will refuse without a reason. Kept in step deliberately. */
export const NEEDS_REASON: ReadonlySet<Status> = new Set<Status>(["AT_RISK", "DISCARDED"])

/** A target date. Parsed as UTC so a `2026-03-31` never renders as the 30th. */
export function fmtDate(iso: string | null): string {
  if (!iso) return "No date"
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** A history timestamp: local, because "when did this change" is a wall clock. */
export function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        STATUS_STYLE[status].chip,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("bg-muted h-1.5 w-full overflow-hidden rounded-full", className)}>
      <div
        className="bg-primary h-full rounded-full transition-[width]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived counts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The numbers the Overview card shows, worked out from the tree the API already
 * returns rather than added to the summary server-side.
 *
 * `totalGoals` on the wire is the FLAT count - mains and sub-goals together -
 * which is the right denominator for progress and the wrong one for a stat tile
 * labelled "Goals". Splitting the two here keeps the server contract as it is.
 *
 * DISCARDED IS COUNTED HERE, unlike in the progress denominator. A chart of
 * states that silently omits one of the five states is a chart that does not
 * add up: the reader counts the slices, counts the goals, and finds the card
 * lying to them. So the tiles and the slices share one population - every goal
 * that exists - and "discarded goals do not count toward progress" is said in
 * words next to the progress figure, where it actually applies.
 *
 * Deactivated goals are absent entirely: the card fetches without
 * `includeInactive`, so the tree never contains them.
 */
export interface GoalBreakdown {
  /** Top-level goals. */
  mains: number
  /** Sub-goals, at any depth. */
  subs: number
  /** Goals in each state, in STATUS_ORDER. Zero-count states included. */
  byStatus: { status: Status; count: number }[]
  /** Slices with a count, for the donut. Empty when there are no goals. */
  slices: { status: Status; count: number }[]
  /** mains + subs, and the sum of every slice. */
  total: number
}

export function breakdown(summary: GoalsSummary): GoalBreakdown {
  let mains = 0
  let subs = 0
  const tally = new Map<Status, number>(STATUS_ORDER.map((s) => [s, 0]))

  const walk = (nodes: GoalNode[], depth: number) => {
    for (const n of nodes) {
      if (depth === 0) mains++
      else subs++
      tally.set(n.status, (tally.get(n.status) ?? 0) + 1)
      walk(n.children, depth + 1)
    }
  }
  walk(summary.goals, 0)

  const byStatus = STATUS_ORDER.map((status) => ({ status, count: tally.get(status) ?? 0 }))
  return {
    mains,
    subs,
    byStatus,
    slices: byStatus.filter((s) => s.count > 0),
    total: mains + subs,
  }
}
