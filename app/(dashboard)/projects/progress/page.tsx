"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  CheckCircle2,
  CircleDot,
  Clock,
  ListChecks,
  AlertTriangle,
  CalendarRange,
  Sparkles,
  Loader2,
  SlidersHorizontal,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownLite } from "@/components/shared/markdown-lite"
import { apiFetch } from "@/lib/api-fetch"
import { formatDate } from "@/lib/utils"
import {
  MemberProgressDialog,
  ReportOptionsDialog,
  DEFAULT_REPORT_CONFIG,
  describeConfig,
  type MemberProgress,
  type ReportConfig,
} from "@/features/projects"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import {
  DateRangeField,
  presetValue,
  type DateRangeValue,
} from "@/components/shared/date-range-field"

/** Radix Select cannot hold "" as a value, so the "everything" option needs a sentinel. */
const ALL_PROJECTS = "__all__"

/** Stand-in while the first response is in flight, so the charts can mount. */
const EMPTY_BUCKET = {
  assigned: 0,
  completed: 0,
  onTime: 0,
  late: 0,
  overdue: 0,
  inProgress: 0,
  onHold: 0,
  discarded: 0,
  dueThisWeek: 0,
  doneThisWeek: 0,
  openTodo: 0,
  openProgress: 0,
  allocatedHours: 0,
  spentHours: 0,
  completionRate: null,
  onTimeRate: null,
}

// The per-project breakdown is a big component; it loads when this page does,
// not with the rest of the bundle.
const ProjectProgressDetail = dynamic(
  () => import("@/features/projects").then((m) => m.ProjectProgressDetail),
  { loading: () => <Skeleton className="h-64 rounded" /> },
)
const PortfolioCharts = dynamic(
  () => import("@/features/projects").then((m) => m.PortfolioCharts),
  { loading: () => <Skeleton className="h-64 rounded" /> },
)
// Dynamic + concrete module (PERF-11): MyProgress renders only for non-managers
// and pulls recharts, so a manager should not download it. The concrete path
// (not the barrel) keeps it from dragging the rest of the feature in with it.
const MyProgress = dynamic(
  () => import("@/features/projects/components/my-progress").then((m) => m.MyProgress),
  { loading: () => <Skeleton className="h-64 rounded" /> },
)

interface Bucket {
  assigned: number
  completed: number
  onTime: number
  late: number
  overdue: number
  inProgress: number
  onHold: number
  discarded: number
  dueThisWeek: number
  doneThisWeek: number
  /**
   * Mutually exclusive display states - see the API. `inProgress` and `overdue`
   * overlap, so any part-to-whole chart has to use these instead or it counts a
   * late in-progress task twice.
   */
  openTodo: number
  openProgress: number
  allocatedHours: number
  spentHours: number
  completionRate: number | null
  onTimeRate: number | null
}
interface EmpRow extends Bucket {
  id: string
  name: string
  profilePhoto: string | null
}
interface ProjRow extends Bucket {
  id: string
  name: string
  code: string
}
interface PerfData {
  summary: Bucket
  byEmployee: EmpRow[]
  byProject: ProjRow[]
  /** Scope-filtered only, so narrowing never strands the picker. */
  projects: { id: string; name: string; code: string }[]
  scope: "all" | "mine"
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof ListChecks
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded">
          <Icon className="text-muted-foreground h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="text-lg font-bold tabular-nums">
            {value}
            {sub && <span className="text-muted-foreground ml-1 text-xs font-normal">{sub}</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProjectProgressPage() {
  const { can, isLoading: permsLoading } = usePermissions()
  const canManageProjects = can(PERMISSIONS.PROJECT_WRITE)

  // Both filters drive the SAME numbers: the tiles are the totals for whatever
  // is selected, so "All projects" reads as the portfolio and a named project
  // reads as that project. ALL_PROJECTS is a sentinel because Radix Select
  // cannot hold an empty string as a value.
  const [projectId, setProjectId] = useState<string>(ALL_PROJECTS)
  // Defaults to the current week: "what is going on right now" is the question
  // this page is opened to answer, and all-time buries it under months of work.
  const [range, setRange] = useState<DateRangeValue>(() => presetValue("week"))

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (projectId !== ALL_PROJECTS) p.set("projectId", projectId)
    if (range.from) p.set("from", range.from)
    if (range.to) p.set("to", range.to)
    return p.toString()
  }, [projectId, range])

  const { data } = useQuery({
    queryKey: ["project-performance", query],
    queryFn: () =>
      apiFetch<{ data: PerfData }>(`/api/projects/performance${query ? `?${query}` : ""}`).then(
        (r) => r.data,
      ),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  // The option list is scope-filtered only, so narrowing never strands you with
  // a single option and no way back.
  const projects = data?.projects ?? []

  // A briefing describes ONE slice. Remember which, so changing the filters
  // retires it instead of leaving a report about the old scope on screen.
  const [reportFor, setReportFor] = useState<string | null>(null)

  /** The member whose drill-down is open, if any. */
  const [drillMember, setDrillMember] = useState<MemberProgress | null>(null)

  const [optionsOpen, setOptionsOpen] = useState(false)
  const [reportConfig, setReportConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG)

  // One rule, so the two scope controls never contradict each other: an empty
  // project scope in the options means "follow the picker at the top of the
  // page". Picking projects in the dialog overrides it.
  const resolveScope = (config: ReportConfig) => ({
    ...config,
    projectIds:
      config.projectIds.length > 0
        ? config.projectIds
        : projectId === ALL_PROJECTS
          ? []
          : [projectId],
  })

  /** Identity of a briefing: the data slice AND the shape that was asked for. */
  const signature = (config: ReportConfig) => JSON.stringify([query, resolveScope(config)])

  const report = useMutation({
    mutationFn: (config: ReportConfig) =>
      apiFetch<{ data: { report: string } }>("/api/projects/performance/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...resolveScope(config), from: range.from, to: range.to }),
      }).then((r) => r.data.report),
    onSuccess: (_data, config) => setReportFor(signature(config)),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't generate the report"),
  })

  const generate = (config: ReportConfig) => {
    setReportConfig(config)
    setOptionsOpen(false)
    report.mutate(config)
  }

  /** Only show a briefing that was written for what is currently on screen. */
  const currentReport = reportFor === signature(reportConfig) ? report.data : undefined

  const s = data?.summary

  // Which of the two pages below to render is a PERMISSION decision, and during
  // a client-side navigation the session has not resolved yet - `can()` answers
  // false for everyone for a beat. Rendering on that answer put a manager on the
  // individual view first and mounted MyProgress underneath them, which is where
  // the "Couldn't load projects" crash came from. Wait for the real answer.
  if (permsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 rounded" />
        <Skeleton className="h-24 rounded" />
        <Skeleton className="h-64 rounded" />
      </div>
    )
  }

  // An individual asks "what do I owe and what have I finished", a manager asks
  // "what is going on across the portfolio". Those are different pages, not the
  // same page with rows hidden.
  if (!canManageProjects) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Progress"
          description="What you still have to do, and what you have done."
        />
        <MyProgress />
      </div>
    )
  }

  const pending = s ? s.assigned - s.completed - s.discarded : 0
  const oneProject = projectId !== ALL_PROJECTS
  const projectName = projects.find((p) => p.id === projectId)?.name

  return (
    <div className="space-y-6">
      {/* Filters ride in the header, on the right of the title, so the controls
          and the numbers they change are not separated by a band of whitespace. */}
      <PageHeader
        title="Progress"
        description={
          oneProject
            ? `${projectName ?? "Project"}${range.from ? ` · due ${formatDate(range.from)} to ${formatDate(range.to!)}` : " · all time"}`
            : `All projects${range.from ? ` · due ${formatDate(range.from)} to ${formatDate(range.to!)}` : " · all time"}`
        }
        actions={
          <>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-8 w-52 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangeField value={range} onChange={setRange} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={ListChecks} label="Total tasks" value={s?.assigned ?? 0} />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={s?.completed ?? 0}
          sub={s?.completionRate != null ? `${s.completionRate}%` : undefined}
        />
        {/* Pending excludes discarded: work that was dropped is not outstanding. */}
        <StatCard icon={CircleDot} label="Pending" value={pending} />
        <StatCard
          icon={Clock}
          label="On-time"
          value={s?.onTimeRate != null ? `${s.onTimeRate}%` : "-"}
          sub={s ? `${s.onTime}/${s.completed}` : undefined}
        />
        <StatCard icon={AlertTriangle} label="Overdue" value={s?.overdue ?? 0} />
        <StatCard
          icon={CalendarRange}
          label="This week"
          value={s?.doneThisWeek ?? 0}
          sub={s ? `done / ${s.dueThisWeek} due` : undefined}
        />
      </div>

      {/* AI briefing */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4" /> AI insights
            </CardTitle>
            <p className="text-muted-foreground text-xs">{describeConfig(reportConfig)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => setOptionsOpen(true)}
              disabled={report.isPending}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Options
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => report.mutate(reportConfig)}
              disabled={report.isPending}
            >
              {report.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {currentReport ? "Regenerate" : "Generate report"}
            </Button>
          </div>
        </CardHeader>
        {(currentReport || report.isPending) && (
          <CardContent>
            {report.isPending ? (
              <p className="text-muted-foreground text-sm">Analysing the task data…</p>
            ) : (
              <MarkdownLite content={currentReport ?? ""} className="text-sm leading-relaxed" />
            )}
          </CardContent>
        )}
      </Card>

      <ReportOptionsDialog
        open={optionsOpen}
        value={reportConfig}
        onOpenChange={setOptionsOpen}
        onGenerate={generate}
      />

      {/* The deep breakdown follows the picker above. It is inherently
          per-project (teams, members, tracked sites), so on "All projects" it
          says which project to pick rather than showing a meaningless merge.
          Its own numbers are all-time - the date filter drives the tiles. */}
      {oneProject ? (
        <>
          <ProjectProgressDetail
            projectId={projectId}
            range={{ from: range.from, to: range.to }}
            onSelectMember={setDrillMember}
          />
          <MemberProgressDialog
            projectId={projectId}
            member={drillMember}
            range={{ from: range.from, to: range.to }}
            onClose={() => setDrillMember(null)}
          />
        </>
      ) : (
        <PortfolioCharts
          summary={s ?? EMPTY_BUCKET}
          projects={data?.byProject ?? []}
          people={data?.byEmployee ?? []}
        />
      )}
    </div>
  )
}
