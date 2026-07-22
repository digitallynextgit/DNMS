"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  CheckCircle2,
  Clock,
  ListChecks,
  AlertTriangle,
  CalendarRange,
  Sparkles,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { MarkdownLite } from "@/components/shared/markdown-lite"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"

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
  scope: "all" | "mine"
}

/** A percentage cell, coloured by band (green ≥85, amber ≥65, red below). */
function Rate({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">-</span>
  const tone =
    value >= 85
      ? "text-emerald-600 dark:text-emerald-400"
      : value >= 65
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400"
  return <span className={cn("font-semibold tabular-nums", tone)}>{value}%</span>
}

function Overdue({ n }: { n: number }) {
  return n > 0 ? (
    <span className="font-medium text-red-600 dark:text-red-400">{n}</span>
  ) : (
    <span className="text-muted-foreground">0</span>
  )
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

export default function ProjectPerformancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["project-performance"],
    queryFn: () => apiFetch<{ data: PerfData }>("/api/projects/performance").then((r) => r.data),
    staleTime: 60_000,
  })

  const report = useMutation({
    mutationFn: () =>
      apiFetch<{ data: { report: string } }>("/api/projects/performance/report", {
        method: "POST",
      }).then((r) => r.data.report),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't generate the report"),
  })

  const s = data?.summary

  const projColumns: DataTableColumn<ProjRow>[] = [
    {
      header: "Project",
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{p.name}</p>
          <p className="text-muted-foreground text-xs">{p.code}</p>
        </div>
      ),
    },
    { header: "Tasks", align: "right", cell: (p) => p.assigned },
    { header: "Completed", align: "right", cell: (p) => p.completed },
    {
      header: "Due (wk)",
      align: "right",
      className: "text-muted-foreground",
      cell: (p) => p.dueThisWeek,
    },
    {
      header: "Done (wk)",
      align: "right",
      className: "text-muted-foreground",
      cell: (p) => p.doneThisWeek,
    },
    { header: "On-time", align: "right", cell: (p) => <Rate value={p.onTimeRate} /> },
    { header: "Overdue", align: "right", cell: (p) => <Overdue n={p.overdue} /> },
    { header: "Completion", align: "right", cell: (p) => <Rate value={p.completionRate} /> },
  ]

  const empColumns: DataTableColumn<EmpRow>[] = [
    {
      header: "Employee",
      cell: (e) => (
        <div className="flex items-center gap-2">
          <AvatarDisplay
            src={e.profilePhoto}
            firstName={e.name.split(" ")[0] ?? ""}
            lastName={e.name.split(" ").slice(1).join(" ")}
            size="sm"
            className="shrink-0"
          />
          <span className="truncate font-medium">{e.name}</span>
        </div>
      ),
    },
    { header: "Assigned", align: "right", cell: (e) => e.assigned },
    { header: "Completed", align: "right", cell: (e) => e.completed },
    {
      header: "Due (wk)",
      align: "right",
      className: "text-muted-foreground",
      cell: (e) => e.dueThisWeek,
    },
    {
      header: "Done (wk)",
      align: "right",
      className: "text-muted-foreground",
      cell: (e) => e.doneThisWeek,
    },
    { header: "On-time", align: "right", cell: (e) => <Rate value={e.onTimeRate} /> },
    { header: "Overdue", align: "right", cell: (e) => <Overdue n={e.overdue} /> },
    {
      header: "In Process",
      align: "right",
      className: "text-muted-foreground",
      cell: (e) => e.inProgress,
    },
    {
      header: "On Hold",
      align: "right",
      className: "text-muted-foreground",
      cell: (e) => e.onHold,
    },
    {
      header: "Discarded",
      align: "right",
      className: "text-muted-foreground",
      cell: (e) => e.discarded,
    },
    { header: "Completion", align: "right", cell: (e) => <Rate value={e.completionRate} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Performance"
        description="How much work gets done, and how much of it lands on time - by project and by person."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={ListChecks} label="Total tasks" value={s?.assigned ?? 0} />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={s?.completed ?? 0}
          sub={s?.completionRate != null ? `${s.completionRate}%` : undefined}
        />
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
            <p className="text-muted-foreground text-xs">
              A briefing over the current data - what&apos;s on track, what needs attention,
              what&apos;s urgent this week.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => report.mutate()}
            disabled={report.isPending}
          >
            {report.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {report.data ? "Regenerate" : "Generate report"}
          </Button>
        </CardHeader>
        {(report.data || report.isPending) && (
          <CardContent>
            {report.isPending ? (
              <p className="text-muted-foreground text-sm">Analysing the task data…</p>
            ) : (
              <MarkdownLite content={report.data ?? ""} className="text-sm leading-relaxed" />
            )}
          </CardContent>
        )}
      </Card>

      {/* Projects (above) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">By project</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || (data?.byProject.length ?? 0) > 0 ? (
            <DataTable
              columns={projColumns}
              rows={data?.byProject ?? []}
              rowKey={(p) => p.id}
              minWidth="min-w-[720px]"
              loading={isLoading}
              skeletonRows={4}
            />
          ) : (
            <div className="p-6">
              <EmptyState icon={ListChecks} compact title="No task data yet." />
            </div>
          )}
        </CardContent>
      </Card>

      {/* People (below) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">By employee</CardTitle>
          <p className="text-muted-foreground text-xs">
            On-time = completed by the due date. Completion = completed ÷ (assigned − discarded).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || (data?.byEmployee.length ?? 0) > 0 ? (
            <DataTable
              columns={empColumns}
              rows={data?.byEmployee ?? []}
              rowKey={(e) => e.id}
              minWidth="min-w-[900px]"
              loading={isLoading}
              skeletonRows={6}
            />
          ) : (
            <div className="p-6">
              <EmptyState icon={ListChecks} compact title="No task data yet." />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
