"use client"

import { useState } from "react"
import { CalendarDays } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { MonthNav } from "@/components/shared/month-nav"
import { StatStrip } from "@/components/shared/stat-strip"
import { StatusBadge } from "@/components/shared/status-badge"
import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from "@/lib/constants"
import { cn, formatDate } from "@/lib/utils"
import { useEmployeeWork } from "../hooks/use-employee-work"
import {
  MONTH_LABELS,
  currentPlanMonth,
  monthISO,
  parseMonth,
  shiftMonth,
} from "../lib/calendar-months"
import {
  dueSoon,
  type CalendarAssignment,
  type CalendarProgress,
  type OwnedCalendar,
  type OwnedService,
  type WorkProject,
  type WorkProjectRef,
} from "../lib/employee-work"
import { projectHref } from "../lib/project-href"
import { serviceInfo } from "../lib/project-services"
import { STATUS_LABEL, type WorkbookTeamStatus } from "../lib/workbook-team-progress"
import { ServiceChip } from "./service-chips"

const TEAM_STATUS_CLASS: Record<WorkbookTeamStatus, string> = {
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  DONE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  STUCK: "bg-destructive/15 text-destructive",
  DISCARDED: "bg-muted text-muted-foreground line-through",
}

const calendarHref = (project: WorkProjectRef, calendarId: string) =>
  `${projectHref(project)}?tab=calendar&calendar=${calendarId}`

function ProjectCell({ project }: { project: WorkProjectRef }) {
  return (
    <Link href={projectHref(project)} className="flex items-center gap-2 hover:underline">
      {project.shortName ? (
        <span className="bg-primary text-primary-foreground shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-bold">
          {project.shortName}
        </span>
      ) : null}
      <span className="font-medium">{project.name}</span>
    </Link>
  )
}

function CalendarLink({
  project,
  id,
  name,
}: {
  project: WorkProjectRef
  id: string
  name: string
}) {
  return (
    <Button variant="outline" className="h-8 gap-1.5 px-2.5" asChild>
      <Link href={calendarHref(project, id)}>
        <CalendarDays className="h-3.5 w-3.5" />
        {name}
      </Link>
    </Button>
  )
}

/** "12 / 20" with a thin bar; a plan with nothing quantified says so. */
function Delivered({ handedIn, quantity }: { handedIn: number; quantity: number }) {
  if (quantity === 0) return <span className="text-muted-foreground text-xs">Not set</span>
  const pct = Math.min(100, Math.round((handedIn / quantity) * 100))
  return (
    <span className="flex items-center gap-2">
      <span className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <span
          className={cn("block h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-xs tabular-nums">
        {handedIn} / {quantity}
      </span>
    </span>
  )
}

function DueDate({ date, open, today }: { date: string | null; open: boolean; today: string }) {
  if (!date) return <span className="text-muted-foreground text-xs">-</span>
  const late = open && date < today
  return (
    <span className={cn("text-xs tabular-nums", late && "text-destructive font-medium")}>
      {formatDate(date)}
      {late ? " · late" : ""}
    </span>
  )
}

function TeamsDone({ progress }: { progress: CalendarProgress }) {
  if (progress.teams === 0)
    return <span className="text-muted-foreground text-xs">No plan yet</span>
  return (
    <span className="text-xs tabular-nums">
      {progress.teamsDone} of {progress.teams} teams done
    </span>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

/**
 * One person's project work for a month: the services and calendars they own, the calendar team
 * plans they are named in, and the projects and teams they are on. No employeeId = yourself.
 */
export function EmployeeWorkView({ employeeId }: { employeeId?: string }) {
  const [month, setMonth] = useState(currentPlanMonth)
  const { data, isLoading, isError, error } = useEmployeeWork(employeeId ?? null, month)
  const ym = parseMonth(`${month}-01`)!
  const monthName = MONTH_LABELS[ym.month0]
  const today = new Date().toISOString().slice(0, 10)
  const go = (by: number) => {
    const next = shiftMonth(ym, by)
    setMonth(monthISO(next.year, next.month0).slice(0, 7))
  }

  const self = !employeeId
  const who = self ? "you" : (data?.employee.firstName ?? "they")
  const owns = self ? "you own" : `${who} owns`

  const calendarIds = new Set([
    ...(data?.ownedServices.flatMap((s) => (s.calendar ? [s.calendar.id] : [])) ?? []),
    ...(data?.ownedCalendars.map((c) => c.id) ?? []),
    ...(data?.assignments.map((a) => a.calendar.id) ?? []),
  ])
  const dueThisWeek = (data?.assignments ?? []).filter((a) => dueSoon(a, today)).length

  const serviceColumns: DataTableColumn<OwnedService>[] = [
    {
      header: "Project",
      sortValue: (s) => s.project.shortName ?? s.project.name,
      cell: (s) => <ProjectCell project={s.project} />,
    },
    {
      header: "Service",
      sortValue: (s) => serviceInfo(s.service)?.name ?? s.service,
      cell: (s) => (
        <span className="flex items-center gap-2">
          <ServiceChip code={s.service} />
          <span className="text-muted-foreground text-xs">{serviceInfo(s.service)?.name}</span>
        </span>
      ),
    },
    {
      header: "Calendar",
      cell: (s) =>
        s.calendar ? (
          <CalendarLink project={s.project} id={s.calendar.id} name={s.calendar.name} />
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">No {monthName} calendar</span>
            {s.latestCalendarId ? (
              <Link
                href={calendarHref(s.project, s.latestCalendarId)}
                className="text-xs underline-offset-4 hover:underline"
              >
                Open the latest
              </Link>
            ) : null}
          </span>
        ),
    },
    {
      header: "Team plan",
      cell: (s) => (s.calendar ? <TeamsDone progress={s.calendar.progress} /> : null),
    },
    {
      header: "Delivered",
      sortValue: (s) =>
        s.calendar?.progress.quantity
          ? s.calendar.progress.handedIn / s.calendar.progress.quantity
          : null,
      cell: (s) =>
        s.calendar ? (
          <Delivered
            handedIn={s.calendar.progress.handedIn}
            quantity={s.calendar.progress.quantity}
          />
        ) : null,
    },
    {
      header: "Next due",
      sortValue: (s) => s.calendar?.progress.nextDue ?? null,
      cell: (s) => <DueDate date={s.calendar?.progress.nextDue ?? null} open today={today} />,
    },
  ]

  const calendarColumns: DataTableColumn<OwnedCalendar>[] = [
    {
      header: "Project",
      sortValue: (c) => c.project.shortName ?? c.project.name,
      cell: (c) => <ProjectCell project={c.project} />,
    },
    {
      header: "Calendar",
      sortValue: (c) => c.name,
      cell: (c) => <CalendarLink project={c.project} id={c.id} name={c.name} />,
    },
    { header: "Team plan", cell: (c) => <TeamsDone progress={c.progress} /> },
    {
      header: "Delivered",
      cell: (c) => <Delivered handedIn={c.progress.handedIn} quantity={c.progress.quantity} />,
    },
    {
      header: "Next due",
      sortValue: (c) => c.progress.nextDue,
      cell: (c) => <DueDate date={c.progress.nextDue} open today={today} />,
    },
  ]

  const assignmentColumns: DataTableColumn<CalendarAssignment>[] = [
    {
      header: "Project",
      sortValue: (a) => a.project.shortName ?? a.project.name,
      cell: (a) => <ProjectCell project={a.project} />,
    },
    {
      header: "Calendar",
      sortValue: (a) => a.calendar.name,
      cell: (a) => <CalendarLink project={a.project} id={a.calendar.id} name={a.calendar.name} />,
    },
    {
      header: "Team",
      sortValue: (a) => a.team,
      cell: (a) => <span className="font-medium">{a.team}</span>,
    },
    {
      header: "Status",
      sortValue: (a) => a.status,
      cell: (a) => (
        <StatusBadge status={a.status} colorMap={TEAM_STATUS_CLASS} labelMap={STATUS_LABEL} />
      ),
    },
    {
      header: "Delivered",
      sortValue: (a) => (a.quantity ? a.handedIn / a.quantity : null),
      cell: (a) => <Delivered handedIn={a.handedIn} quantity={a.quantity} />,
    },
    {
      header: "Due",
      sortValue: (a) => a.dueOn,
      cell: (a) => (
        <DueDate
          date={a.dueOn}
          open={a.status !== "DONE" && a.status !== "DISCARDED"}
          today={today}
        />
      ),
    },
  ]

  const projectColumns: DataTableColumn<WorkProject>[] = [
    {
      header: "Project",
      sortValue: (p) => p.shortName ?? p.name,
      cell: (p) => (
        <span className="flex flex-col">
          <ProjectCell project={p} />
          <span className="text-muted-foreground font-mono text-[11px]">{p.code}</span>
        </span>
      ),
    },
    {
      header: "Status",
      sortValue: (p) => p.status,
      cell: (p) => (
        <StatusBadge
          status={p.status}
          colorMap={PROJECT_STATUS_COLORS}
          labelMap={PROJECT_STATUS_LABELS}
        />
      ),
    },
    {
      header: "Account Manager",
      sortValue: (p) => `${p.accountManager.firstName} ${p.accountManager.lastName}`,
      cell: (p) =>
        p.isAccountManager ? (
          <span className="font-medium">{self ? "You" : who}</span>
        ) : (
          <span className="text-xs">
            {p.accountManager.firstName} {p.accountManager.lastName}
          </span>
        ),
    },
    {
      header: self ? "Your teams" : "Teams",
      cell: (p) =>
        p.teams.length === 0 ? (
          <span className="text-muted-foreground text-xs">-</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {p.teams.map((t) => (
              <span
                key={t.name}
                className={cn(
                  "rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold",
                  t.isManager && "border-primary",
                )}
                title={t.isManager ? "Manages this team" : undefined}
              >
                {t.name}
                {t.isManager ? " · manager" : ""}
              </span>
            ))}
          </span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav
          year={ym.year}
          month={ym.month0}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
          className="w-full max-w-xs"
        />
      </div>

      {isError ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <>
          <StatStrip
            loading={isLoading}
            items={[
              { label: "Projects", value: data?.projects.length ?? 0 },
              { label: "Services owned", value: data?.ownedServices.length ?? 0 },
              { label: `${monthName} calendars`, value: calendarIds.size },
              {
                label: "Due this week",
                value: dueThisWeek,
                tone: dueThisWeek > 0 ? "warning" : "default",
              },
            ]}
          />

          <Section
            title={`Services ${owns}`}
            hint="The owner answers for the service and owns its calendar each month."
          >
            <DataTable
              tableId="work-services"
              columns={serviceColumns}
              rows={data?.ownedServices ?? []}
              rowKey={(s) => `${s.project.id}:${s.service}`}
              loading={isLoading}
              skeletonRows={3}
              columnToggle={false}
              empty={`${self ? "You don't" : `${who} doesn't`} own any services yet.`}
            />
          </Section>

          {(data?.ownedCalendars.length ?? 0) > 0 && (
            <Section title={`Other calendars ${owns}`}>
              <DataTable
                tableId="work-calendars"
                columns={calendarColumns}
                rows={data?.ownedCalendars ?? []}
                rowKey={(c) => c.id}
                columnToggle={false}
              />
            </Section>
          )}

          <Section
            title={`Calendar work in ${monthName}`}
            hint={`Team plans ${self ? "you are" : `${who} is`} named in: what ${self ? "you owe" : "they owe"}, and by when.`}
          >
            <DataTable
              tableId="work-assignments"
              columns={assignmentColumns}
              rows={data?.assignments ?? []}
              rowKey={(a) => `${a.calendar.id}:${a.team}`}
              loading={isLoading}
              skeletonRows={3}
              columnToggle={false}
              empty={`Not named in any calendar's team plan for ${monthName}.`}
            />
          </Section>

          <Section title={self ? "Your projects" : `${who}'s projects`}>
            <DataTable
              tableId="work-projects"
              columns={projectColumns}
              rows={data?.projects ?? []}
              rowKey={(p) => p.id}
              loading={isLoading}
              skeletonRows={4}
              showSerial
              columnToggle={false}
              empty="Not on any project's teams yet."
            />
          </Section>
        </>
      )}
    </div>
  )
}
