"use client"

import * as React from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { PackageCheck, TriangleAlert, UserPlus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { CHART_TOOLTIP_ITEM_STYLE, CHART_TOOLTIP_STYLE } from "@/lib/chart-theme"
import { DELIVERABLE_STATUS_LABELS, isOpenStatus } from "../lib/deliverable-lifecycle"
import {
  pctMade,
  splitByTeam,
  unitsByStatus,
  type DeliverablePeriod,
  type PeriodRowLike,
} from "../lib/deliverable-periods"
import { ProgressBar } from "./goal-status"
import {
  DELIVERABLE_STATUS_DOT,
  DELIVERABLE_STATUS_FILL,
  DeliverableStatusPill,
} from "./deliverable-history-dialog"

// =============================================================================
// One deliverable, at a glance - above the per-team tabs on its own page.
//
// The tabs are where you WORK a period; this is where you find out whether you
// need to. The same three questions the Goals card answers, asked of a week:
// how much of it landed, how the rest is spread across the five states, and
// which team is behind.
//
// UNITS, NOT ITEMS, is the headline. "4 blogs" planned as one item is four
// things the client is waiting for, and a tracker that called that done the
// moment one blog landed would be wrong in the direction people notice.
//
// The team rows double as the tab switcher: a row saying VIDEO is at 0% is
// only worth reading if the next click shows VIDEO's items.
// =============================================================================

/** The rows a tracker reads. The board's `DeliverableRow` satisfies it. */
export interface TrackerRow extends PeriodRowLike {
  employee?: { id: string } | null
}

/** A stat tile. Deliberately flat - the card is already a surface. */
function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-muted/40 rounded-sm px-3 py-2.5">
      <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-xl leading-none font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-[11px] leading-tight">{hint}</p>}
    </div>
  )
}

export function DeliverableTracker<R extends TrackerRow>({
  period,
  activeTeam,
  onTeamSelect,
}: {
  period: DeliverablePeriod<R>
  /** The team tab currently open, so its row reads as selected. */
  activeTeam?: string
  /** Clicking a team row opens that team's tab. */
  onTeamSelect?: (key: string) => void
}) {
  const rows = period.rows
  const pct = pctMade(period.planned, period.made)
  const byStatus = React.useMemo(() => unitsByStatus(rows).filter((s) => s.units > 0), [rows])
  const teams = React.useMemo(() => splitByTeam(rows), [rows])

  // Owed work with nobody on it - the one thing here that is nobody's job
  // until somebody makes it theirs, which is why it gets its own line.
  const unassigned = rows.filter((r) => !r.employee && isOpenStatus(r.status)).length

  const chartData = byStatus.map((s) => ({ ...s, name: DELIVERABLE_STATUS_LABELS[s.status] }))

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="text-muted-foreground h-4 w-4" />
            <h3 className="text-sm font-semibold">{period.label}</h3>
          </div>
          <DeliverableStatusPill status={period.status} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:gap-6">
          {/* Donut + legend. The percentage sits in the hole because it is the
              one number people came for, and a ring reads as "share of a whole"
              in a way a bar does not. */}
          <div className="flex items-center gap-4">
            <div className="relative h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="units"
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
                      <Cell key={s.status} fill={DELIVERABLE_STATUS_FILL[s.status]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} unit${value === 1 ? "" : "s"}`, name]}
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
                <span className="text-2xl leading-none font-semibold tabular-nums">{pct}%</span>
                <span className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">
                  Made
                </span>
              </div>
            </div>

            <ul className="min-w-0 space-y-1.5">
              {byStatus.map(({ status, units, items }) => (
                <li key={status} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", DELIVERABLE_STATUS_DOT[status])}
                  />
                  <span className="text-muted-foreground">{DELIVERABLE_STATUS_LABELS[status]}</span>
                  <span className="font-medium tabular-nums">{units}</span>
                  {/* Only when they differ: "4 (4 items)" is noise. */}
                  {items !== units && (
                    <span className="text-muted-foreground/70 tabular-nums">
                      ({items} {items === 1 ? "item" : "items"})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Tile
                label="Units"
                value={period.planned}
                hint={`${rows.length} ${rows.length === 1 ? "item" : "items"} across ${period.teams.length} ${period.teams.length === 1 ? "team" : "teams"}`}
              />
              <Tile label="Made" value={period.made} />
              <Tile label="Progress" value={`${pct}%`} />
            </div>

            <div>
              <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-[11px]">
                <span>Overall progress</span>
                <span className="tabular-nums">
                  {period.made} of {period.planned} units made
                </span>
              </div>
              <ProgressBar value={pct} className="h-2" />
            </div>

            {/* The facts that make somebody act. Both conditional: a standing
                "0 overdue" row trains people to stop reading the strip. */}
            {(period.overdue || unassigned > 0) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {period.overdue && (
                  <span className="flex items-center gap-1.5 text-amber-500">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    Window closed, {period.planned - period.made} still owed
                  </span>
                )}
                {unassigned > 0 && (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5" />
                    {unassigned} {unassigned === 1 ? "item" : "items"} with nobody on it
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* The teams themselves, so the card names who is behind rather than
            only counting units. Each row opens that team's tab. */}
        <div className="space-y-1 border-t pt-3">
          {teams.map((t) => {
            const teamPct = pctMade(t.planned, t.made)
            const selected = t.key === activeTeam
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onTeamSelect?.(t.key)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "hover:bg-muted/50 flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left transition-colors",
                  selected && "bg-muted/60",
                )}
              >
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full", DELIVERABLE_STATUS_DOT[t.status])}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {t.made}/{t.planned}
                </span>
                <ProgressBar value={teamPct} className="hidden w-24 shrink-0 sm:block" />
                <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
                  {teamPct}%
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
