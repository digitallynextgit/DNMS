"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock3, Inbox, Undo2 } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressSkeleton } from "./progress-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import type { DateRangeValue } from "@/components/shared/date-range-field"
import { apiFetch } from "@/lib/api-fetch"
import { cn, formatDate } from "@/lib/utils"
import {
  DELIVERABLE_STATUS_LABELS,
  STATUS_ORDER,
  type DeliverableStatus,
} from "../lib/deliverable-lifecycle"
import { sortProjectTeams } from "../lib/project-teams"
import { ProgressKpiDialog, type KpiKey } from "./progress-kpi-dialog"
import type {
  DeliverablesProgress,
  ProgressGroup,
  ProgressItem,
  ProgressTotals,
} from "../lib/deliverables-progress"

// Same route as the slide deck, so the two never disagree; the server decides what each role may see.

type Role = "admin" | "account_manager" | "team_manager" | "member"

interface ScopeData {
  role: Role
  projects: { id: string; name: string; code: string | null }[]
  teams: { id: string; name: string; projectId: string; projectName: string; memberCount: number }[]
  people: { id: string; name: string; designation: string | null; teamIds: string[] }[]
}

const ROLE_CAPTION: Record<Role, string> = {
  admin: "Everything in the company",
  account_manager: "The projects you own",
  team_manager: "Your team",
  member: "Your own deliverables",
}

const STATUS_COLOR: Record<DeliverableStatus, string> = {
  PLANNED: "var(--state-todo)",
  IN_PROGRESS: "var(--state-progress)",
  DELIVERED: "var(--state-done)",
  ACCEPTED: "var(--state-done)",
  REJECTED: "var(--state-overdue)",
  // Stuck shares the overdue hue: it is work that has stopped moving.
  STUCK: "var(--state-overdue)",
  DISCARDED: "var(--state-todo)",
}
// Delivered and accepted share a hue; the lighter one isn't signed off by the client yet.
const STATUS_OPACITY: Record<DeliverableStatus, number> = {
  PLANNED: 1,
  IN_PROGRESS: 1,
  DELIVERED: 0.55,
  ACCEPTED: 1,
  REJECTED: 1,
  STUCK: 1,
  DISCARDED: 0.4,
}

const ALL = "all"

const pctOf = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100))
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export interface ProgressFilterState {
  projectId: string
  team: string
  teamIds: string[]
  personId: string
  projectLabel?: string
  teamLabel?: string
  personLabel?: string
  totalCount?: number
}

interface MyProgressProps {
  /** The window, picked in the page header so this panel and the Slides deck read the same one. */
  range: DateRangeValue
  onFilterChange?: (filters: ProgressFilterState) => void
}

export function MyProgress({ range, onFilterChange }: MyProgressProps) {
  const [projectId, setProjectId] = useState(ALL)
  const [team, setTeam] = useState(ALL)
  const [personId, setPersonId] = useState(ALL)

  // Same key as the slides dialog, so opening it costs nothing extra.
  const scope = useQuery({
    queryKey: ["deliverables-report-scope"],
    queryFn: () =>
      apiFetch<{ data: ScopeData }>("/api/projects/deliverables/report/scope").then((r) => r.data),
    staleTime: 60_000,
  })

  // The teams are the same on every project, so a team NAME maps back to every id it stands for.
  const teamNames = useMemo(() => {
    const seen = new Set<string>()
    for (const t of scope.data?.teams ?? []) {
      if (projectId === ALL || t.projectId === projectId) seen.add(t.name)
    }
    return sortProjectTeams([...seen].map((name) => ({ name }))).map((t) => t.name)
  }, [scope.data, projectId])
  const teamIds = useMemo(
    () =>
      team === ALL
        ? []
        : (scope.data?.teams ?? [])
            .filter((t) => t.name === team && (projectId === ALL || t.projectId === projectId))
            .map((t) => t.id),
    [scope.data, team, projectId],
  )

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (range.from) p.set("from", range.from)
    if (range.to) p.set("to", range.to)
    if (projectId !== ALL) p.set("projectIds", projectId)
    if (teamIds.length) p.set("teamIds", teamIds.join(","))
    if (personId !== ALL) p.set("employeeIds", personId)
    return p.toString()
  }, [range.from, range.to, projectId, teamIds, personId])

  const progress = useQuery({
    queryKey: ["deliverables-progress", qs],
    queryFn: () =>
      apiFetch<{ data: DeliverablesProgress }>(
        `/api/projects/deliverables/progress${qs ? `?${qs}` : ""}`,
      ).then((r) => r.data),
    staleTime: 30_000,
    // Keep the last numbers on screen while a new filter loads.
    placeholderData: (prev) => prev,
  })

  const sc = scope.data
  const showProjects = (sc?.projects.length ?? 0) > 1
  const showTeams = teamNames.length > 1
  const showPeople = sc?.role !== "member" && (sc?.people.length ?? 0) > 1

  // Falls back to everyone when the filter would leave nobody.
  const people = useMemo(() => {
    if (!sc) return []
    const teamsHere = teamIds.length
      ? new Set(teamIds)
      : projectId === ALL
        ? null
        : new Set(sc.teams.filter((t) => t.projectId === projectId).map((t) => t.id))
    const narrowed = teamsHere
      ? sc.people.filter((p) => p.teamIds.some((id) => teamsHere.has(id)))
      : sc.people
    return narrowed.length ? narrowed : sc.people
  }, [sc, projectId, teamIds])

  const pickProject = (id: string) => {
    setProjectId(id)
    // A chosen team survives a project switch unless that project lacks it (legacy data).
    const stillThere =
      team === ALL ||
      (sc?.teams.some((t) => t.name === team && (id === ALL || t.projectId === id)) ?? false)
    if (!stillThere) setTeam(ALL)
    setPersonId(ALL)
  }
  const pickTeam = (name: string) => {
    setTeam(name)
    setPersonId(ALL)
  }
  const pickPerson = (id: string) => {
    if (id === ALL || sc?.people.some((p) => p.id === id)) setPersonId(id)
  }

  const data = progress.data
  const me = data?.me

  useEffect(() => {
    if (!onFilterChange) return
    const projectObj = sc?.projects.find((p) => p.id === projectId)
    const personObj = sc?.people.find((p) => p.id === personId)
    onFilterChange({
      projectId,
      team,
      teamIds,
      personId,
      projectLabel: projectId === ALL ? "All projects" : projectObj?.name,
      teamLabel: team === ALL ? "All teams" : team,
      personLabel: personId === ALL ? "Whole team" : personObj?.name,
      totalCount: data?.totals.total,
    })
  }, [projectId, team, teamIds, personId, sc, data?.totals.total, onFilterChange])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {sc ? (
          <p className="text-muted-foreground text-xs">
            {ROLE_CAPTION[sc.role]}
            {sc.role !== "member" && (
              <>
                {" "}
                · {plural(sc.projects.length, "project")} ·{" "}
                {plural(sc.people.length, "person", "people")}
              </>
            )}
            {sc.role === "member" && <> · {plural(sc.projects.length, "project")}</>}
          </p>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
        {sc ? (
          (showProjects || showTeams || showPeople) && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {showProjects && (
                <Select value={projectId} onValueChange={pickProject}>
                  <SelectTrigger className="w-[190px]" aria-label="Project">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All projects</SelectItem>
                    {sc?.projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {showTeams && (
                <Select value={team} onValueChange={pickTeam}>
                  <SelectTrigger className="w-[150px]" aria-label="Team">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All teams</SelectItem>
                    {teamNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {showPeople && (
                <Select value={personId} onValueChange={pickPerson}>
                  <SelectTrigger className="w-[190px]" aria-label="Team member">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Whole team</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.id === me ? `${p.name} (me)` : p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )
        ) : (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-[190px]" />
            <Skeleton className="h-9 w-[150px]" />
            <Skeleton className="h-9 w-[190px]" />
          </div>
        )}
      </div>

      {progress.isError && !data ? (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load your deliverables"
          description="Try again in a moment."
          variant="card"
        />
      ) : !data ? (
        <ProgressSkeleton />
      ) : data.totals.total === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing in this window"
          description="No deliverables were due, worked on or finished in it. Widen the window or pick another project."
          variant="card"
        />
      ) : (
        <div className={cn("space-y-6", progress.isFetching && "opacity-70 transition-opacity")}>
          <KpiRow data={data} />

          <div className="grid gap-6 lg:grid-cols-5">
            <StatusCard t={data.totals} className="lg:col-span-2" />
            <GroupCard
              title="By project"
              what="Project"
              rows={data.byProject}
              onPick={showProjects && projectId === ALL ? pickProject : undefined}
              tableId="progress-by-project"
              itemLabel="project"
              pageKey={qs}
              className="lg:col-span-3"
            />
          </div>

          {data.byPerson.length > 1 && (
            <GroupCard
              title="By team member"
              what="Person"
              rows={data.byPerson}
              onPick={showPeople ? pickPerson : undefined}
              tableId="progress-by-person"
              itemLabel="team member"
              pageKey={qs}
            />
          )}

          {data.truncated && (
            <p className="text-muted-foreground text-xs">
              Showing the first 1,500 deliverables only - narrow the window or pick a project for
              exact numbers.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

type Tone = "default" | "good" | "warn" | "bad"

const TONE: Record<Tone, string> = {
  default: "text-foreground",
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
}

function KpiRow({ data }: { data: DeliverablesProgress }) {
  const t = data.totals
  const [open, setOpen] = useState<KpiKey | null>(null)
  const tiles: {
    key: KpiKey
    label: string
    value: string | number
    sub: string
    icon: React.ElementType
    tone: Tone
  }[] = [
    {
      key: "todo",
      label: "To do",
      value: t.open,
      sub: t.overdue ? `${t.overdue} overdue` : "nothing overdue",
      icon: Clock3,
      tone: t.overdue ? "bad" : "default",
    },
    {
      key: "completed",
      label: "Completed",
      value: t.done,
      sub: `${t.pct}% of ${t.total}`,
      icon: CheckCircle2,
      tone: "good",
    },
    {
      key: "overdue",
      label: "Overdue now",
      value: t.overdue,
      sub: "past due and still open",
      icon: AlertTriangle,
      tone: t.overdue ? "bad" : "default",
    },
    {
      key: "sentBack",
      label: "Sent back",
      value: t.sentBack,
      sub: "awaiting rework",
      icon: Undo2,
      tone: t.sentBack ? "warn" : "default",
    },
  ]
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((k) => (
          <Card
            key={k.key}
            role="button"
            tabIndex={0}
            aria-label={`${k.label}: ${k.value}. Show the list`}
            onClick={() => setOpen(k.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setOpen(k.key)
              }
            }}
            className="hover:border-foreground/25 hover:bg-muted/40 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <CardContent className="p-4">
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>{k.label}</span>
                <k.icon className={cn("h-3.5 w-3.5", TONE[k.tone])} />
              </div>
              <div className={cn("mt-1 text-2xl font-semibold tabular-nums", TONE[k.tone])}>
                {k.value}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ProgressKpiDialog kpi={open} data={data} onClose={() => setOpen(null)} />
    </>
  )
}

function StatusTip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number }[]
}) {
  const p = payload?.[0]
  if (!active || !p) return null
  return (
    <div className="border-border bg-card rounded-md border px-2 py-1 text-xs shadow-sm">
      {p.name}: <span className="font-medium tabular-nums">{p.value}</span>
    </div>
  )
}

function StatusCard({ t, className }: { t: ProgressTotals; className?: string }) {
  // Picked from the legend or the ring; clicking again releases it. Other slices dim.
  const [picked, setPicked] = useState<DeliverableStatus | null>(null)
  const toggle = (s: DeliverableStatus) => setPicked((cur) => (cur === s ? null : s))

  const slices = STATUS_ORDER.map((s) => ({
    key: s,
    name: DELIVERABLE_STATUS_LABELS[s],
    value: t.byStatus[s] ?? 0,
  }))
  const drawn = slices.filter((s) => s.value > 0)
  const active = picked ? slices.find((s) => s.key === picked) : undefined

  return (
    <Card className={className}>
      <CardHeader className="border-border/60 border-b pb-3">
        <CardTitle className="text-sm font-semibold">Where the work stands</CardTitle>
        <p className="text-muted-foreground text-xs">
          Click a status to see its share of the ring.
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="relative h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={drawn}
                dataKey="value"
                nameKey="name"
                innerRadius={64}
                outerRadius={96}
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={false}
                onClick={(_, i) => {
                  const s = drawn[i]
                  if (s) toggle(s.key)
                }}
              >
                {drawn.map((s) => {
                  const on = picked === s.key
                  const dim = picked !== null && !on
                  return (
                    <Cell
                      key={s.key}
                      cursor="pointer"
                      fill={STATUS_COLOR[s.key]}
                      fillOpacity={dim ? 0.2 : STATUS_OPACITY[s.key]}
                      stroke={on ? "var(--foreground)" : "none"}
                      strokeWidth={on ? 2 : 0}
                    />
                  )
                })}
              </Pie>
              <Tooltip content={<StatusTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {active ? (
              <>
                <span
                  className="text-3xl font-bold tabular-nums"
                  style={{ color: STATUS_COLOR[active.key] }}
                >
                  {active.value}
                </span>
                <span className="text-xs font-medium">{active.name}</span>
                <span className="text-muted-foreground text-xs">
                  {pctOf(active.value, t.total)}% of {t.total}
                </span>
              </>
            ) : (
              <>
                <span className="text-3xl font-bold tabular-nums">{t.total}</span>
                <span className="text-xs font-medium">deliverables</span>
                <span className="text-muted-foreground text-xs">{t.pct}% completed</span>
              </>
            )}
          </div>
        </div>
        {/* The legend is the control: each row picks its slice out of the ring. */}
        <ul className="mt-3 space-y-1">
          {slices.map((s) => {
            const on = picked === s.key
            const pct = pctOf(s.value, t.total)
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => toggle(s.key)}
                  aria-pressed={on}
                  className={cn(
                    "grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 rounded-sm border px-2.5 py-1.5 text-left text-sm transition-colors",
                    on ? "border-foreground/40 bg-muted" : "hover:bg-muted/60 border-transparent",
                    s.value === 0 && !on && "text-muted-foreground",
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[s.key], opacity: STATUS_OPACITY[s.key] }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate leading-tight">{s.name}</span>
                    <span className="bg-muted mt-1 block h-1 overflow-hidden rounded-full">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: STATUS_COLOR[s.key],
                          opacity: STATUS_OPACITY[s.key],
                        }}
                      />
                    </span>
                  </span>
                  <span className="w-8 text-right font-semibold tabular-nums">{s.value}</span>
                  <span className="text-muted-foreground w-10 text-right tabular-nums">{pct}%</span>
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function ProgressBar({ done, overdue, total }: { done: number; overdue: number; total: number }) {
  const d = pctOf(done, total)
  const o = pctOf(overdue, total)
  return (
    <div className="flex items-center gap-2">
      {/* min-w: a nowrap table cell gives a flexing bar no width of its own. */}
      <div className="bg-muted h-1.5 min-w-16 flex-1 overflow-hidden rounded-full">
        <div className="flex h-full">
          <div style={{ width: `${d}%`, background: "var(--state-done)" }} />
          <div style={{ width: `${o}%`, background: "var(--state-overdue)" }} />
        </div>
      </div>
      <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">{d}%</span>
    </div>
  )
}

function GroupCard({
  title,
  what,
  rows,
  onPick,
  tableId,
  itemLabel,
  pageKey,
  className,
}: {
  title: string
  what: string
  rows: ProgressGroup[]
  onPick?: (id: string) => void
  tableId: string
  /** Singular noun for the row count. */
  itemLabel: string
  /** The filter set; a new one returns the table to page 1. */
  pageKey: string
  className?: string
}) {
  const columns: DataTableColumn<ProgressGroup>[] = [
    {
      header: what,
      sortValue: (r) => r.label,
      className: "max-w-[220px]",
      cell: (r) => (
        <>
          {onPick ? (
            <button
              type="button"
              onClick={() => onPick(r.id)}
              className="block max-w-full truncate text-left font-medium hover:underline"
              title={`Only ${r.label}`}
            >
              {r.label}
            </button>
          ) : (
            <span className="block truncate font-medium" title={r.label}>
              {r.label}
            </span>
          )}
          {r.sub && (
            <div className="text-muted-foreground truncate text-xs" title={r.sub}>
              {r.sub}
            </div>
          )}
        </>
      ),
    },
    {
      header: "Completed",
      sortValue: (r) => r.done,
      className: "text-emerald-500 tabular-nums",
      cell: (r) => r.done,
    },
    { header: "Open", sortValue: (r) => r.open, className: "tabular-nums", cell: (r) => r.open },
    {
      header: "Overdue",
      sortValue: (r) => r.overdue,
      className: "tabular-nums",
      cell: (r) => (
        <span className={r.overdue ? "text-red-500" : "text-muted-foreground/60"}>{r.overdue}</span>
      ),
    },
    {
      header: "Sent back",
      sortValue: (r) => r.sentBack,
      className: "tabular-nums",
      cell: (r) => (
        <span className={r.sentBack ? "text-amber-500" : "text-muted-foreground/60"}>
          {r.sentBack}
        </span>
      ),
    },
    {
      header: "All",
      sortValue: (r) => r.total,
      className: "font-medium tabular-nums",
      cell: (r) => r.total,
    },
    {
      header: "Progress",
      sortValue: (r) => r.pct,
      className: "w-28 sm:w-36",
      headClassName: "w-28 sm:w-36",
      cell: (r) => <ProgressBar done={r.done} overdue={r.overdue} total={r.total} />,
    },
  ]

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="border-border/60 border-b pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      {/* Borderless: the card is the frame. */}
      <DataTable
        className="rounded-none border-0"
        tableId={tableId}
        itemLabel={itemLabel}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        pageKey={pageKey}
        columnToggle={false}
      />
    </Card>
  )
}

function StatusPill({ status }: { status: DeliverableStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: STATUS_COLOR[status], opacity: STATUS_OPACITY[status] }}
      />
      {DELIVERABLE_STATUS_LABELS[status]}
    </span>
  )
}

function ItemTitle({ item }: { item: ProgressItem }) {
  const sub = [
    item.type.toLowerCase().replace(/_/g, " "),
    item.quantity > 1 ? `${item.deliveredQuantity}/${item.quantity}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <div className="min-w-0">
      <div className="truncate font-medium" title={item.title}>
        {item.title}
      </div>
      <div className="text-muted-foreground text-xs">{sub}</div>
    </div>
  )
}

/** Deliverable, project and (for a manager) who - the columns both item lists open with. */
function itemColumns(showWho: boolean): DataTableColumn<ProgressItem>[] {
  return [
    {
      header: "Deliverable",
      sortValue: (it) => it.title,
      className: "max-w-[280px]",
      cell: (it) => <ItemTitle item={it} />,
    },
    { header: "Project", sortValue: (it) => it.project, cell: (it) => it.project },
    ...(showWho
      ? [
          {
            header: "Who",
            sortValue: (it: ProgressItem) => it.employee,
            cell: (it: ProgressItem) =>
              it.employee ?? <span className="text-muted-foreground">-</span>,
          },
        ]
      : []),
    {
      header: "Status",
      sortValue: (it) => STATUS_ORDER.indexOf(it.status),
      cell: (it) => <StatusPill status={it.status} />,
    },
  ]
}

function NotDoneCard({ items, showWho }: { items: ProgressItem[]; showWho: boolean }) {
  const columns: DataTableColumn<ProgressItem>[] = [
    ...itemColumns(showWho),
    {
      header: "When",
      sortValue: (it) => it.dueOn,
      className: "text-xs",
      cell: (it) => (
        <span className={it.overdue ? "text-red-500" : "text-muted-foreground"}>{it.period}</span>
      ),
    },
    {
      header: "Why",
      // The reason is the point of this list, so it wraps rather than truncates.
      className: "text-muted-foreground min-w-[240px] text-xs whitespace-normal",
      cell: (it) => it.why,
    },
  ]
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-border/60 border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          Still to do, and why
          <span className="text-muted-foreground text-xs font-normal">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <DataTable
        className="rounded-none border-0"
        itemLabel="deliverable"
        columns={columns}
        rows={items}
        rowKey={(it) => it.id}
        columnToggle={false}
        empty="Everything in this window is completed."
      />
    </Card>
  )
}

function DeliveredCard({ items, showWho }: { items: ProgressItem[]; showWho: boolean }) {
  const columns: DataTableColumn<ProgressItem>[] = [
    ...itemColumns(showWho),
    {
      header: "Finished",
      sortValue: (it) => it.completedOn,
      className: "text-muted-foreground text-xs",
      cell: (it) => (
        <>
          {it.completedOn ? formatDate(it.completedOn, "d MMM yyyy") : "-"}
          {it.late && <span className="ml-2 text-amber-500">late</span>}
        </>
      ),
    },
  ]
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-border/60 border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          Completed in this window
          <span className="text-muted-foreground text-xs font-normal">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <DataTable
        className="rounded-none border-0"
        itemLabel="deliverable"
        columns={columns}
        rows={items}
        rowKey={(it) => it.id}
        columnToggle={false}
        empty="Nothing completed in this window yet."
      />
    </Card>
  )
}
