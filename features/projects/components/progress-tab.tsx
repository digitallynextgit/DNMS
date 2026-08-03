"use client"

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Gauge,
  Minus,
  Search,
  Users,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { cn, formatDate } from "@/lib/utils"
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS } from "@/lib/constants"
import {
  useProjectProgress,
  type ProgressBucket,
  type SeoSiteProgress,
} from "../hooks/use-projects"

// =============================================================================
// Project progress: delivery, people, and search in one view.
//
// Every rate here can be null, meaning "nothing to measure yet". Those render as
// a dash rather than 0%, because a team that has not finished anything is not
// performing at zero percent, it is simply unmeasured.
// =============================================================================

const num = (v: number) => v.toLocaleString("en-IN")

/** Rate pill coloured by band. Null renders as a dash, never as zero. */
function Rate({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null) return <span className="text-muted-foreground text-xs">no data</span>
  const good = invert ? value <= 15 : value >= 85
  const ok = invert ? value <= 35 : value >= 60
  return (
    <span
      className={cn(
        "text-sm font-semibold tabular-nums",
        good ? "text-emerald-600" : ok ? "text-amber-600" : "text-red-600",
      )}
    >
      {value.toFixed(0)}%
    </span>
  )
}

/** Stacked bar of the status mix. Widths are shares of the whole. */
function StatusBar({ b }: { b: ProgressBucket }) {
  if (b.total === 0) return null
  const seg = [
    { n: b.done, cls: "bg-emerald-500", label: "Done" },
    { n: b.inProgress, cls: "bg-blue-500", label: "In progress" },
    { n: b.inReview, cls: "bg-violet-500", label: "In review" },
    { n: b.todo, cls: "bg-slate-400", label: "To do" },
    { n: b.onHold, cls: "bg-amber-500", label: "On hold" },
    { n: b.discarded, cls: "bg-red-400", label: "Discarded" },
  ].filter((s) => s.n > 0)

  return (
    <div className="space-y-1.5">
      <div className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full">
        {seg.map((s) => (
          <div
            key={s.label}
            className={s.cls}
            style={{ width: `${(s.n / b.total) * 100}%` }}
            title={`${s.label}: ${s.n}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {seg.map((s) => (
          <span key={s.label} className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <span className={cn("h-2 w-2 rounded-full", s.cls)} />
            {s.label} {s.n}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ProgressTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectProgress(projectId)

  if (isLoading) return <ListSkeleton />
  if (!data) return null

  const { summary, byTeam, byMember, trend, upcoming, seo, seoTotals } = data

  if (summary.total === 0 && seo.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nothing to report yet"
        description="Once tasks are created or a site is tracked, this tab shows completion, punctuality and search performance."
      />
    )
  }

  const peakWeek = Math.max(1, ...trend.map((t) => Math.max(t.completed, t.due)))

  return (
    <div className="space-y-4">
      {/* Headline delivery numbers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeadStat
          label="Completion"
          value={
            summary.completionRate == null ? "no data" : `${summary.completionRate.toFixed(0)}%`
          }
          sub={`${summary.done} of ${summary.total - summary.discarded} tasks done`}
          icon={CheckCircle2}
          tone={
            summary.completionRate == null
              ? "muted"
              : summary.completionRate >= 70
                ? "good"
                : summary.completionRate >= 40
                  ? "warn"
                  : "bad"
          }
        />
        <HeadStat
          label="On time"
          value={summary.onTimeRate == null ? "no data" : `${summary.onTimeRate.toFixed(0)}%`}
          sub={
            summary.onTime + summary.late === 0
              ? "nothing completed with a due date"
              : `${summary.onTime} on time, ${summary.late} late`
          }
          icon={Clock}
          tone={
            summary.onTimeRate == null
              ? "muted"
              : summary.onTimeRate >= 85
                ? "good"
                : summary.onTimeRate >= 60
                  ? "warn"
                  : "bad"
          }
        />
        <HeadStat
          label="Overdue"
          value={String(summary.overdue)}
          sub={summary.overdue === 0 ? "nothing past its due date" : "open and past due"}
          icon={AlertTriangle}
          tone={summary.overdue === 0 ? "good" : "bad"}
        />
        <HeadStat
          label="Hours"
          value={`${summary.loggedHours} / ${summary.estimatedHours}`}
          sub="logged against estimated"
          icon={Gauge}
          tone="muted"
        />
      </div>

      {/* Status mix + weekly pace */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">Where the work stands</p>
            <StatusBar b={summary} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">Weekly pace</p>
              <span className="text-muted-foreground text-[11px]">completed vs due, 8 weeks</span>
            </div>
            <div className="flex h-24 items-end gap-1.5">
              {trend.map((w) => (
                <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-20 w-full items-end justify-center gap-0.5">
                    <div
                      className="w-1/2 rounded-t bg-emerald-500"
                      style={{ height: `${(w.completed / peakWeek) * 100}%` }}
                      title={`${w.completed} completed`}
                    />
                    <div
                      className="bg-muted-foreground/30 w-1/2 rounded-t"
                      style={{ height: `${(w.due / peakWeek) * 100}%` }}
                      title={`${w.due} due`}
                    />
                  </div>
                  <span className="text-muted-foreground text-[9px]">
                    {w.weekStart.slice(8)}/{w.weekStart.slice(5, 7)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team performance */}
      <Card>
        <CardContent className="p-0">
          <div className="border-border border-b px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-3.5 w-3.5" /> Team performance
            </p>
            <p className="text-muted-foreground text-xs">
              Completion and punctuality per team on this project.
            </p>
          </div>
          {byTeam.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">No teams yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-border border-b text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Team</th>
                    <th className="px-4 py-2 text-right font-medium">Tasks</th>
                    <th className="px-4 py-2 text-right font-medium">Done</th>
                    <th className="px-4 py-2 text-right font-medium">Overdue</th>
                    <th className="px-4 py-2 text-right font-medium">Completion</th>
                    <th className="px-4 py-2 text-right font-medium">On time</th>
                    <th className="px-4 py-2 text-right font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {byTeam.map((t) => (
                    <tr key={t.id} className="border-border/60 border-b last:border-0">
                      <td className="px-4 py-2">
                        <span className="font-medium">{t.name}</span>
                        {t.members > 0 && (
                          <span className="text-muted-foreground ml-1.5 text-xs">
                            {t.members} member{t.members === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{t.total}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{t.done}</td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right tabular-nums",
                          t.overdue > 0 && "font-medium text-red-600",
                        )}
                      >
                        {t.overdue}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Rate value={t.completionRate} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Rate value={t.onTimeRate} />
                      </td>
                      <td className="text-muted-foreground px-4 py-2 text-right text-xs tabular-nums">
                        {t.loggedHours} / {t.estimatedHours}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member performance */}
      {byMember.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-border border-b px-4 py-3">
              <p className="text-sm font-medium">Who is delivering</p>
              <p className="text-muted-foreground text-xs">
                Per person on this project, busiest first.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-border border-b text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Member</th>
                    <th className="px-4 py-2 text-right font-medium">Tasks</th>
                    <th className="px-4 py-2 text-right font-medium">Done</th>
                    <th className="px-4 py-2 text-right font-medium">Overdue</th>
                    <th className="px-4 py-2 text-right font-medium">Completion</th>
                    <th className="px-4 py-2 text-right font-medium">On time</th>
                  </tr>
                </thead>
                <tbody>
                  {byMember.map((m) => (
                    <tr key={m.id} className="border-border/60 border-b last:border-0">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <AvatarDisplay
                            src={m.profilePhoto}
                            firstName={m.name.split(" ")[0] ?? ""}
                            lastName={m.name.split(" ").slice(1).join(" ")}
                            size="xs"
                          />
                          <span className="font-medium">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{m.total}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{m.done}</td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right tabular-nums",
                          m.overdue > 0 && "font-medium text-red-600",
                        )}
                      >
                        {m.overdue}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Rate value={m.completionRate} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Rate value={m.onTimeRate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search performance */}
      {seo.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-border border-b px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Search className="h-3.5 w-3.5" /> Search performance
                </p>
                {seoTotals && (
                  <span className="text-muted-foreground text-xs">
                    {num(seoTotals.clicks)} clicks, {num(seoTotals.impressions)} impressions across{" "}
                    {seo.length} site{seo.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Latest synced week. Health score comes from the site scorecard.
              </p>
            </div>
            <div className="divide-border/60 divide-y">
              {seo.map((s) => (
                <SeoRow key={s.id} site={s} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* What is due next */}
      {upcoming.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-border border-b px-4 py-3">
              <p className="text-sm font-medium">Due next</p>
              <p className="text-muted-foreground text-xs">
                Open work, soonest first. Overdue items are flagged.
              </p>
            </div>
            <div className="divide-border/60 divide-y">
              {upcoming.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium" title={t.title}>
                    {t.title}
                  </span>
                  <StatusBadge
                    status={t.priority}
                    colorMap={TASK_PRIORITY_COLORS}
                    labelMap={TASK_PRIORITY_LABELS}
                    size="xs"
                  />
                  {t.teamName && (
                    <span className="text-muted-foreground text-xs">{t.teamName}</span>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {t.assigneeName ?? "Unassigned"}
                  </span>
                  <span
                    className={cn(
                      "text-xs whitespace-nowrap",
                      t.overdue ? "font-medium text-red-600" : "text-muted-foreground",
                    )}
                  >
                    {t.overdue && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}
                    {formatDate(t.dueDate)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SeoRow({ site }: { site: SeoSiteProgress }) {
  const BAND: Record<string, string> = {
    HEALTHY: "text-emerald-600",
    WATCH: "text-amber-600",
    INTERVENE: "text-orange-600",
    ESCALATE: "text-red-600",
  }
  const up = site.clicksChange != null && site.clicksChange > 0
  const flat = site.clicksChange == null || site.clicksChange === 0
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-40 flex-1">
        <p className="text-sm font-medium">{site.label}</p>
        <p className="text-muted-foreground truncate text-xs">{site.domain}</p>
      </div>

      <div className="text-right">
        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Clicks</p>
        <p className="flex items-center justify-end gap-1 text-sm font-semibold tabular-nums">
          {num(site.clicks)}
          {site.clicksChange != null && (
            <span
              className={cn(
                "flex items-center text-[11px]",
                flat ? "text-muted-foreground" : up ? "text-emerald-600" : "text-red-600",
              )}
            >
              <Icon className="h-3 w-3" />
              {Math.abs(site.clicksChange)}
            </span>
          )}
        </p>
      </div>

      <div className="text-right">
        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Impressions</p>
        <p className="text-sm font-semibold tabular-nums">{num(site.impressions)}</p>
      </div>

      <div className="text-right">
        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Avg position</p>
        <p className="text-sm font-semibold tabular-nums">
          {site.position > 0 ? site.position.toFixed(1) : "-"}
        </p>
      </div>

      <div className="text-right">
        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Health</p>
        {site.score == null ? (
          <p className="text-muted-foreground text-xs">not scored</p>
        ) : (
          <p className={cn("text-sm font-semibold", BAND[site.band ?? ""] ?? "")}>
            {site.score.toFixed(0)}
            <span className="text-muted-foreground ml-1 text-[10px] font-normal">
              at {site.coverage?.toFixed(0)}% coverage
            </span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-1.5">
        {site.criticalAlerts > 0 && (
          <Badge variant="outline" className="border-red-500/40 text-[10px] text-red-600">
            {site.criticalAlerts} critical
          </Badge>
        )}
        {site.overdueTasks > 0 && (
          <Badge variant="outline" className="border-red-500/40 text-[10px] text-red-600">
            {site.overdueTasks} late
          </Badge>
        )}
        {site.openTasks > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {site.openTasks} open
          </Badge>
        )}
      </div>
    </div>
  )
}

function HeadStat({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone: "good" | "warn" | "bad" | "muted"
}) {
  const cls = {
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-red-600",
    muted: "text-foreground",
  }[tone]
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium tracking-widest uppercase">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        <p className={cn("mt-1 text-2xl font-semibold", cls)}>{value}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>
      </CardContent>
    </Card>
  )
}
