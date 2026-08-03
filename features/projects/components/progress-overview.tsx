"use client"

import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Timer } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { cn, formatDate } from "@/lib/utils"
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS } from "@/lib/constants"
import { useProjectProgress, type ProgressBucket } from "../hooks/use-projects"
import { formatHours } from "../lib/format-hours"

// =============================================================================
// Progress at a glance, on the project Overview.
//
// Scoped by who is looking. A manager gets the PROJECT: overall delivery, the
// weekly pace, and how each team is doing. Everyone else gets THEIR OWN slice of
// it, because "the project is 60% done" is not actionable to someone who wants
// to know what they personally still owe.
//
// The full breakdown lives on the Progress tab; this is the summary that makes
// you go there.
//
// Charts follow the house data-viz rules: two categorical slots in fixed order
// (never cycled), one axis per chart, recessive chrome, a legend whenever there
// are two series, and a tooltip on every mark. Rates are null when there is
// nothing to measure and render as a dash, never as 0%.
// =============================================================================

const AXIS = "var(--viz-axis)"
const GRID = "var(--viz-grid)"
const SERIES_1 = "var(--viz-1)"
const SERIES_2 = "var(--viz-2)"

/** Shared tooltip shell, so every chart's hover reads the same. */
function TipShell({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="bg-popover rounded border p-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="text-muted-foreground flex items-center gap-3">
          <span>{r.label}</span>
          <span className="text-foreground ml-auto font-medium tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

/** A headline number is a stat tile, not a chart. */
function Stat({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "good" | "warn" | "bad"
  icon?: typeof Clock
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground flex items-center gap-1 text-[10px] tracking-wide uppercase">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-xl font-semibold",
          tone === "good" && "text-emerald-600 dark:text-emerald-500",
          tone === "warn" && "text-amber-600 dark:text-amber-500",
          tone === "bad" && "text-red-600 dark:text-red-500",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-muted-foreground truncate text-[11px]">{hint}</p>}
    </div>
  )
}

/**
 * Status mix as a single stacked bar. These are STATUS colours, not series
 * colours, and each segment carries a labelled swatch so the state never rests
 * on hue alone.
 */
function StatusMix({ b }: { b: ProgressBucket }) {
  if (b.total === 0) return null
  const seg = [
    { n: b.done, cls: "bg-emerald-500", label: "Done" },
    { n: b.inProgress, cls: "bg-blue-500", label: "In progress" },
    { n: b.todo, cls: "bg-slate-400", label: "To do" },
    { n: b.onHold, cls: "bg-amber-500", label: "On hold" },
    { n: b.discarded, cls: "bg-red-400", label: "Discarded" },
  ].filter((s) => s.n > 0)

  return (
    <div className="space-y-2">
      {/* gap-0.5 is the 2px surface gap between adjacent fills. */}
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden">
        {seg.map((s) => (
          <div
            key={s.label}
            className={cn("rounded-[2px]", s.cls)}
            style={{ width: `${(s.n / b.total) * 100}%` }}
            title={`${s.label}: ${s.n}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {seg.map((s) => (
          <span key={s.label} className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <span className={cn("h-2 w-2 rounded-[2px]", s.cls)} />
            {s.label} {s.n}
          </span>
        ))}
      </div>
    </div>
  )
}

const pct = (v: number | null) => (v == null ? "-" : `${v.toFixed(0)}%`)

export function ProgressOverview({
  projectId,
  currentUserId,
  isAdmin,
}: {
  projectId: string
  currentUserId: string
  /** Managers see the project; everyone else sees only their own work. */
  isAdmin: boolean
}) {
  const { data, isLoading } = useProjectProgress(projectId)

  if (isLoading) return <Skeleton className="h-64 rounded" />
  if (!data) return null

  const mine = data.byMember.find((m) => m.id === currentUserId) ?? null
  const bucket: ProgressBucket | null = isAdmin ? data.summary : mine
  const heading = isAdmin ? "Project progress" : "My progress"

  // Someone with no tasks here gets told that plainly rather than a wall of dashes.
  if (!bucket || bucket.total === 0) {
    return (
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">{heading}</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            {isAdmin ? "No tasks on this project yet." : "You have no tasks on this project yet."}
          </p>
        </CardContent>
      </Card>
    )
  }

  const upcoming = (
    isAdmin ? data.upcoming : data.upcoming.filter((t) => t.assigneeId === currentUserId)
  ).slice(0, 5)

  const trend = data.trend.map((w) => ({
    ...w,
    // Axis ticks are short; the tooltip carries the full date.
    label: new Date(w.weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  }))
  const hasTrend = trend.some((w) => w.completed > 0 || w.due > 0)

  const teams = data.byTeam
    .filter((t) => t.total > 0)
    .map((t) => ({ ...t, rate: t.completionRate ?? 0 }))

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{heading}</h3>
            <p className="text-muted-foreground text-xs">
              {isAdmin
                ? "Delivery across every team on this project."
                : "Your tasks on this project."}
            </p>
          </div>
          <Link
            href="/projects/progress"
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs"
          >
            {isAdmin ? "All projects" : "My progress"}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Completed"
            value={pct(bucket.completionRate)}
            hint={`${bucket.done} of ${bucket.total} tasks`}
            tone={
              bucket.completionRate == null
                ? "default"
                : bucket.completionRate >= 80
                  ? "good"
                  : bucket.completionRate >= 50
                    ? "warn"
                    : "bad"
            }
            icon={CheckCircle2}
          />
          <Stat
            label="On time"
            value={pct(bucket.onTimeRate)}
            hint={
              bucket.onTimeRate == null
                ? "nothing finished yet"
                : `${bucket.onTime} on time, ${bucket.late} late`
            }
            tone={bucket.onTimeRate == null ? "default" : bucket.onTimeRate >= 85 ? "good" : "warn"}
            icon={Clock}
          />
          <Stat
            label="Overdue"
            value={String(bucket.overdue)}
            hint={bucket.overdue > 0 ? "past due, still open" : "nothing late"}
            tone={bucket.overdue > 0 ? "bad" : "good"}
            icon={AlertTriangle}
          />
          <Stat
            label="Time"
            value={formatHours(bucket.loggedHours)}
            hint={
              bucket.estimatedHours > 0
                ? `of ${formatHours(bucket.estimatedHours)} allocated`
                : "no allocation set"
            }
            tone={
              bucket.estimatedHours > 0 && bucket.loggedHours > bucket.estimatedHours
                ? "warn"
                : "default"
            }
            icon={Timer}
          />
        </div>

        <StatusMix b={bucket} />

        <div className={cn("grid gap-5", isAdmin && teams.length > 1 ? "lg:grid-cols-2" : "")}>
          {/* Weekly pace. Two series, so a legend is mandatory. One y-axis:
              both series are task counts, so they share a scale honestly. */}
          {hasTrend && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium">Weekly pace</p>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <span
                      className="h-0.5 w-3 rounded-[2px]"
                      style={{ backgroundColor: SERIES_1 }}
                    />
                    Completed
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <span
                      className="h-0.5 w-3 rounded-[2px]"
                      style={{ backgroundColor: SERIES_2 }}
                    />
                    Due
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: AXIS, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: AXIS, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ stroke: GRID }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <TipShell
                          title={`Week of ${label}`}
                          rows={payload.map((p) => ({
                            label: String(p.name),
                            value: String(p.value),
                          }))}
                        />
                      ) : null
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke={SERIES_1}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0, fill: SERIES_1 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="due"
                    name="Due"
                    stroke={SERIES_2}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0, fill: SERIES_2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Completion by team. One series, so no legend box - the title names
              it - and every bar is directly labelled with its own value. */}
          {isAdmin && teams.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-medium">Completion by team</p>
              <ResponsiveContainer width="100%" height={Math.max(120, teams.length * 34)}>
                <BarChart
                  data={teams}
                  layout="vertical"
                  margin={{ top: 0, right: 34, bottom: 0, left: 0 }}
                  barCategoryGap={6}
                >
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: AXIS, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: AXIS, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip
                    cursor={{ fill: GRID, fillOpacity: 0.25 }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <TipShell
                          title={String(payload[0]!.payload.name)}
                          rows={[
                            { label: "Completed", value: `${payload[0]!.payload.done}` },
                            { label: "Total", value: `${payload[0]!.payload.total}` },
                            { label: "Overdue", value: `${payload[0]!.payload.overdue}` },
                          ]}
                        />
                      ) : null
                    }
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={14}>
                    {teams.map((t) => (
                      <Cell key={t.id} fill={SERIES_1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* What is actually next. */}
        {upcoming.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium">{isAdmin ? "Due next" : "Your next tasks"}</p>
            <ul className="divide-border/60 divide-y">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <StatusBadge
                    status={t.priority}
                    colorMap={TASK_PRIORITY_COLORS}
                    labelMap={TASK_PRIORITY_LABELS}
                    size="xs"
                  />
                  {isAdmin && t.assigneeName && (
                    <span className="text-muted-foreground hidden shrink-0 sm:inline">
                      {t.assigneeName}
                    </span>
                  )}
                  {t.overdue ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 gap-1 border-red-300 py-0 text-[10px] text-red-600"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {formatDate(t.dueDate)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {formatDate(t.dueDate)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
