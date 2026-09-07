"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { PackageCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import {
  useDeliverablesOverview,
  type DeliverablesOverview,
  type TypeCount,
} from "../hooks/use-deliverables"
import { formatHours } from "../lib/format-hours"
import { Tip } from "./portfolio-charts"

// ─────────────────────────────────────────────────────────────────────────────
// Output on the Progress page: what was MADE, in the range.
//
// The tiles above count tasks, the goals strip says whether the plan is met;
// this is the third question - what actually came out. Follows the date range
// (deliverables are dated outputs; "this week" is exactly the question) and the
// project picker.
//
// Types are open-ended, so they get a categorical palette assigned by RANK -
// the biggest type is always the first colour - and every legend entry carries
// its count, so hue is never the only signal. The hues are deliberately not the
// task-state ones: on this page blue means "in progress" and emerald "done",
// and a type wearing either would read as a state.
// ─────────────────────────────────────────────────────────────────────────────

const PALETTE = [
  "#8b5cf6",
  "#06b6d4",
  "#d946ef",
  "#6366f1",
  "#14b8a6",
  "#84cc16",
  "#0ea5e9",
  "#f43f5e",
]
const colourOf = (rank: number) => PALETTE[rank % PALETTE.length]!

const datumOf = <T,>(d: unknown): T | undefined =>
  (d as { payload?: T } | undefined)?.payload ?? (d as T | undefined)

export interface OutputFilter {
  projectId?: string
  employeeId?: string
  teamId?: string
  type?: string
  /**
   * What the popup should call itself. Built HERE, where the names already
   * are - the same call-site pattern the task charts use for their team and
   * person drill-downs, rather than making the popup re-look-up an id.
   */
  title?: string
  subtitle?: string
}

/**
 * Mirrors the sentinel in deliverables.queries.ts: a byTeam row whose id starts
 * with this is output logged WITHOUT a team, so there is no team to filter by
 * and clicking it opens the project instead.
 */
const NO_TEAM = "__no_team__"

const teamless = (id: string) => id.startsWith(`${NO_TEAM}:`)

/**
 * Across clients a bare "WEB" is ambiguous - half the accounts have one - so
 * the bar carries its project. The axis is 116px, so the full name only gets
 * used when it fits; past that the code says the same thing in four characters.
 */
function teamBars(byTeam: DeliverablesOverview["byTeam"], single: boolean) {
  return byTeam.map((t) => ({
    id: t.id,
    name: single
      ? t.name
      : `${t.name} · ${t.projectName.length > 12 ? t.projectCode : t.projectName}`,
    count: t.count,
  }))
}

/** One labelled chart slot. Keeps the four panels' headings identical. */
function Panel({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-[11px] font-medium">
        {label}
        {hint && <span className="ml-1.5 font-normal opacity-70">{hint}</span>}
      </p>
      {children}
    </div>
  )
}

/** Donut of the type mix, count in the hole. Click a slice or a legend entry. */
export function TypeDonut({
  byType,
  total,
  height = 200,
  onPick,
}: {
  byType: TypeCount[]
  total: number
  height?: number
  onPick?: (type: string) => void
}) {
  // Past eight, the tail is a sliver each; fold it so the legend stays legible.
  const top = byType.slice(0, 7)
  const rest = byType.slice(7).reduce((s, t) => s + t.count, 0)
  const slices = [...top, ...(rest > 0 ? [{ type: "Other types", count: rest }] : [])]
  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="type"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={2}
              strokeWidth={0}
              onClick={(d: unknown) => {
                const t = datumOf<{ type: string }>(d)?.type
                if (t && t !== "Other types" && onPick) onPick(t)
              }}
              style={onPick ? { cursor: "pointer" } : undefined}
            >
              {slices.map((s, i) => (
                <Cell key={s.type} fill={colourOf(i)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <Tip
                    title={String(payload[0]!.name)}
                    rows={[
                      { label: "Made", value: String(payload[0]!.value) },
                      {
                        label: "Share",
                        value: `${Math.round((Number(payload[0]!.value) / Math.max(1, total)) * 100)}%`,
                      },
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{total}</span>
          <span className="text-muted-foreground text-[11px]">made</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
        {slices.map((s, i) => {
          const inner = (
            <>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: colourOf(i) }}
              />
              <span className="text-muted-foreground">{s.type}</span>
              <span className="font-medium tabular-nums">{s.count}</span>
            </>
          )
          return onPick && s.type !== "Other types" ? (
            <button
              key={s.type}
              type="button"
              onClick={() => onPick(s.type)}
              className="hover:bg-muted flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs"
            >
              {inner}
            </button>
          ) : (
            <span key={s.type} className="flex items-center gap-1.5 px-1.5 py-0.5 text-xs">
              {inner}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** One bar per row, single series. Click a bar to open it. */
export function CountBars({
  rows,
  onPick,
  height,
}: {
  rows: { id: string; name: string; count: number }[]
  onPick?: (id: string) => void
  height?: number
}) {
  const data = rows.slice(0, 10)
  if (data.length === 0)
    return <EmptyState icon={PackageCheck} compact title="Nothing made in this scope." />
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(160, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
        barCategoryGap="28%"
      >
        <XAxis
          type="number"
          allowDecimals={false}
          stroke="var(--viz-axis)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={116}
          stroke="var(--viz-axis)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--viz-grid)", opacity: 0.35 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Tip
                title={String(label)}
                rows={[
                  { label: "Made", value: String(payload[0]!.value) },
                  ...(onPick ? [{ label: "Click", value: "to open" }] : []),
                ]}
              />
            ) : null
          }
        />
        <Bar
          dataKey="count"
          fill="var(--viz-1)"
          radius={2}
          style={onPick ? { cursor: "pointer" } : undefined}
          onClick={(d: unknown) => {
            const row = datumOf<{ id: string }>(d)
            if (row?.id && onPick) onPick(row.id)
          }}
        />
      </BarChart>
    </ResponsiveContainer>
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
  tone?: "bad" | "warn"
}) {
  return (
    <div className="bg-muted/40 rounded-sm px-3 py-2">
      <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">
        {value}
        {sub && (
          <span
            className={cn(
              "ml-1 text-xs font-normal",
              tone === "bad"
                ? "text-destructive"
                : tone === "warn"
                  ? "text-amber-500"
                  : "text-muted-foreground",
            )}
          >
            {sub}
          </span>
        )}
      </p>
    </div>
  )
}

export function DeliverablesOutputCard({
  projectId,
  range,
  scopeLabel,
  onOpen,
}: {
  projectId?: string
  range: { from?: string | null; to?: string | null }
  /** "in the week of…" / "all time" - what the numbers are numbers OF. */
  scopeLabel: string
  onOpen: (f: OutputFilter) => void
}) {
  const { data, isLoading } = useDeliverablesOverview({ projectId, from: range.from, to: range.to })
  if (isLoading && !data) return <Skeleton className="h-64 rounded-sm" />
  const single = Boolean(projectId)
  const empty = !data || data.entries === 0

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <PackageCheck className="h-4 w-4" /> Output
          </p>
          <p className="text-muted-foreground text-xs">
            What was actually made, {scopeLabel} · click anything to see the entries
          </p>
        </div>

        {empty ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nothing logged {scopeLabel}. People log what they made from a project&apos;s
            Deliverables tab, or from My Tasks.
          </p>
        ) : (
          <>
            {/* Made is what came out; Owed is what has not, and the two belong
                side by side - a strong week that leaves a bigger backlog is
                not a strong week. The type count that used to sit here is
                repeated in the donut's legend directly below, so it goes. */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <button type="button" onClick={() => onOpen({ projectId })} className="text-left">
                <Tile
                  label="Made"
                  value={data.total}
                  sub={`${data.entries} ${data.entries === 1 ? "entry" : "entries"}`}
                />
              </button>
              <Tile
                label="Owed"
                value={data.planned.quantity}
                sub={data.planned.overdue > 0 ? `${data.planned.overdue} overdue` : undefined}
                tone="bad"
              />
              <Tile
                label="Awaiting revision"
                value={data.byStatus.find((b) => b.status === "REJECTED")?.quantity ?? 0}
                tone="warn"
              />
              <Tile
                label="Hours/unit"
                value={data.hours.perUnit === null ? "-" : formatHours(data.hours.perUnit)}
                sub={data.hours.perUnit === null ? undefined : `covers ${data.hours.coverage}%`}
              />
              <Tile label="People" value={data.byPerson.length} />
              <Tile
                label="Top type"
                value={data.byType[0]?.type ?? "-"}
                sub={data.byType[0] ? String(data.byType[0].count) : undefined}
              />
            </div>

            <div className={cn("mt-4 grid gap-4", single ? "lg:grid-cols-3" : "lg:grid-cols-3")}>
              <div>
                <p className="text-muted-foreground mb-1 text-[11px] font-medium">By type</p>
                <TypeDonut
                  byType={data.byType}
                  total={data.total}
                  onPick={(type) => onOpen({ projectId, type })}
                />
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-[11px] font-medium">
                  {single ? "By team" : "By client"}
                </p>
                <CountBars
                  rows={single ? data.byTeam : data.byProject}
                  onPick={(id) => onOpen(single ? { projectId, teamId: id } : { projectId: id })}
                />
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-[11px] font-medium">By person</p>
                <CountBars
                  rows={data.byPerson}
                  onPick={(id) => onOpen({ projectId, employeeId: id })}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
