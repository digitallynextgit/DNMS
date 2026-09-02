"use client"

import * as React from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { ArrowRight, CalendarClock, Target, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CHART_TOOLTIP_ITEM_STYLE, CHART_TOOLTIP_STYLE } from "@/lib/chart-theme"
import { useProjectGoals } from "../hooks/use-goals"
import {
  EMPTY_SUMMARY,
  ProgressBar,
  STATUS_LABEL,
  STATUS_STYLE,
  breakdown,
  fmtDate,
  type GoalNode,
} from "./goal-status"

// =============================================================================
// Goals at a glance, on the project Overview.
//
// The Goals tab is the place you WORK on goals; this is the place you find out
// whether you need to. So it answers three questions and stops: how much is
// done, how the goals are spread across the five states, and what is due next.
// Everything that edits anything lives one click away, behind "Open goals".
//
// MAIN GOALS ONLY. A sub-goal is part of its parent, and the parent's state
// already reflects it (the server rolls status and progress up), so the card
// neither counts nor lists sub-goals. They are the tab's business.
//
// It shares its query with the tab (see use-goals.ts), so opening Overview and
// then Goals is one request, and marking a goal done on the tab updates this
// card without a refetch.
//
// Charts follow the house data-viz rules: colour comes from the shared status
// record rather than a local palette, every slice is in the legend WITH its
// count (a donut nobody can read numbers off is decoration), and the tooltip
// uses the shared theme so it is legible on the dark ground that is the app's
// default.
// =============================================================================

/** A stat tile. Deliberately flat - the card is already a surface. */
function Tile({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className="bg-muted/40 rounded-[6px] px-3 py-2.5">
      <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
        {label}
      </p>
      <p className={cn("mt-0.5 text-xl leading-none font-semibold tabular-nums", className)}>
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-1 text-[11px] leading-tight">{hint}</p>}
    </div>
  )
}

/**
 * One main goal, its state and its bar.
 *
 * Capped at four with a "+N more" rather than scrolled: a card on Overview that
 * scrolls internally hides its own overflow, and the honest answer to "there
 * are twelve goals" is to send the reader to the tab that shows twelve.
 */
const MAX_ROWS = 4

function GoalRow({ goal }: { goal: GoalNode }) {
  const style = STATUS_STYLE[goal.status]
  return (
    <div className="flex items-center gap-3">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} />
      <p className={cn("min-w-0 flex-1 truncate text-sm", style.title)} title={goal.title}>
        {goal.title}
      </p>
      <ProgressBar value={goal.progress} className="hidden w-24 shrink-0 sm:block" />
      <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
        {goal.progress}%
      </span>
    </div>
  )
}

export function GoalsOverviewCard({
  projectId,
  onOpen,
}: {
  projectId: string
  /** Switches the page to the Goals tab. */
  onOpen: () => void
}) {
  const { data, isLoading } = useProjectGoals(projectId)

  if (isLoading) return <Skeleton className="h-56 rounded" />

  const summary = data ?? EMPTY_SUMMARY
  const b = breakdown(summary)

  // Nothing to summarise. An empty donut with five zeroes is worse than a
  // sentence, so the card becomes the invitation to create the first goal.
  if (b.total === 0) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <Target className="text-muted-foreground h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">No goals yet</p>
              <p className="text-muted-foreground text-xs">
                Set what this project is meant to deliver, and track it here.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onOpen}>
            Add goals
          </Button>
        </CardContent>
      </Card>
    )
  }

  const chartData = b.slices.map((s) => ({ ...s, name: STATUS_LABEL[s.status] }))
  const shown = summary.goals.slice(0, MAX_ROWS)
  const hidden = summary.goals.length - shown.length

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="text-muted-foreground h-4 w-4" />
            <h3 className="text-sm font-semibold">Goals</h3>
          </div>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={onOpen}>
            Open goals
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:gap-6">
          {/* Donut + legend. The percentage sits in the hole because that is the
              one number people came for, and a ring reads as "share of a whole"
              in a way a bar does not. */}
          <div className="flex items-center gap-4">
            <div className="relative h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={62}
                    paddingAngle={chartData.length > 1 ? 2 : 0}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {chartData.map((s) => (
                      <Cell key={s.status} fill={STATUS_STYLE[s.status].fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} goal${value === 1 ? "" : "s"}`, name]}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* aria-hidden: the same numbers are in the legend as text, and a
                  screen reader reading the ring would say them twice. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              >
                <span className="text-2xl leading-none font-semibold tabular-nums">
                  {summary.overallProgress}%
                </span>
                <span className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">
                  Complete
                </span>
              </div>
            </div>

            <ul className="min-w-0 space-y-1.5">
              {b.byStatus
                .filter((s) => s.count > 0)
                .map(({ status, count }) => (
                  <li key={status} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_STYLE[status].dot)}
                    />
                    <span className="text-muted-foreground">{STATUS_LABEL[status]}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Goals" value={b.total} />
              <Tile label="Done" value={summary.doneGoals} />
              <Tile
                label="Progress"
                value={`${summary.overallProgress}%`}
                hint={
                  summary.discardedGoals > 0
                    ? `${summary.discardedGoals} discarded, not counted`
                    : undefined
                }
              />
            </div>

            <div>
              <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-[11px]">
                <span>Overall progress</span>
                <span className="tabular-nums">
                  {summary.doneGoals} of {summary.totalGoals} done
                </span>
              </div>
              <ProgressBar value={summary.overallProgress} className="h-2" />
            </div>

            {/* The two facts that make someone act. Both are conditional: an
                empty "0 overdue" row trains people to stop reading the strip. */}
            {(summary.overdueGoals > 0 || summary.nextTargetDate) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {summary.overdueGoals > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-500">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    {summary.overdueGoals} overdue
                  </span>
                )}
                {summary.nextTargetDate && (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Next target {fmtDate(summary.nextTargetDate)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* The goals themselves, so the card names them rather than only
            counting them. A number tells you there is work; a title tells you
            which work. */}
        <div className="space-y-2 border-t pt-3">
          {shown.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
          {hidden > 0 && (
            <button
              type="button"
              onClick={onOpen}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              +{hidden} more {hidden === 1 ? "goal" : "goals"}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
