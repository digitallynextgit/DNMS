"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { formatHours } from "@/features/projects/lib/format-hours"
import { addDays, fromDayKey, mondayOf, toDayKey } from "@/features/projects/lib/work-week"

interface Day {
  key: string
  off: "leave" | "holiday" | null
  hours: number
}
interface Person {
  id: string
  name: string
  days: Day[]
  logged: number
  allocated: number
  available: number
  utilisation: number | null
  focus: { client: string; hours: number; tasks: string[] }[]
}
interface WeeklyHours {
  weekStart: string
  hoursPerDay: number
  scope: "self" | "team" | "all"
  people: Person[]
  totals: { logged: number; allocated: number; available: number; utilisation: number | null }
}

/**
 * Logged hours for one week, per person and per day, against what was available.
 *
 * Every number is derived - from the task clock, approved leave and the holiday
 * calendar - so there is nothing here for anyone to keep up to date.
 *
 * Its own week stepper rather than the page's date range: this is a WEEK, and
 * the range filter above can be a quarter. Making the two share would either
 * break the table or quietly ignore the filter.
 */
export function WeeklyHoursCard() {
  const [weekStart, setWeekStart] = useState(() => toDayKey(mondayOf(new Date())))
  const thisMonday = toDayKey(mondayOf(new Date()))

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-hours", weekStart],
    queryFn: () =>
      apiFetch<{ data: WeeklyHours }>(`/api/projects/weekly-hours?week=${weekStart}`).then(
        (r) => r.data,
      ),
    staleTime: 30_000,
  })

  const columns = useMemo(() => {
    const start = fromDayKey(weekStart)
    return Array.from({ length: 5 }, (_, i) => {
      const d = addDays(start, i)
      return {
        key: toDayKey(d),
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        sub: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      }
    })
  }, [weekStart])

  const weekLabel = useMemo(() => {
    const start = fromDayKey(weekStart)
    const end = addDays(start, 4)
    const fmt = (d: Date, year: boolean) =>
      d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        ...(year ? { year: "numeric" } : {}),
      })
    return `${fmt(start, false)} – ${fmt(end, true)}`
  }, [weekStart])

  // "My hours" reads wrong over a table of five people, and "Team hours" reads
  // wrong over a table of one.
  const title = data?.scope === "self" ? "My hours this week" : "Hours by person and day"

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarRange className="text-muted-foreground h-4 w-4" />
          {title}
          <span className="text-muted-foreground font-normal">· {weekLabel}</span>
          {weekStart === thisMonday && (
            <span className="text-muted-foreground text-xs font-normal">· this week</span>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => setWeekStart(toDayKey(addDays(fromDayKey(weekStart), -7)))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={weekStart === thisMonday}
            onClick={() => setWeekStart(thisMonday)}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => setWeekStart(toDayKey(addDays(fromDayKey(weekStart), 7)))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading || !data ? (
          <Skeleton className="h-40 rounded" />
        ) : data.people.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No hours logged this week.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="w-44 border-r border-b px-3 py-2 text-left text-[11px] font-semibold tracking-wide uppercase">
                      Person
                    </th>
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        className="border-r border-b px-3 py-2 text-right text-[11px] font-semibold tracking-wide uppercase"
                      >
                        {c.label}
                        <span className="text-muted-foreground ml-1 font-normal normal-case">
                          {c.sub}
                        </span>
                      </th>
                    ))}
                    <th className="border-r border-b px-3 py-2 text-right text-[11px] font-semibold tracking-wide uppercase">
                      Logged
                    </th>
                    <th className="border-b px-3 py-2 text-right text-[11px] font-semibold tracking-wide uppercase">
                      Utilisation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p) => (
                    <tr key={p.id}>
                      <th
                        scope="row"
                        className="border-r border-b px-3 py-2 text-left text-xs font-semibold"
                      >
                        {p.name}
                      </th>
                      {p.days.map((d) => (
                        <td
                          key={d.key}
                          className="border-r border-b px-3 py-2 text-right text-xs tabular-nums"
                        >
                          {d.off ? (
                            <span className="text-muted-foreground/60 italic">
                              {d.off === "leave" ? "Leave" : "Holiday"}
                            </span>
                          ) : d.hours > 0 ? (
                            formatHours(d.hours)
                          ) : (
                            <span className="text-muted-foreground/40">–</span>
                          )}
                        </td>
                      ))}
                      <td className="border-r border-b px-3 py-2 text-right text-xs font-medium tabular-nums">
                        {p.logged > 0 ? formatHours(p.logged) : "–"}
                      </td>
                      <td className="border-b px-3 py-2 text-right text-xs tabular-nums">
                        <Utilisation value={p.utilisation} available={p.available} />
                      </td>
                    </tr>
                  ))}

                  {/* Only worth a team row when there is more than one person in
                      it - otherwise it just repeats the row above. */}
                  {data.people.length > 1 && (
                    <tr className="bg-muted/60">
                      <th className="border-r px-3 py-2 text-left text-[11px] font-semibold tracking-wide uppercase">
                        Team
                      </th>
                      {columns.map((c) => {
                        const total = data.people.reduce(
                          (s, p) => s + (p.days.find((x) => x.key === c.key)?.hours ?? 0),
                          0,
                        )
                        return (
                          <td
                            key={c.key}
                            className="border-r px-3 py-2 text-right text-xs font-semibold tabular-nums"
                          >
                            {total > 0 ? formatHours(total) : "–"}
                          </td>
                        )
                      })}
                      <td className="border-r px-3 py-2 text-right text-xs font-semibold tabular-nums">
                        {formatHours(data.totals.logged)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">
                        <Utilisation
                          value={data.totals.utilisation}
                          available={data.totals.available}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-muted-foreground text-xs">
              Utilisation is logged over available. Available is the working week at{" "}
              {data.hoursPerDay}h a day, minus approved leave and company holidays. Hours count
              against the day a task is due, the same way the allocation sheet places them.
            </p>

            {/* Where the hours went. Only when there is something to attribute -
                an empty week does not need a heading over nothing. */}
            {data.people.some((p) => p.focus.length > 0) && (
              <div className="grid gap-3 md:grid-cols-2">
                {data.people
                  .filter((p) => p.focus.length > 0)
                  .map((p) => (
                    <div key={p.id} className="rounded-[2px] border p-3">
                      <p className="text-xs font-semibold">{p.name}</p>
                      <div className="mt-2 space-y-2">
                        {p.focus.map((f) => (
                          <div key={f.client} className="border-l-2 pl-2.5">
                            <p className="flex items-baseline justify-between gap-2 text-[11px] font-medium">
                              <span>{f.client}</span>
                              <span className="text-muted-foreground tabular-nums">
                                {f.hours > 0 ? formatHours(f.hours) : "–"}
                              </span>
                            </p>
                            <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                              {f.tasks.join(", ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * A whole week of leave means "nothing was expected", which is not the same as
 * 0% - a zero there reads as a failure rather than as time off.
 */
function Utilisation({ value, available }: { value: number | null; available: number }) {
  if (value === null) return <span className="text-muted-foreground/60 italic">no capacity</span>
  return (
    <span
      className={cn(
        "font-medium",
        value > 100 && "text-amber-600 dark:text-amber-400",
        value < 60 && "text-muted-foreground",
      )}
      title={`${formatHours(available)} available`}
    >
      {value}%
    </span>
  )
}
