"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { Target, ChevronRight, CalendarDays, TriangleAlert, ArrowUpRight } from "lucide-react"

import { Link } from "@/components/tenant-link"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { projectHref } from "../lib/project-href"
import {
  ProgressBar,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_STYLE,
  StatusBadge,
  fmtDate,
  type GoalNode,
  type Status,
} from "./goal-status"
import { Tip } from "./portfolio-charts"

// ─────────────────────────────────────────────────────────────────────────────
// Goals on the Progress page.
//
// The tiles above count TASKS - what people are doing. Goals are what the work
// was supposed to add up to. A portfolio view that reports throughput without
// reporting whether the plan is being met is half an answer, and until this
// strip the two lived on different pages.
//
// ── A STRIP, NOT A LIST ──────────────────────────────────────────────────────
// One row per project with a bar and its two warning counts; the detail (the
// goal tree) lives in the drill-down, like everything else on this page. The
// first version expanded inline and was the only thing on the page that did -
// it read as a different app.
//
// ── ALWAYS AS OF TODAY ───────────────────────────────────────────────────────
// The page's date range filters tasks by due date. Goals target months out, so
// "This week" would blank this strip on almost every load. It follows the
// project picker, not the dates, and says so.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectGoalsRow {
  projectId: string
  projectName: string
  projectCode: string
  projectSlug: string | null
  overallProgress: number
  totalGoals: number
  doneGoals: number
  overdueGoals: number
  atRiskGoals: number
  discardedGoals: number
  nextTargetDate: string | null
  goals: GoalNode[]
}

export interface GoalsPortfolio {
  projects: ProjectGoalsRow[]
  totals: {
    projectsWithGoals: number
    projectsWithoutGoals: number
    totalGoals: number
    doneGoals: number
    overdueGoals: number
    atRiskGoals: number
    overallProgress: number
    nextTargetDate: string | null
  }
  allTags: string[]
}

/** One query key for the strip and the drill-down, so the popup opens from cache. */
export function useGoalsPortfolio(projectId?: string) {
  return useQuery({
    queryKey: ["goals-portfolio", projectId ?? "all"],
    queryFn: () =>
      apiFetch<{ data: GoalsPortfolio }>(
        `/api/projects/goals${projectId ? `?projectId=${projectId}` : ""}`,
      ).then((r) => r.data),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
}

/** Main goals by state across the scope - the goals twin of the task donut. */
export function goalStateMix(rows: ProjectGoalsRow[]) {
  const tally = new Map<Status, number>(STATUS_ORDER.map((s) => [s, 0]))
  for (const r of rows) for (const g of r.goals) tally.set(g.status, (tally.get(g.status) ?? 0) + 1)
  return STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    fill: STATUS_STYLE[status].fill,
    value: tally.get(status) ?? 0,
  }))
}

/** Small donut of goal states, with the overall % in the hole. */
export function GoalDonut({
  rows,
  overall,
  height = 150,
}: {
  rows: ProjectGoalsRow[]
  overall: number
  height?: number
}) {
  const mix = goalStateMix(rows)
  const total = mix.reduce((s, m) => s + m.value, 0)
  const slices = mix.filter((m) => m.value > 0)
  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="60%"
              outerRadius="88%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {slices.map((s) => (
                <Cell key={s.status} fill={s.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <Tip
                    title={String(payload[0]!.name)}
                    rows={[
                      { label: "Goals", value: String(payload[0]!.value) },
                      {
                        label: "Share",
                        value: `${Math.round((Number(payload[0]!.value) / total) * 100)}%`,
                      },
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums">{overall}%</span>
          <span className="text-muted-foreground text-[10px]">overall</span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {mix.map((m) => (
          <span key={m.status} className="flex items-center gap-1 text-[11px]">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: m.fill }} />
            <span className="text-muted-foreground">{m.label}</span>
            <span className="font-medium tabular-nums">{m.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** One goal and its sub-goals, read-only. The detail behind a project row. */
export function GoalTree({ goals }: { goals: GoalNode[] }) {
  if (goals.length === 0) {
    return <p className="text-muted-foreground py-4 text-center text-sm">No goals set.</p>
  }
  return (
    <div className="space-y-4">
      {goals.map((goal) => (
        <div key={goal.id} className="border-border/60 border-l-2 pl-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-medium", STATUS_STYLE[goal.status].title)}>
              {goal.title}
            </span>
            <StatusBadge status={goal.status} />
            {goal.overdue && (
              <span className="text-destructive inline-flex items-center gap-1 text-[11px] font-medium">
                <TriangleAlert className="h-3 w-3" /> Past target
              </span>
            )}
            {goal.tags.map((t) => (
              <span
                key={t}
                className="border-border/70 text-muted-foreground rounded-full border px-1.5 py-0.5 text-[10px]"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {fmtDate(goal.targetDate)}
            </span>
            {goal.progressIsDerived && (
              <span className="tabular-nums">
                {goal.doneChildren} of {goal.countableChildren} sub-goals done · {goal.progress}%
              </span>
            )}
            {goal.createdByName && <span>set by {goal.createdByName}</span>}
          </p>
          {goal.progressIsDerived && <ProgressBar value={goal.progress} className="mt-1.5 w-40" />}
          {/* The reason a goal is at risk or was dropped is the most useful line
              here - it is the bit a status colour cannot carry. */}
          {goal.statusReason && (
            <p className="text-muted-foreground border-border/60 mt-1 border-l-2 pl-2 text-[11px] italic">
              {goal.statusReason}
            </p>
          )}
          {goal.children.length > 0 && (
            <ul className="mt-2 space-y-1">
              {goal.children.map((sub) => (
                <li key={sub.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      STATUS_STYLE[sub.status].dot,
                    )}
                  />
                  <span className={STATUS_STYLE[sub.status].title}>{sub.title}</span>
                  <span className="text-muted-foreground">{fmtDate(sub.targetDate)}</span>
                  <span className={cn("text-[10px]", STATUS_STYLE[sub.status].text)}>
                    {STATUS_LABEL[sub.status]}
                  </span>
                  {sub.overdue && <span className="text-destructive">past target</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string | number
  sub?: string
  tone?: "bad" | "warn" | "accent"
}) {
  return (
    <div className="bg-muted/40 rounded-[6px] px-3 py-2">
      <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums",
          tone === "accent" && "text-primary",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-amber-500",
        )}
      >
        {value}
        {sub && <span className="text-muted-foreground ml-1 text-xs font-normal">{sub}</span>}
      </p>
    </div>
  )
}

/** One project's line in the strip. Click opens its goals in the drill-down. */
function ProjectRow({ row, onOpen }: { row: ProjectGoalsRow; onOpen: () => void }) {
  if (row.totalGoals === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <span className="text-muted-foreground text-sm">{row.projectName}</span>
        <Link
          href={projectHref({ id: row.projectId, slug: row.projectSlug }, "goals")}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-4"
        >
          No goals set <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hover:bg-muted/40 flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-left transition-colors"
    >
      <span className="min-w-40 flex-1">
        <span className="text-sm font-medium">{row.projectName}</span>
        <span className="text-muted-foreground ml-2 text-[11px]">{row.projectCode}</span>
      </span>
      {row.overdueGoals > 0 && (
        <span className="text-destructive inline-flex shrink-0 items-center gap-1 text-[11px] font-medium">
          <TriangleAlert className="h-3 w-3" />
          {row.overdueGoals} overdue
        </span>
      )}
      {row.atRiskGoals > 0 && (
        <span className="shrink-0 text-[11px] font-medium text-amber-500">
          {row.atRiskGoals} at risk
        </span>
      )}
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {row.doneGoals}/{row.totalGoals} done
      </span>
      <span className="w-36 shrink-0">
        <span className="flex items-baseline justify-between">
          <span className="text-muted-foreground text-[10px]">
            {row.nextTargetDate ? fmtDate(row.nextTargetDate) : "No date"}
          </span>
          <span className="text-xs font-semibold tabular-nums">{row.overallProgress}%</span>
        </span>
        <ProgressBar value={row.overallProgress} className="mt-1" />
      </span>
      <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
    </button>
  )
}

export function GoalsProgressCard({
  projectId,
  onOpen,
}: {
  projectId?: string
  /** Open the goals drill-down - for one project, or for the whole scope. */
  onOpen: (projectId?: string) => void
}) {
  const { data, isLoading } = useGoalsPortfolio(projectId)
  if (isLoading && !data) return <Skeleton className="h-48 rounded" />

  const t = data?.totals
  const rows = data?.projects ?? []
  const single = Boolean(projectId)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Target className="h-4 w-4" /> Goals
          </p>
          <p className="text-muted-foreground text-xs">
            What the work is meant to add up to · as of today, not the date range
          </p>
        </div>

        {!t || t.totalGoals === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {single
              ? "This project has no goals set yet."
              : "No goals set on any project you can see yet."}
          </p>
        ) : (
          <div className="mt-3 grid gap-4 lg:grid-cols-[180px_1fr]">
            <button
              type="button"
              onClick={() => onOpen(projectId)}
              className="hover:bg-muted/40 rounded-[6px] p-1 text-left transition-colors"
              title="Open every goal in this scope"
            >
              <GoalDonut rows={rows} overall={t.overallProgress} />
            </button>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tile label="Done" value={t.doneGoals} sub={`/ ${t.totalGoals}`} />
                <Tile
                  label="At risk"
                  value={t.atRiskGoals}
                  tone={t.atRiskGoals > 0 ? "warn" : undefined}
                />
                <Tile
                  label="Overdue"
                  value={t.overdueGoals}
                  tone={t.overdueGoals > 0 ? "bad" : undefined}
                />
                <Tile
                  label="Next target"
                  value={t.nextTargetDate ? fmtDate(t.nextTargetDate) : "None"}
                />
              </div>
              {!single && (
                <p className="text-muted-foreground text-[11px]">
                  Overall averages the {t.projectsWithGoals} project
                  {t.projectsWithGoals === 1 ? "" : "s"} with goals
                  {t.projectsWithoutGoals > 0 &&
                    ` · ${t.projectsWithoutGoals} project${t.projectsWithoutGoals === 1 ? " has" : "s have"} none set`}
                  . Click a row for its goals.
                </p>
              )}
              <div className="divide-border/60 border-border/60 max-h-64 divide-y overflow-y-auto rounded-[6px] border">
                {rows.map((r) => (
                  <ProjectRow key={r.projectId} row={r} onOpen={() => onOpen(r.projectId)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
