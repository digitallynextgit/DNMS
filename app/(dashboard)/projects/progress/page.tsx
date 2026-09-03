"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useMutation } from "@tanstack/react-query"
import {
  CheckCircle2,
  CircleDot,
  Clock,
  AlertTriangle,
  Target,
  Sparkles,
  Loader2,
  SlidersHorizontal,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MarkdownLite } from "@/components/shared/markdown-lite"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { apiFetch } from "@/lib/api-fetch"
import { cn, formatDate } from "@/lib/utils"
import {
  ReportOptionsDialog,
  DEFAULT_REPORT_CONFIG,
  describeConfig,
  usePerformance,
  rangeLabel,
  type Drill,
  type ReportConfig,
  type TaskState,
} from "@/features/projects"
import { useGoalsPortfolio } from "@/features/projects/components/goals-progress-card"
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

// =============================================================================
// Progress: glance -> chart -> popup.
//
// Three layers, and every number is a door. The tiles say whether things are
// OK; the four charts say where; the drill-down says which tasks. The old page
// stacked six tiles, five charts and a table that all restated one set of
// counts and none of which could be clicked - a report pretending to be a
// dashboard.
//
// ── TWO CLOCKS, STATED ───────────────────────────────────────────────────────
// The date range scopes tasks by DUE date - "what was due this week, how did it
// go". Two things are not weekly questions and ignore it on purpose: OVERDUE
// (late is late today, whichever week it was due) and GOALS (a target three
// months out is the normal case). Both say "as of today" wherever they appear.
// =============================================================================

/** Radix Select cannot hold "" as a value, so the "everything" option needs a sentinel. */
const ALL_PROJECTS = "__all__"

// Heavy sections load with the page, not the app: the charts pull recharts, the
// drill-down pulls everything.
const PortfolioCharts = dynamic(
  () => import("@/features/projects").then((m) => m.PortfolioCharts),
  { loading: () => <Skeleton className="h-96 rounded" /> },
)
const GoalsProgressCard = dynamic(
  () => import("@/features/projects").then((m) => m.GoalsProgressCard),
  { loading: () => <Skeleton className="h-48 rounded" /> },
)
const ProgressDrilldown = dynamic(
  () => import("@/features/projects").then((m) => m.ProgressDrilldown),
  { ssr: false },
)
// Renders only for non-managers and pulls recharts, so a manager should not
// download it. Concrete path, not the barrel, so it does not drag the rest in.
const MyProgress = dynamic(
  () => import("@/features/projects/components/my-progress").then((m) => m.MyProgress),
  { loading: () => <Skeleton className="h-64 rounded" /> },
)

/**
 * A headline number that opens the list behind it.
 *
 * A button, not a card: the value is the thing you click to see what it is
 * made of, and the chevron says so before you hover.
 */
function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
  onClick,
}: {
  icon: typeof Clock
  label: string
  value: string
  sub?: string
  tone?: "default" | "good" | "warn" | "bad" | "accent"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group bg-card hover:border-foreground/30 hover:bg-muted/30 flex w-full items-center gap-3 rounded-[6px] border p-4 text-left transition-colors"
    >
      <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded">
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-xl font-bold tabular-nums",
            tone === "good" && "text-emerald-500",
            tone === "warn" && "text-amber-500",
            tone === "bad" && "text-destructive",
            tone === "accent" && "text-primary",
          )}
        >
          {value}
        </p>
        {sub && <p className="text-muted-foreground truncate text-[11px]">{sub}</p>}
      </div>
      <ChevronRight className="text-muted-foreground/50 group-hover:text-foreground h-4 w-4 shrink-0 transition-colors" />
    </button>
  )
}

export default function ProjectProgressPage() {
  const { can, isLoading: permsLoading } = usePermissions()
  const canManageProjects = can(PERMISSIONS.PROJECT_WRITE)

  // Both filters drive the SAME numbers: the tiles are the totals for whatever
  // is selected. ALL_PROJECTS is a sentinel because Radix Select cannot hold an
  // empty string as a value.
  const [projectId, setProjectId] = useState<string>(ALL_PROJECTS)
  // Defaults to the current week: "what is going on right now" is the question
  // this page is opened to answer, and all-time buries it under months of work.
  const [range, setRange] = useState<DateRangeValue>(() => presetValue("week"))
  const oneProject = projectId !== ALL_PROJECTS
  const scopeId = oneProject ? projectId : undefined
  const window = { from: range.from, to: range.to }

  const { data } = usePerformance(scopeId, window, canManageProjects)
  const goals = useGoalsPortfolio(scopeId)

  // The option list is scope-filtered only, so narrowing never strands you with
  // a single option and no way back.
  const projects = data?.projects ?? []
  const project = projects.find((p) => p.id === projectId)

  /** What is open in the popup, if anything. */
  const [drill, setDrill] = useState<Drill | null>(null)

  // ── AI briefing, in a slide-over ───────────────────────────────────────────
  // A briefing describes ONE slice. Remember which, so changing the filters
  // retires it instead of leaving a report about the old scope on screen.
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [reportConfig, setReportConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG)
  const [reportFor, setReportFor] = useState<string | null>(null)

  // One rule, so the two scope controls never contradict each other: an empty
  // project scope in the options means "follow the picker at the top of the
  // page". Picking projects in the dialog overrides it.
  const resolveScope = (config: ReportConfig) => ({
    ...config,
    projectIds: config.projectIds.length > 0 ? config.projectIds : oneProject ? [projectId] : [],
  })
  const signature = (config: ReportConfig) =>
    JSON.stringify([scopeId, range.from, range.to, resolveScope(config)])

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
  const currentReport = reportFor === signature(reportConfig) ? report.data : undefined

  // Which of the two pages below to render is a PERMISSION decision, and during
  // a client-side navigation the session has not resolved yet - `can()` answers
  // false for everyone for a beat. Wait for the real answer.
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
  // "what is going on across the portfolio". Different pages, not the same page
  // with rows hidden.
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

  const s = data?.summary
  const pending = s ? s.assigned - s.completed - s.discarded : 0
  const scope = rangeLabel(window)
  const g = goals.data?.totals

  const openClient = (id: string, state?: TaskState) => {
    const p = projects.find((x) => x.id === id) ?? data?.byProject.find((x) => x.id === id)
    if (!p) return
    setDrill({
      kind: "client",
      project: { id: p.id, name: p.name, code: p.code, slug: p.slug },
      tab: state ? "tasks" : "overview",
      state,
      range: window,
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Progress"
        description={
          oneProject
            ? `${project?.name ?? "Project"} · tasks ${scope} · overdue and goals as of today`
            : `All projects · tasks ${scope} · overdue and goals as of today`
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
            {oneProject && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => openClient(projectId)}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Details
              </Button>
            )}
            <Button
              size="sm"
              variant={currentReport ? "default" : "outline"}
              className="h-8 gap-1.5"
              onClick={() => setInsightsOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Insights
            </Button>
          </>
        }
      />

      {/* ── Layer 1: five numbers, each a door ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile
          icon={CheckCircle2}
          label="Complete"
          value={s?.completionRate != null ? `${s.completionRate}%` : "–"}
          sub={s ? `${s.completed} of ${s.assigned - s.discarded} tasks ${scope}` : undefined}
          tone="accent"
          onClick={() =>
            setDrill({
              kind: "state",
              state: "done",
              title: "Completed",
              subtitle: `Tasks finished, ${scope}`,
              projectId: scopeId,
              range: window,
            })
          }
        />
        <KpiTile
          icon={CircleDot}
          label="Open"
          value={String(pending)}
          sub={s ? `${s.overdue} overdue · ${s.onHold} on hold · ${scope}` : undefined}
          onClick={() =>
            setDrill({
              kind: "state",
              state: "open",
              title: "Open",
              subtitle: `Not finished and not dropped, ${scope}`,
              projectId: scopeId,
              range: window,
            })
          }
        />
        <KpiTile
          icon={AlertTriangle}
          label="Overdue"
          value={String(data?.overdueNow ?? 0)}
          sub={
            // Only worth a second number when a range is on: with "all time"
            // the two figures are the same, and "127 of them due all time"
            // reads as nonsense.
            s && range.from ? `as of today · ${s.overdue} of them ${scope}` : "as of today"
          }
          tone={(data?.overdueNow ?? 0) > 0 ? "bad" : "good"}
          onClick={() =>
            setDrill({
              kind: "state",
              state: "overdue",
              title: "Overdue",
              subtitle: "Open and past due, as of today - every week, not just this one",
              projectId: scopeId,
            })
          }
        />
        <KpiTile
          icon={Clock}
          label="On time"
          value={s?.onTimeRate != null ? `${s.onTimeRate}%` : "–"}
          sub={
            s?.completed ? `${s.onTime} of ${s.completed} finished on time` : "nothing finished yet"
          }
          tone={s?.onTimeRate == null ? "default" : s.onTimeRate >= 85 ? "good" : "warn"}
          onClick={() =>
            setDrill({
              kind: "state",
              state: "done",
              title: "Delivered",
              subtitle: `Finished ${scope} - late ones are flagged`,
              projectId: scopeId,
              range: window,
            })
          }
        />
        <KpiTile
          icon={Target}
          label="Goals"
          value={g && g.totalGoals > 0 ? `${g.overallProgress}%` : "–"}
          sub={
            g && g.totalGoals > 0
              ? `${g.doneGoals} of ${g.totalGoals} done · as of today`
              : "none set"
          }
          tone={g && g.overdueGoals > 0 ? "bad" : g && g.atRiskGoals > 0 ? "warn" : "default"}
          onClick={() => setDrill({ kind: "goals", projectId: scopeId })}
        />
      </div>

      {/* ── Layer 2: four charts ─────────────────────────────────────────── */}
      {data ? (
        <PortfolioCharts
          mode={oneProject ? "project" : "portfolio"}
          summary={data.summary}
          scopeLabel={scope}
          projects={data.byProject}
          teams={data.byTeam}
          people={data.byEmployee}
          trend={data.trend}
          onState={(state) =>
            setDrill({
              kind: "state",
              state,
              title:
                state === "overdue"
                  ? "Overdue"
                  : state === "done"
                    ? "Done"
                    : state === "hold"
                      ? "On hold"
                      : state === "progress"
                        ? "In progress"
                        : "To do",
              subtitle: `Tasks ${scope}`,
              projectId: scopeId,
              range: window,
            })
          }
          onClient={(id, state) => openClient(id, state)}
          onTeam={(teamId, state) =>
            setDrill({
              kind: "state",
              state,
              title: `${data.byTeam.find((t) => t.id === teamId)?.name ?? "Team"} · ${
                state === "overdue"
                  ? "overdue"
                  : state === "done"
                    ? "done"
                    : state === "hold"
                      ? "on hold"
                      : state === "progress"
                        ? "in progress"
                        : "to do"
              }`,
              subtitle: `Tasks ${scope}`,
              projectId: scopeId,
              teamId: teamId === "__no_team__" ? undefined : teamId,
              range: window,
              groupBy: "assignee",
            })
          }
          onPerson={(id, state) => {
            const who = data.byEmployee.find((e) => e.id === id)
            if (!who) return
            setDrill({
              kind: "person",
              person: { id, name: who.name, profilePhoto: who.profilePhoto },
              projectId: scopeId,
              state,
              range: window,
            })
          }}
        />
      ) : (
        <Skeleton className="h-96 rounded" />
      )}

      {/* ── Goals strip: as of today, follows the picker only ─────────────── */}
      <GoalsProgressCard
        projectId={scopeId}
        onOpen={(id) => setDrill({ kind: "goals", projectId: id })}
      />

      {/* ── Layer 3: the popup ──────────────────────────────────────────── */}
      <ProgressDrilldown drill={drill} onClose={() => setDrill(null)} />

      {/* ── AI insights, off the main page ──────────────────────────────── */}
      <Sheet open={insightsOpen} onOpenChange={setInsightsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-1.5 text-base">
              <Sparkles className="h-4 w-4" /> AI insights
            </SheetTitle>
            <SheetDescription className="text-xs">{describeConfig(reportConfig)}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex gap-2">
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
          <Card className="mt-4">
            <CardContent className="p-4">
              {report.isPending ? (
                <p className="text-muted-foreground text-sm">Analysing the task data…</p>
              ) : currentReport ? (
                <MarkdownLite content={currentReport} className="text-sm leading-relaxed" />
              ) : (
                <p className="text-muted-foreground text-sm">
                  A written briefing on{" "}
                  {oneProject ? (project?.name ?? "this project") : "the portfolio"} for tasks{" "}
                  {scope}
                  {range.from ? ` (${formatDate(range.from)} – ${formatDate(range.to!)})` : ""}.
                  Generate one to read it here.
                </p>
              )}
            </CardContent>
          </Card>
        </SheetContent>
      </Sheet>
      <ReportOptionsDialog
        open={optionsOpen}
        value={reportConfig}
        onOpenChange={setOptionsOpen}
        onGenerate={generate}
      />
    </div>
  )
}
