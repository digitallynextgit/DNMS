"use client"

import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  Briefcase,
  Cake,
  CalendarOff,
  Clock,
  FolderKanban,
  Gauge,
  Home,
  Inbox,
  LogOut,
  PartyPopper,
  Target,
  TriangleAlert,
  UserPlus,
  UserRoundPlus,
  Wallet,
} from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { apiFetch } from "@/lib/api-fetch"
import { cn, formatCurrency } from "@/lib/utils"
import { projectHref } from "@/features/projects/lib/project-href"
import type {
  LeadPerson,
  LeadershipDashboard as Data,
  ProjectAttention,
  ScoredLead,
} from "../server/leadership.queries"

type Tone = "good" | "warn" | "bad"

const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
}
const TONE_BAR: Record<Tone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
}
const scoreToneOf = (s: number): Tone => (s >= 80 ? "good" : s >= 60 ? "warn" : "bad")

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
  tone?: Tone
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
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", tone && TONE_TEXT[tone])}>
        {value}
        {suffix && <span className="text-muted-foreground ml-1 text-sm font-normal">{suffix}</span>}
      </p>
      <p className="text-muted-foreground mt-1 truncate text-xs">{sub}</p>
    </Link>
  )
}

/** A panel: a title, a one-line explainer, an optional "see all" link, and its body. */
function Panel({
  title,
  hint,
  more,
  className,
  children,
}: {
  title: string
  hint?: string
  more?: { href: string; label: string }
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
        </div>
        {more && (
          <Link
            href={more.href}
            className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
          >
            {more.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <CardContent className="flex-1 p-0">{children}</CardContent>
    </Card>
  )
}

/** A count that is quiet at zero and coloured once there is something to act on. */
function CountPill({
  n,
  href,
  tone,
  title,
}: {
  n: number
  href: string
  tone: Tone
  title: string
}) {
  if (n === 0) {
    return <span className="text-muted-foreground/60 w-10 text-center text-sm tabular-nums">0</span>
  }
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "w-10 rounded-sm py-1 text-center text-sm font-semibold tabular-nums transition-opacity hover:opacity-80",
        tone === "bad"
          ? "bg-red-500/10 text-red-600 dark:text-red-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {n}
    </Link>
  )
}

function ProjectRow({ p }: { p: ProjectAttention }) {
  const severe = p.goalsNeedingAttention > 0 || p.overdueTasks + p.lateDeliverables >= 20
  return (
    <li className="hover:bg-muted/30 grid grid-cols-[minmax(0,1fr)_7.5rem_2.5rem_2.5rem] items-center gap-x-4 px-5 py-3 transition-colors sm:grid-cols-[minmax(0,1fr)_9rem_3.5rem_3.5rem]">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={cn("h-8 w-1 shrink-0 rounded-full", severe ? "bg-red-500" : "bg-amber-500")}
        />
        <div className="min-w-0">
          <Link
            href={projectHref(p)}
            className="block truncate text-sm font-semibold hover:underline"
            title={p.name}
          >
            {p.name}
          </Link>
          <p className="text-muted-foreground truncate text-xs">
            {p.accountManager ?? "No account manager"}
          </p>
        </div>
      </div>

      {/* Goals: a short bar of progress, or the count that needs attention. */}
      <div className="min-w-0">
        {p.goalsNeedingAttention > 0 ? (
          <Link
            href={projectHref(p, "goals")}
            className="inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
          >
            <Target className="h-3 w-3" /> {p.goalsNeedingAttention} need attention
          </Link>
        ) : p.goalsProgress !== null ? (
          <Link href={projectHref(p, "goals")} className="group block" title="Goal progress">
            <span className="text-muted-foreground text-[11px] tabular-nums group-hover:underline">
              {p.goalsProgress}% of goals
            </span>
            <span className="bg-muted mt-1 block h-1.5 overflow-hidden rounded-full">
              <span
                className="bg-primary block h-full rounded-full"
                style={{ width: `${Math.max(2, p.goalsProgress)}%` }}
              />
            </span>
          </Link>
        ) : (
          <Link
            href={projectHref(p, "goals")}
            className="text-muted-foreground text-xs hover:underline"
          >
            No goals set
          </Link>
        )}
      </div>

      <CountPill
        n={p.overdueTasks}
        href={projectHref(p, "tasks")}
        tone={p.overdueTasks >= 10 ? "bad" : "warn"}
        title="Overdue tasks"
      />
      <CountPill
        n={p.lateDeliverables}
        href={projectHref(p, "deliverables")}
        tone={p.lateDeliverables >= 10 ? "bad" : "warn"}
        title="Late deliverables"
      />
    </li>
  )
}

function Avatar({ p }: { p: LeadPerson }) {
  const [first, ...rest] = p.name.split(" ")
  return (
    <AvatarDisplay
      src={p.profilePhoto}
      firstName={first ?? ""}
      lastName={rest.join(" ")}
      size="chip"
    />
  )
}

/** One of Today's counters. */
function TodayStat({
  icon: Icon,
  label,
  n,
  tone,
}: {
  icon: React.ElementType
  label: string
  n: number
  tone?: Tone
}) {
  return (
    <div className="bg-muted/20 rounded-sm border px-3 py-2.5">
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          n > 0 && tone ? TONE_TEXT[tone] : n === 0 && "text-muted-foreground",
        )}
      >
        {n}
      </p>
    </div>
  )
}

function PeopleList({
  title,
  people,
  more,
}: {
  title: string
  people: LeadPerson[]
  more?: { href: string; label: string }
}) {
  if (people.length === 0) return null
  const shown = people.slice(0, 8)
  return (
    <div>
      {title && (
        <p className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
          {title}
        </p>
      )}
      <ul className="grid gap-x-3 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {shown.map((p) => (
          <li key={p.id}>
            <Link
              href={`/employees/${p.id}`}
              className="hover:bg-muted/40 flex items-center gap-2 rounded-sm px-1.5 py-1 transition-colors"
              title={[p.name, p.note ?? p.department].filter(Boolean).join(" - ")}
            >
              <Avatar p={p} />
              <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
              {p.note && (
                <span className="text-muted-foreground shrink-0 text-[11px]">{p.note}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {people.length > shown.length && more && (
        <Link
          href={more.href}
          className="text-primary mt-1 inline-flex items-center gap-1 px-1.5 text-xs hover:underline"
        >
          {people.length - shown.length} more - {more.label} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

function ScoreRow({ r, rank }: { r: ScoredLead; rank: number }) {
  const s = r.score.score ?? 0
  const tone = scoreToneOf(s)
  const bits = [
    r.score.deliverables.due > 0 &&
      `Deliverables ${r.score.deliverables.onTime}/${r.score.deliverables.due}`,
    r.score.tasks.due > 0 && `Tasks ${r.score.tasks.onTime}/${r.score.tasks.due}`,
    r.score.goals.count > 0 && `Goals ${r.score.goals.score}%`,
  ].filter(Boolean)
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-muted-foreground w-4 shrink-0 text-right text-xs tabular-nums">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link
            href={`/employees/${r.id}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {r.name}
          </Link>
          <span className={cn("shrink-0 text-sm font-semibold tabular-nums", TONE_TEXT[tone])}>
            {s}
          </span>
        </div>
        <span className="bg-muted mt-1 block h-1 overflow-hidden rounded-full">
          <span
            className={cn("block h-full rounded-full", TONE_BAR[tone])}
            style={{ width: `${Math.max(2, s)}%` }}
          />
        </span>
        <p className="text-muted-foreground mt-1 truncate text-[11px]">{bits.join(" · ")}</p>
      </div>
    </li>
  )
}

function ScoreColumn({ title, rows, empty }: { title: string; rows: ScoredLead[]; empty: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-muted-foreground px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide uppercase">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-3 text-xs">{empty}</p>
      ) : (
        <ol className="divide-border/60 divide-y">
          {rows.map((r, i) => (
            <ScoreRow key={r.id} r={r} rank={i + 1} />
          ))}
        </ol>
      )}
    </div>
  )
}

function HrTile({
  href,
  icon: Icon,
  label,
  value,
  sub,
  className,
}: {
  href: string
  icon: React.ElementType
  label: string
  value: React.ReactNode
  sub?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "hover:border-foreground/25 bg-muted/20 block rounded-sm border px-3 py-2.5 transition-colors",
        className,
      )}
    >
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground truncate text-[11px]">{sub}</p>}
    </Link>
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-sm" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-sm lg:col-span-2" />
          <Skeleton className="h-80 rounded-sm" />
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

      {/* Two rows of four: the people today, then the work. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          sub={fullAway === 0 ? "Nobody is on leave" : "On leave or a holiday"}
          icon={CalendarOff}
        />
        <Tile
          href="/wfh/requests"
          title="Working from home"
          value={people.wfh.length}
          sub={people.wfh.length === 0 ? "Everyone is at the office" : "Approved for today"}
          icon={Home}
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
          sub={`${projects.attention.length} need a look`}
          icon={FolderKanban}
        />
        <Tile
          href="/projects/my-projects"
          title="Overdue work"
          value={projects.overdueTasks + projects.lateDeliverables}
          sub={`${projects.overdueTasks} tasks · ${projects.lateDeliverables} deliverables`}
          icon={TriangleAlert}
          tone={projects.overdueTasks + projects.lateDeliverables > 0 ? "bad" : "good"}
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
          sub={`Average of ${performance.scored} people this month`}
          icon={Gauge}
          tone={performance.average === null ? undefined : scoreToneOf(performance.average)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Projects needing a look"
          hint="Worst first - click a number to open those items."
          more={{ href: "/projects/my-projects", label: "All projects" }}
          className="lg:col-span-2"
        >
          {projects.attention.length === 0 ? (
            <p className="text-muted-foreground px-5 py-8 text-center text-sm">
              Every active project is on track.
            </p>
          ) : (
            <>
              <div className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_7.5rem_2.5rem_2.5rem] gap-x-4 border-b px-5 py-2 text-[10px] font-medium tracking-wider uppercase sm:grid-cols-[minmax(0,1fr)_9rem_3.5rem_3.5rem]">
                <span>Project</span>
                <span>Goals</span>
                <span className="text-center" title="Overdue tasks">
                  Tasks
                </span>
                <span className="text-center" title="Late deliverables">
                  Deliv.
                </span>
              </div>
              <ul className="divide-border/60 divide-y">
                {projects.attention.map((p) => (
                  <ProjectRow key={p.id} p={p} />
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel title="Today" hint="Who is in, away or working from home.">
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-3 gap-2">
              <TodayStat icon={Clock} label="Not in yet" n={attendance.notIn.length} tone="warn" />
              <TodayStat icon={CalendarOff} label="Away" n={people.away.length} />
              <TodayStat icon={Home} label="WFH" n={people.wfh.length} />
            </div>
            <PeopleList
              title="Not in yet"
              people={attendance.notIn}
              more={{ href: "/attendance/attendance-directory", label: "see attendance" }}
            />
            <PeopleList title="Away" people={people.away} />
            <PeopleList title="Working from home" people={people.wfh} />
            {people.birthdays.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
                  <Cake className="h-3.5 w-3.5" /> Birthdays today
                </p>
                <PeopleList title="" people={people.birthdays} />
              </div>
            )}
            {attendance.notIn.length === 0 &&
              people.away.length === 0 &&
              people.wfh.length === 0 && (
                <p className="text-muted-foreground text-center text-sm">Everyone is in today.</p>
              )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Delivery this month"
          hint="Goals owned, deliverables and tasks on time. Fewer than 3 items due are left out."
          more={{ href: "/projects/performance", label: "Team Performance" }}
          className="lg:col-span-2"
        >
          <div className="divide-border/60 flex flex-col pb-2 sm:flex-row sm:divide-x">
            <ScoreColumn
              title="Doing best"
              rows={performance.top}
              empty="Nobody has enough work due yet."
            />
            <ScoreColumn
              title="Could use support"
              rows={performance.needsSupport}
              empty="Nobody is falling behind."
            />
          </div>
        </Panel>

        <Panel title="People and hiring" more={{ href: "/analytics", label: "Analytics" }}>
          <div className="grid grid-cols-2 gap-2 p-5">
            <HrTile
              href="/employees/employee-directory"
              icon={UserPlus}
              label="Joined this month"
              value={hr.newJoinersThisMonth}
            />
            <HrTile
              href="/onboarding"
              icon={UserRoundPlus}
              label="Onboarding"
              value={hr.onboarding}
              sub="in progress"
            />
            <HrTile
              href="/exit-clearance"
              icon={LogOut}
              label="Serving notice"
              value={hr.servingNotice}
            />
            <HrTile
              href="/recruitment/applications"
              icon={Briefcase}
              label="Open jobs"
              value={hr.openJobs}
              sub={`${hr.applicantsThisMonth} applicants this month`}
            />
            <HrTile
              href="/payroll/payroll-directory"
              icon={Wallet}
              label={hr.payroll ? `Payroll · ${hr.payroll.period}` : "Last payroll"}
              value={hr.payroll ? formatCurrency(hr.payroll.net) : "Not run yet"}
              sub={hr.payroll ? `${hr.payroll.count} payslips` : undefined}
              className="col-span-2"
            />
          </div>
        </Panel>
      </div>
    </div>
  )
}
