"use client"

import { ArrowRight, CalendarDays } from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatDate } from "@/lib/utils"
import { useEmployeeWork } from "../hooks/use-employee-work"
import { MONTH_LABELS, currentPlanMonth, parseMonth } from "../lib/calendar-months"
import { dueSoon, type WorkProjectRef } from "../lib/employee-work"
import { projectHref } from "../lib/project-href"

interface DueItem {
  key: string
  project: WorkProjectRef
  calendarId: string
  label: string
  dueOn: string
}

/** Dashboard summary of My Work: this month's counts and what is due next. Hidden when empty. */
export function MyWorkCard() {
  const month = currentPlanMonth()
  const { data } = useEmployeeWork(null, month)
  if (!data) return null
  const owned = data.ownedServices.length + data.ownedCalendars.length
  if (owned === 0 && data.assignments.length === 0) return null

  const today = new Date().toISOString().slice(0, 10)
  const monthName = MONTH_LABELS[parseMonth(`${month}-01`)!.month0]
  const calendars = new Set([
    ...data.ownedServices.flatMap((s) => (s.calendar ? [s.calendar.id] : [])),
    ...data.ownedCalendars.map((c) => c.id),
    ...data.assignments.map((a) => a.calendar.id),
  ]).size
  const dueThisWeek = data.assignments.filter((a) => dueSoon(a, today)).length

  // What comes due next, from the plans they are named in and the calendars they own.
  const due: DueItem[] = [
    ...data.assignments
      .filter((a) => a.dueOn && a.status !== "DONE" && a.status !== "DISCARDED")
      .map((a) => ({
        key: `a:${a.calendar.id}:${a.team}`,
        project: a.project,
        calendarId: a.calendar.id,
        label: `${a.calendar.name} · ${a.team}`,
        dueOn: a.dueOn!,
      })),
    ...data.ownedServices.flatMap((s) =>
      s.calendar?.progress.nextDue
        ? [
            {
              key: `s:${s.calendar.id}`,
              project: s.project,
              calendarId: s.calendar.id,
              label: s.calendar.name,
              dueOn: s.calendar.progress.nextDue,
            },
          ]
        : [],
    ),
  ]
    .sort((x, y) => x.dueOn.localeCompare(y.dueOn))
    .slice(0, 4)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          My Work · {monthName}
        </CardTitle>
        <Button className="gap-1" asChild variant="ghost">
          <Link href="/projects/my-work?tab=services">
            Open My Work <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{data.ownedServices.length}</span>{" "}
          <span className="text-muted-foreground">services owned ·</span>{" "}
          <span className="font-semibold tabular-nums">{calendars}</span>{" "}
          <span className="text-muted-foreground">calendars this month ·</span>{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              dueThisWeek > 0 && "text-amber-600 dark:text-amber-400",
            )}
          >
            {dueThisWeek}
          </span>{" "}
          <span className="text-muted-foreground">due this week</span>
        </p>
        {due.length > 0 ? (
          <ul className="divide-y rounded-sm border">
            {due.map((d) => (
              <li key={d.key}>
                <Link
                  href={`${projectHref(d.project)}?tab=calendar&calendar=${d.calendarId}`}
                  className="hover:bg-muted/30 flex items-center gap-3 px-3 py-2 text-sm transition-colors"
                >
                  <CalendarDays className="text-muted-foreground h-4 w-4 shrink-0" />
                  {d.project.shortName ? (
                    <span className="bg-primary text-primary-foreground shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-bold">
                      {d.project.shortName}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{d.label}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      d.dueOn < today && "text-destructive font-medium",
                    )}
                  >
                    {d.dueOn < today ? "late · " : "due "}
                    {formatDate(d.dueOn)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">Nothing has a due date yet this month.</p>
        )}
      </CardContent>
    </Card>
  )
}
