"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { CalendarDays, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { useProject } from "../hooks/use-projects"
import type { MemberProgress } from "../hooks/use-projects"
import { useProjectGoals } from "../hooks/use-goals"
import {
  currentPlanMonth,
  formatMonth,
  monthISO,
  parseMonth,
  shiftMonth,
} from "../lib/calendar-months"
import { mainGoalVerdict, type GoalVerdict } from "../lib/goal-accountability"
import type { GoalNode } from "../lib/goal-derivation"
import { serviceInfo } from "../lib/project-services"
import type { CalendarOverview } from "../server/calendar-overview.queries"
import { GoalGrowthDialog } from "./goal-growth-dialog"
import { GoalNumber } from "./goal-number"
import { ProgressBar, StatusBadge } from "./goal-status"
import { VerdictChip, VerdictDialog } from "./goal-verdict"
import { ProgressOverview } from "./progress-overview"
import { ProjectProgressDetail } from "./project-progress-detail"
import { MemberProgressDialog } from "./member-progress-dialog"

// The project's Analytics: how it stands (goals and their verdicts, task progress), its goals'
// growth, its teams and people, and its calendars. Meta Ads sits beside these.

function todayUtc() {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

function MonthStepper({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const ym = parseMonth(`${month}-01`)!
  const step = (by: number) => {
    const m = shiftMonth(ym, by)
    onChange(monthISO(m.year, m.month0).slice(0, 7))
  }
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="w-28 text-center text-sm font-medium">{formatMonth(`${month}-01`)}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => step(1)}
        disabled={month >= currentPlanMonth()}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

/** Each numbered goal this month with its number and verdict; opens the reasons. */
function GoalStanding({ projectId, month }: { projectId: string; month: string }) {
  const { data, isLoading } = useProjectGoals(projectId, false, month)
  const project = useProject(projectId)
  const owner = project.data?.data?.owner
  const amName = owner ? `${owner.firstName} ${owner.lastName ?? ""}`.trim() : null
  const [why, setWhy] = React.useState<{ title: string; verdict: GoalVerdict } | null>(null)

  if (isLoading) return <Skeleton className="h-40 rounded-sm" />
  const today = todayUtc()
  const numbered = (data?.goals ?? []).filter(
    (g: GoalNode) =>
      g.isActive && (g.targetValue !== null || g.children.some((c) => c.targetValue !== null)),
  )
  const rows = numbered.map((g) => ({
    goal: g,
    verdict: mainGoalVerdict(g, data?.plans ?? {}, amName, today),
  }))
  const achieved = rows.filter((r) => r.verdict?.kind === "ACHIEVED").length
  const attention = rows.filter((r) => r.verdict?.tone === "bad" || r.verdict?.tone === "warn")

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Goals with a number</h3>
          {rows.length > 0 && (
            <span className="text-muted-foreground text-xs">
              {achieved} of {rows.length} achieved · {attention.length} need attention
            </span>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No goal has a number for this month. Add one on the Goals tab to see where it stands.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map(({ goal, verdict }) => (
              <li key={goal.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                <div className="min-w-48 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {goal.title}
                    {verdict && (
                      <VerdictChip
                        verdict={verdict}
                        onClick={() => setWhy({ title: goal.title, verdict })}
                      />
                    )}
                  </p>
                  {verdict && (
                    <p className="text-muted-foreground mt-0.5 text-[11px]">{verdict.summary}</p>
                  )}
                </div>
                {goal.targetValue !== null && <GoalNumber goal={goal} compact />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <VerdictDialog
        title={why?.title ?? ""}
        verdict={why?.verdict ?? null}
        onClose={() => setWhy(null)}
      />
    </Card>
  )
}

export function AnalyticsOverview({
  projectId,
  canManage,
}: {
  projectId: string
  canManage: boolean
}) {
  const { data: session } = useSession()
  const [month, setMonth] = React.useState(currentPlanMonth())
  return (
    <div className="space-y-4">
      <MonthStepper month={month} onChange={setMonth} />
      <GoalStanding projectId={projectId} month={month} />
      <ProgressOverview
        projectId={projectId}
        currentUserId={session?.user?.id ?? ""}
        isAdmin={canManage}
      />
    </div>
  )
}

/** Every repeating goal, and the plain numbers of each month's edition, with the growth chart a click away. */
export function AnalyticsGoals({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectGoals(projectId)
  const [growth, setGrowth] = React.useState<string | null>(null)
  if (isLoading) return <Skeleton className="h-40 rounded-sm" />
  const series = data?.series ?? []
  const oneTime = (data?.goals ?? []).filter((g) => !g.seriesId && g.isActive)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-semibold">Repeating goals</h3>
          {series.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No goal repeats every month yet. Turn on &ldquo;Repeats every month&rdquo; when you
              add one to track its growth here.
            </p>
          ) : (
            <ul className="divide-y">
              {series.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {s.title}
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      {s.months.length} month{s.months.length === 1 ? "" : "s"}
                      {s.stoppedAt ? " · stopped repeating" : ""}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setGrowth(s.id)}
                  >
                    <TrendingUp className="h-3.5 w-3.5" /> Growth
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-semibold">One-time goals</h3>
          {oneTime.length === 0 ? (
            <p className="text-muted-foreground text-xs">None.</p>
          ) : (
            <ul className="divide-y">
              {oneTime.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 text-sm">{g.title}</span>
                  <StatusBadge status={g.status} />
                  {g.targetValue !== null ? (
                    <GoalNumber goal={g} compact />
                  ) : (
                    <div className="w-32">
                      <ProgressBar value={g.progress} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <GoalGrowthDialog projectId={projectId} seriesId={growth} onClose={() => setGrowth(null)} />
    </div>
  )
}

/** Task progress by team and person, with a person's tasks a click away. */
export function AnalyticsPeople({ projectId }: { projectId: string }) {
  const [span, setSpan] = React.useState<"month" | "all">("month")
  const [member, setMember] = React.useState<MemberProgress | null>(null)
  const month = currentPlanMonth()
  const ym = parseMonth(`${month}-01`)!
  const end = new Date(Date.UTC(ym.year, ym.month0 + 1, 0)).toISOString().slice(0, 10)
  const range = span === "month" ? { from: `${month}-01`, to: end } : undefined
  return (
    <div className="space-y-4">
      <SegmentedControl
        value={span}
        onChange={setSpan}
        options={[
          { value: "month", label: "This month" },
          { value: "all", label: "All time" },
        ]}
        aria-label="Period"
      />
      <ProjectProgressDetail projectId={projectId} range={range} onSelectMember={setMember} />
      <MemberProgressDialog
        projectId={projectId}
        member={member}
        range={range}
        onClose={() => setMember(null)}
      />
    </div>
  )
}

function useCalendarOverview(projectId: string, month: string) {
  return useQuery({
    queryKey: ["calendar-overview", projectId, month],
    queryFn: () =>
      apiFetch<{ data: { month: string; calendars: CalendarOverview[] } }>(
        `/api/projects/${projectId}/calendar-overview?month=${month}`,
      ).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

const TEAM_STATUS: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  STUCK: "Stuck",
  DISCARDED: "Discarded",
}

function CalendarCard({ c }: { c: CalendarOverview }) {
  const [open, setOpen] = React.useState(false)
  const p = c.progress
  const pct = p.quantity > 0 ? Math.round((p.handedIn / p.quantity) * 100) : null
  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="hover:bg-muted/30 flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left"
        >
          <CalendarDays className="text-muted-foreground h-4 w-4 shrink-0" />
          <div className="min-w-48 flex-1">
            <p className="text-sm font-medium">
              {c.name}
              {c.service && (
                <span className="bg-primary/10 text-primary ml-2 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold">
                  {serviceInfo(c.service)?.label ?? c.service}
                </span>
              )}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              {c.owner ? `managed by ${c.owner}` : "no manager"}
              {c.secondary ? ` · secondary ${c.secondary}` : ""}
              {" · "}
              {p.teamsDone}/{p.teams} teams done
              {p.nextDue ? ` · next due ${p.nextDue}` : ""}
            </p>
          </div>
          <div className="w-36 shrink-0">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-muted-foreground">handed in</span>
              <span className="tabular-nums">
                {p.handedIn}/{p.quantity || "-"}
              </span>
            </div>
            <ProgressBar value={pct ?? 0} className="mt-1" />
          </div>
        </button>
        {open && (
          <div className="grid gap-4 border-t px-4 py-3 text-xs md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-[10px] tracking-widest uppercase">Teams</p>
              {c.teams.length === 0 ? (
                <p className="text-muted-foreground">No team plan yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {c.teams.map((t) => (
                    <li key={t.teamName}>
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{t.teamName}</span>
                        <span
                          className={cn(
                            "text-[11px]",
                            t.status === "DONE"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : t.status === "STUCK"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground",
                          )}
                        >
                          {TEAM_STATUS[t.status] ?? t.status}
                        </span>
                        <span className="tabular-nums">
                          {t.handedIn}/{t.quantity || "-"}
                        </span>
                        {t.dueOn && <span className="text-muted-foreground">due {t.dueOn}</span>}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {t.members.length > 0 ? t.members.join(", ") : "nobody named"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-[10px] tracking-widest uppercase">Tabs</p>
              <ul className="space-y-1">
                {c.tabs.map((t) => (
                  <li key={t.name} className="flex justify-between gap-2">
                    <span>{t.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {t.rows} row{t.rows === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** The month's calendars: who runs each, the teams and people on it, and how far they are. */
export function AnalyticsCalendars({ projectId }: { projectId: string }) {
  const [month, setMonth] = React.useState(currentPlanMonth())
  const { data, isLoading } = useCalendarOverview(projectId, month)
  return (
    <div className="space-y-3">
      <MonthStepper month={month} onChange={setMonth} />
      {isLoading && !data ? (
        <Skeleton className="h-40 rounded-sm" />
      ) : (data?.calendars.length ?? 0) === 0 ? (
        <EmptyState
          title="No calendars this month"
          description="Calendars appear here once the project's services have one for the month."
        />
      ) : (
        data!.calendars.map((c) => <CalendarCard key={c.id} c={c} />)
      )}
    </div>
  )
}
