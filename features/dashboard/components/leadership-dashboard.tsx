"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Briefcase,
  CalendarOff,
  Clock,
  FolderKanban,
  Gauge,
  Inbox,
  LogOut,
  PartyPopper,
  Target,
  UserPlus,
  Wallet,
} from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { apiFetch } from "@/lib/api-fetch"
import { cn, formatCurrency } from "@/lib/utils"
import { projectHref } from "@/features/projects/lib/project-href"
import type {
  LeadPerson,
  LeadershipDashboard as Data,
  ScoredLead,
} from "../server/leadership.queries"

const scoreTone = (s: number | null) =>
  s === null
    ? "text-muted-foreground"
    : s >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : s >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive"

/** A headline number that opens where it comes from. */
function Tile({
  href,
  title,
  value,
  suffix,
  sub,
  icon: Icon,
  tone,
}: {
  href: string
  title: string
  value: string | number
  suffix?: string
  sub: React.ReactNode
  icon: React.ElementType
  tone?: "warn" | "bad" | "good"
}) {
  return (
    <Link
      href={href}
      className="bg-card hover:border-foreground/25 focus-visible:ring-ring block rounded-sm border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {title}
        </p>
        <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-destructive",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
        {suffix && <span className="text-muted-foreground ml-1 text-sm font-normal">{suffix}</span>}
      </p>
      <p className="text-muted-foreground mt-1 truncate text-xs">{sub}</p>
    </Link>
  )
}

function PersonRow({ p }: { p: LeadPerson }) {
  const [first, ...rest] = p.name.split(" ")
  return (
    <li>
      <Link
        href={`/employees/${p.id}`}
        className="hover:bg-muted/40 flex items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors"
      >
        <AvatarDisplay
          src={p.profilePhoto}
          firstName={first ?? ""}
          lastName={rest.join(" ")}
          size="chip"
        />
        <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
        <span className="text-muted-foreground shrink-0 text-[11px]">{p.note ?? p.department}</span>
      </Link>
    </li>
  )
}

function PeopleGroup({
  title,
  people,
  empty,
  more,
}: {
  title: string
  people: LeadPerson[]
  empty: string
  more?: { href: string; label: string }
}) {
  const shown = people.slice(0, 6)
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground px-2 text-[11px] font-medium tracking-wide uppercase">
        {title} <span className="tabular-nums">({people.length})</span>
      </p>
      {people.length === 0 ? (
        <p className="text-muted-foreground px-2 text-xs">{empty}</p>
      ) : (
        <ul>
          {shown.map((p) => (
            <PersonRow key={p.id} p={p} />
          ))}
        </ul>
      )}
      {people.length > shown.length && more && (
        <Link href={more.href} className="text-primary block px-2 text-xs hover:underline">
          and {people.length - shown.length} more - {more.label}
        </Link>
      )}
    </div>
  )
}

function ScoreList({ title, rows }: { title: string; rows: ScoredLead[] }) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nobody yet.</p>
      ) : (
        <ul className="divide-y rounded-sm border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  {[
                    r.score.deliverables.due > 0 &&
                      `deliverables ${r.score.deliverables.onTime}/${r.score.deliverables.due}`,
                    r.score.tasks.due > 0 && `tasks ${r.score.tasks.onTime}/${r.score.tasks.due}`,
                    r.score.goals.count > 0 && `goals ${r.score.goals.score}%`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className={cn("text-lg font-semibold tabular-nums", scoreTone(r.score.score))}>
                {r.score.score}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HrRow({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="hover:bg-muted/40 flex items-center gap-3 rounded-sm px-2 py-2 transition-colors"
      >
        <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{value}</span>
      </Link>
    </li>
  )
}

/** The admin's home page: the company today and what needs a decision or a look. */
export function LeadershipDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard-leadership"],
    queryFn: () => apiFetch<{ data: Data }>("/api/dashboard/leadership").then((r) => r.data),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  })

  if (isError) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-sm border px-4 py-3 text-sm">
        {error instanceof Error ? error.message : "Could not load the dashboard."}
      </div>
    )
  }
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-sm" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-sm lg:col-span-2" />
          <Skeleton className="h-72 rounded-sm" />
        </div>
      </div>
    )
  }

  const { people, attendance, approvals, projects, performance, hr } = data
  const waiting = approvals.leave + approvals.wfh + approvals.resignations
  const fullAway = people.away.filter((p) => p.note !== "Half day").length

  return (
    <div className="space-y-4">
      {people.holiday && (
        <div className="flex items-center gap-2 rounded-sm border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <PartyPopper className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Today is a company holiday: <span className="font-semibold">{people.holiday}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile
          href="/attendance/attendance-directory"
          title="In today"
          value={attendance.in}
          suffix={`of ${attendance.expected}`}
          sub={`${attendance.notIn.length} not in yet${attendance.halfDay ? ` · ${attendance.halfDay} half day` : ""}`}
          icon={Clock}
          tone={attendance.notIn.length > 0 ? "warn" : "good"}
        />
        <Tile
          href="/leave/leave-directory"
          title="Away today"
          value={fullAway}
          suffix={`of ${people.working}`}
          sub={`${people.wfh.length} working from home`}
          icon={CalendarOff}
        />
        <Tile
          href={
            approvals.leave > 0 || approvals.wfh === 0 ? "/leave/leave-directory" : "/wfh/requests"
          }
          title="Waiting for a decision"
          value={waiting}
          sub={`${approvals.leave} leave · ${approvals.wfh} WFH · ${approvals.resignations} resignation${approvals.resignations === 1 ? "" : "s"}`}
          icon={Inbox}
          tone={waiting > 0 ? "warn" : undefined}
        />
        <Tile
          href="/projects/my-projects"
          title="Active projects"
          value={projects.active}
          sub={`${projects.overdueTasks} overdue tasks · ${projects.lateDeliverables} late deliverables`}
          icon={FolderKanban}
        />
        <Tile
          href="/projects/progress"
          title="Goals need attention"
          value={projects.goals.needAttention}
          suffix={`of ${projects.goals.total}`}
          sub={`${projects.goals.done} done`}
          icon={Target}
          tone={projects.goals.needAttention > 0 ? "warn" : undefined}
        />
        <Tile
          href="/projects/performance"
          title="Delivery score"
          value={performance.average ?? "-"}
          suffix={performance.average !== null ? "/100" : undefined}
          sub={`average of ${performance.scored} people this month`}
          icon={Gauge}
          tone={
            performance.average === null
              ? undefined
              : performance.average >= 80
                ? "good"
                : performance.average >= 60
                  ? "warn"
                  : "bad"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Projects needing a look</CardTitle>
            <p className="text-muted-foreground text-xs">
              Goals at risk or behind, overdue tasks and late deliverables - worst first.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {projects.attention.length === 0 ? (
              <p className="text-muted-foreground px-6 pb-6 text-sm">
                Every active project is on track.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-y text-left text-[11px] tracking-wide uppercase">
                      <th className="px-4 py-2 font-medium">Project</th>
                      <th className="px-3 py-2 text-right font-medium">Goals</th>
                      <th className="px-3 py-2 text-right font-medium">Overdue tasks</th>
                      <th className="px-4 py-2 text-right font-medium">Late deliverables</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {projects.attention.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <Link
                            href={projectHref(p, "goals")}
                            className="font-medium hover:underline"
                          >
                            {p.name}
                          </Link>
                          <span className="text-muted-foreground block text-[11px]">
                            {p.accountManager ?? "no account manager"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {p.goalsNeedingAttention > 0 ? (
                            <Link
                              href={projectHref(p, "goals")}
                              className="text-amber-600 hover:underline dark:text-amber-400"
                            >
                              {p.goalsNeedingAttention} need attention
                            </Link>
                          ) : p.goalsProgress !== null ? (
                            <span className="text-muted-foreground">{p.goalsProgress}%</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {p.overdueTasks > 0 ? (
                            <Link
                              href={projectHref(p, "tasks")}
                              className="text-destructive hover:underline"
                            >
                              {p.overdueTasks}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {p.lateDeliverables > 0 ? (
                            <Link
                              href={projectHref(p, "deliverables")}
                              className="text-destructive hover:underline"
                            >
                              {p.lateDeliverables}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PeopleGroup title="Away" people={people.away} empty="Everyone is in." />
            <PeopleGroup
              title="Working from home"
              people={people.wfh}
              empty="Nobody is working from home."
            />
            <PeopleGroup
              title="Not in yet"
              people={attendance.notIn}
              empty="Everyone expected has checked in."
              more={{ href: "/attendance/attendance-directory", label: "see attendance" }}
            />
            {people.birthdays.length > 0 && (
              <PeopleGroup title="Birthdays" people={people.birthdays} empty="" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="text-sm">Delivery this month</CardTitle>
              <Link href="/projects/performance" className="text-primary text-xs hover:underline">
                Team Performance →
              </Link>
            </div>
            <p className="text-muted-foreground text-xs">
              Goals owned, deliverables and tasks on time. People with fewer than 3 items due are
              left out.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row">
            <ScoreList title="Doing best" rows={performance.top} />
            <ScoreList title="Could use support" rows={performance.needsSupport} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="text-sm">People and hiring</CardTitle>
              <Link href="/analytics" className="text-primary text-xs hover:underline">
                Analytics →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <ul>
              <HrRow
                href="/employees/employee-directory"
                icon={UserPlus}
                label="Joined this month"
                value={hr.newJoinersThisMonth}
              />
              <HrRow
                href="/onboarding"
                icon={UserPlus}
                label="Onboarding in progress"
                value={hr.onboarding}
              />
              <HrRow
                href="/exit-clearance"
                icon={LogOut}
                label="Serving notice"
                value={hr.servingNotice}
              />
              <HrRow
                href="/recruitment/applications"
                icon={Briefcase}
                label="Open jobs"
                value={`${hr.openJobs} · ${hr.applicantsThisMonth} applicants`}
              />
              <HrRow
                href="/payroll/payroll-directory"
                icon={Wallet}
                label={hr.payroll ? `Payroll ${hr.payroll.period}` : "Last payroll"}
                value={hr.payroll ? formatCurrency(hr.payroll.net) : "not run"}
              />
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
