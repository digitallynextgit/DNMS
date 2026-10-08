"use client"

import { TrendingDown } from "lucide-react"

import { cn } from "@/lib/utils"
import type { GoalNode } from "../lib/goal-derivation"

// Shared goal vocabulary. Types mirror ProjectGoalsSummary in ../server/goals.service.ts.

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

/** From the pure ../lib/goal-derivation.ts, so client components can use them without server code. */
export type { GoalNode, GoalTaskLink, GoalTarget } from "../lib/goal-derivation"

export interface GoalsSummary {
  goals: GoalNode[]
  overallProgress: number
  /** Countable MAIN goals. Sub-goals belong to their parent and are not added. */
  totalGoals: number
  doneGoals: number
  /** Flat, sub-goals included: these describe rows on the board, not goals. */
  discardedGoals: number
  inactiveGoals: number
  overdueGoals: number
  /** Flagged at risk by a person - a judgement, not arithmetic. */
  atRiskGoals: number
  /** Behind the calendar without anyone having said so yet. Derived. */
  slippingGoals: number
  nextTargetDate: string | null
  allTags: string[]
  /** Open tasks serving no goal - shown to the manager as work to sort. */
  unlinkedOpenTasks: number
}

/** Used before the first response and on failure, instead of null checks everywhere. */
export const EMPTY_SUMMARY: GoalsSummary = {
  goals: [],
  overallProgress: 0,
  totalGoals: 0,
  doneGoals: 0,
  discardedGoals: 0,
  inactiveGoals: 0,
  overdueGoals: 0,
  atRiskGoals: 0,
  slippingGoals: 0,
  nextTargetDate: null,
  allTags: [],
  unlinkedOpenTasks: 0,
}

export const STATUS_LABEL: Record<Status, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  AT_RISK: "At risk",
  DONE: "Done",
  DISCARDED: "Discarded",
}

/** One colour per state on every surface (chip, dot, select, history, donut), so they can't drift. */
export interface StatusStyle {
  chip: string
  dot: string
  text: string
  trigger: string
  /** Body copy, so NOT_STARTED keeps the default foreground; DONE/DISCARDED are struck through. */
  title: string
  /** CSS value for SVG (Recharts can't take classes); NOT_STARTED is a token so it follows the theme. */
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
    // A step darker than AT_RISK's amber so the two don't blur; red means dropped, not met.
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

/** Derived, not a status: clears itself when the work catches up, so it rides beside the badge. */
export function SlippingChip({ className }: { className?: string }) {
  return (
    <span
      title="Behind where the calendar says it should be - nobody has flagged it yet"
      className={cn(
        "inline-flex items-center gap-1 rounded-sm bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-500 uppercase",
        className,
      )}
    >
      <TrendingDown className="h-3 w-3" /> Slipping
    </span>
  )
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        STATUS_STYLE[status].chip,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Type-ahead suggestions only; tags are free text. */
export const SUGGESTED_TAGS = ["weekly", "monthly", "quarterly", "primary", "secondary"] as const

/** Not the status palette (those hues carry meaning); picked by hashing the tag so it's stable everywhere. */
const TAG_TINTS = [
  "border-violet-500/35 bg-violet-500/10 text-violet-400",
  "border-cyan-500/35 bg-cyan-500/10 text-cyan-400",
  "border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-400",
  "border-indigo-500/35 bg-indigo-500/10 text-indigo-400",
  "border-teal-500/35 bg-teal-500/10 text-teal-400",
] as const

/** Case-insensitive, so "Weekly" and "weekly" cannot land on two colours. */
export function tagTint(tag: string): string {
  const key = tag.toLowerCase()
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return TAG_TINTS[hash % TAG_TINTS.length]!
}

/** `onClick` turns it into a filter button. */
export function TagChip({
  tag,
  onClick,
  active,
  className,
}: {
  tag: string
  onClick?: () => void
  active?: boolean
  className?: string
}) {
  const shared = cn(
    "inline-flex max-w-40 items-center rounded-[6px] border px-2 py-1 text-[10px] leading-none font-medium",
    tagTint(tag),
    active && "ring-primary/60 ring-1",
    className,
  )
  if (!onClick) {
    return (
      <span className={shared}>
        <span className="truncate">{tag}</span>
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? `Stop filtering by "${tag}"` : `Show only goals tagged "${tag}"`}
      className={cn(shared, "hover:brightness-125")}
    >
      <span className="truncate">{tag}</span>
    </button>
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

// Main goals only - each parent already rolls up its sub-goals. DISCARDED is counted here (unlike the
// progress denominator) so the slices add up to the total.
export interface GoalBreakdown {
  /** Main goals in each state, in STATUS_ORDER. Zero-count states included. */
  byStatus: { status: Status; count: number }[]
  slices: { status: Status; count: number }[]
  total: number
}

export function breakdown(summary: GoalsSummary): GoalBreakdown {
  const tally = new Map<Status, number>(STATUS_ORDER.map((s) => [s, 0]))
  for (const g of summary.goals) tally.set(g.status, (tally.get(g.status) ?? 0) + 1)

  const byStatus = STATUS_ORDER.map((status) => ({ status, count: tally.get(status) ?? 0 }))
  return {
    byStatus,
    slices: byStatus.filter((s) => s.count > 0),
    total: summary.goals.length,
  }
}
