"use client"

import { useMemo, useState } from "react"
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

// =============================================================================
// My Progress - by deliverable
//
// The page a person or a team manager opens on Monday: what is owed, what has
// landed, what has not and why - across every project they are on. The numbers
// come from the same route the slide deck uses, so the page and the deck never
// disagree. The filters narrow to one project, one team or one person; the
// server decides what each role may see, a plain member only ever gets
// themselves, and the pickers are built from that same answer.
// =============================================================================

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
}
// Delivered and accepted share a hue - both are "done" - the lighter one is
// the half the client has not signed off on yet.
const STATUS_OPACITY: Record<DeliverableStatus, number> = {
  PLANNED: 1,
  IN_PROGRESS: 1,
  DELIVERED: 0.55,
  ACCEPTED: 1,
  REJECTED: 1,
}

const ALL = "all"
const NOT_DONE_CAP = 40
const DELIVERED_CAP = 20

const pctOf = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100))
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

interface MyProgressProps {
  /** The window, picked in the page header so this panel and the Slides deck read the same one. */
  range: DateRangeValue
}

export function MyProgress({ range }: MyProgressProps) {
  const [projectId, setProjectId] = useState(ALL)
  // A team NAME, not an id: the six teams are the same on every project.
  const [team, setTeam] = useState(ALL)
  const [personId, setPersonId] = useState(ALL)

  // Same key as the slides dialog, so opening it costs nothing extra.
  const scope = useQuery({
    queryKey: ["deliverables-report-scope"],
    queryFn: () =>
      apiFetch<{ data: ScopeData }>("/api/projects/deliverables/report/scope").then((r) => r.data),
    staleTime: 60_000,
  })

  // Every project carries the same six teams, so the picker offers each NAME
  // once and picking one means "that team on every project in view". The
  // route takes ids, so the name is turned back into every id it stands for.
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
    // Keep the last numbers on screen while a new filter loads - no flash of
    // skeletons every time someone changes the window.
    placeholderData: (prev) => prev,
  })

  const sc = scope.data
  const showProjects = (sc?.projects.length ?? 0) > 1
  // One team name in view means the picker could only ever say that name.
  const showTeams = teamNames.length > 1
  const showPeople = sc?.role !== "member" && (sc?.people.length ?? 0) > 1

  // People narrowed to the chosen project / team, falling back to everyone
  // when that would leave nobody (a line report with no team on the project).
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
    // The same teams sit on every project, so a chosen team survives the
    // switch - unless this project somehow lacks it (legacy data).
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

  return (
    <div className="space-y-6">
      {/* Who this covers on the left, the filters on the right - the window
          itself is picked in the page header, next to Slides. */}
      <div className="flex flex-wrap items-center gap-3">
        {sc && (
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
        )}
        {(showProjects || showTeams || showPeople) && (
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
              className="lg:col-span-3"
            />
          </div>

          {data.byPerson.length > 1 && (
            <GroupCard
              title="By team member"
              what="Person"
              rows={data.byPerson}
              onPick={showPeople ? pickPerson : undefined}
            />
          )}

          <NotDoneCard items={data.notDone} showWho={showPeople && personId === ALL} />
          <DeliveredCard items={data.delivered} showWho={showPeople && personId === ALL} />

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

// ─── KPIs ───────────────────────────────────

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
          // Each tile opens the list behind its number; keyboard-reachable too.
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

// ─── Status donut ────────────────────────────

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
  // The status being looked at, picked from the legend or the ring itself; the
  // same click again lets go of it. With nothing picked the ring reads as the
  // whole. Picking dims every other slice and swaps the centre to that
  // status's own number and share, which is what "highlight" has to mean on a
  // ring where the slices are already side by side.
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Where the work stands</CardTitle>
        <p className="text-muted-foreground text-xs">
          Click a status to see its share of the ring.
        </p>
      </CardHeader>
      <CardContent>
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
        {/* The legend is the control: each row is a button that picks its slice
            out of the ring. One row per status, top to bottom, with the same
            four columns on every row - dot, name, count, share - so the numbers
            line up down the card instead of drifting between two half-width
            columns with an orphan on the last line. The share is the same size
            as the count (it was a faint xs), and a thin bar under the name
            carries the proportion so nobody has to read the small number. */}
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

// ─── Breakdown tables ───────────────────────────

function ProgressBar({ done, overdue, total }: { done: number; overdue: number; total: number }) {
  const d = pctOf(done, total)
  const o = pctOf(overdue, total)
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
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
  className,
}: {
  title: string
  what: string
  rows: ProgressGroup[]
  onPick?: (id: string) => void
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-[11px] tracking-wide uppercase">
              <th className="py-1 text-left font-medium">{what}</th>
              <th className="py-1 text-right font-medium">Completed</th>
              <th className="py-1 text-right font-medium">Open</th>
              <th className="py-1 text-right font-medium">Overdue</th>
              <th className="py-1 text-right font-medium">Sent back</th>
              <th className="py-1 text-right font-medium">All</th>
              <th className="w-36 py-1 pl-3 text-left font-medium">Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-border/60 border-t">
                <td className="py-2 pr-3">
                  {onPick ? (
                    <button
                      type="button"
                      onClick={() => onPick(r.id)}
                      className="text-left font-medium hover:underline"
                      title={`Only ${r.label}`}
                    >
                      {r.label}
                    </button>
                  ) : (
                    <span className="font-medium">{r.label}</span>
                  )}
                  {r.sub && <div className="text-muted-foreground text-xs">{r.sub}</div>}
                </td>
                <td className="py-2 text-right text-emerald-500 tabular-nums">{r.done}</td>
                <td className="py-2 text-right tabular-nums">{r.open}</td>
                <td
                  className={cn(
                    "py-2 text-right tabular-nums",
                    r.overdue ? "text-red-500" : "text-muted-foreground/60",
                  )}
                >
                  {r.overdue}
                </td>
                <td
                  className={cn(
                    "py-2 text-right tabular-nums",
                    r.sentBack ? "text-amber-500" : "text-muted-foreground/60",
                  )}
                >
                  {r.sentBack}
                </td>
                <td className="py-2 text-right font-medium tabular-nums">{r.total}</td>
                <td className="py-2 pl-3">
                  <ProgressBar done={r.done} overdue={r.overdue} total={r.total} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

// ─── Item lists ─────────────────────────────

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

function NotDoneCard({ items, showWho }: { items: ProgressItem[]; showWho: boolean }) {
  const shown = items.slice(0, NOT_DONE_CAP)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          Still to do, and why
          <span className="text-muted-foreground text-xs font-normal">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {items.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            Everything in this window is completed.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-[11px] tracking-wide uppercase">
                <th className="py-1 text-left font-medium">Deliverable</th>
                <th className="py-1 text-left font-medium">Project</th>
                {showWho && <th className="py-1 text-left font-medium">Who</th>}
                <th className="py-1 text-left font-medium">Status</th>
                <th className="py-1 text-left font-medium">When</th>
                <th className="py-1 text-left font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((it) => (
                <tr key={it.id} className="border-border/60 border-t align-top">
                  <td className="max-w-[260px] py-2 pr-3">
                    <ItemTitle item={it} />
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{it.project}</td>
                  {showWho && (
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {it.employee ?? <span className="text-muted-foreground">-</span>}
                    </td>
                  )}
                  <td className="py-2 pr-3">
                    <StatusPill status={it.status} />
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-3 text-xs whitespace-nowrap",
                      it.overdue ? "text-red-500" : "text-muted-foreground",
                    )}
                  >
                    {it.period}
                  </td>
                  <td className="text-muted-foreground max-w-[360px] py-2 text-xs" title={it.why}>
                    {it.why}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items.length > shown.length && (
          <p className="text-muted-foreground pt-2 text-xs">
            and {items.length - shown.length} more - narrow the window or pick a project.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function DeliveredCard({ items, showWho }: { items: ProgressItem[]; showWho: boolean }) {
  const shown = items.slice(0, DELIVERED_CAP)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          Completed in this window
          <span className="text-muted-foreground text-xs font-normal">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {items.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            Nothing completed in this window yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-[11px] tracking-wide uppercase">
                <th className="py-1 text-left font-medium">Deliverable</th>
                <th className="py-1 text-left font-medium">Project</th>
                {showWho && <th className="py-1 text-left font-medium">Who</th>}
                <th className="py-1 text-left font-medium">Status</th>
                <th className="py-1 text-left font-medium">Finished</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((it) => (
                <tr key={it.id} className="border-border/60 border-t align-top">
                  <td className="max-w-[300px] py-2 pr-3">
                    <ItemTitle item={it} />
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{it.project}</td>
                  {showWho && (
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {it.employee ?? <span className="text-muted-foreground">-</span>}
                    </td>
                  )}
                  <td className="py-2 pr-3">
                    <StatusPill status={it.status} />
                  </td>
                  <td className="text-muted-foreground py-2 text-xs whitespace-nowrap">
                    {it.completedOn ? formatDate(it.completedOn, "d MMM yyyy") : "-"}
                    {it.late && <span className="ml-2 text-amber-500">late</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items.length > shown.length && (
          <p className="text-muted-foreground pt-2 text-xs">
            and {items.length - shown.length} more.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Loading ─────────────────────────────────

function ProgressSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl lg:col-span-3" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  )
}
