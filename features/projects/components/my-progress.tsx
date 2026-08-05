"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, CircleDot, ListTodo } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { apiFetch } from "@/lib/api-fetch"
import { cn, formatDate } from "@/lib/utils"
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS } from "@/lib/constants"
import { formatHours } from "../lib/format-hours"

// =============================================================================
// "My Progress": what I still have to do, and what I have done.
//
// Deliberately NOT a smaller copy of the manager view. A manager asks "which
// project is slipping"; an individual asks "what do I owe, and by when". So this
// is task-first and due-date-ordered, with the overdue work at the top where it
// cannot be missed.
// =============================================================================

const OPEN = ["TODO", "IN_PROGRESS", "IN_REVIEW", "ON_HOLD"]

interface MyTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  completedAt: string | null
  estimatedHours: number | null
  loggedHours: number
  project: { id: string; name: string; code: string }
  team?: { id: string; name: string } | null
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: typeof ListTodo
  label: string
  value: number | string
  sub?: string
  tone?: "default" | "good" | "bad"
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px]">
          <Icon className="text-muted-foreground h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p
            className={cn(
              "text-lg font-bold tabular-nums",
              tone === "good" && "text-emerald-600 dark:text-emerald-400",
              tone === "bad" && "text-red-600 dark:text-red-400",
            )}
          >
            {value}
            {sub && <span className="text-muted-foreground ml-1 text-xs font-normal">{sub}</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/** One task row, used by both lists. */
function TaskRow({ t, done = false }: { t: MyTask; done?: boolean }) {
  const overdue = !done && t.dueDate && new Date(t.dueDate) < new Date()
  return (
    <li className="flex items-center gap-2 px-4 py-2 text-xs">
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-medium", done && "text-muted-foreground line-through")}>
          {t.title}
        </p>
        <Link
          href={`/projects/${t.project.id}`}
          className="text-muted-foreground hover:text-foreground truncate text-[11px] hover:underline"
        >
          {t.project.name}
          {t.team ? ` · ${t.team.name}` : ""}
        </Link>
      </div>

      {!done && (
        <StatusBadge
          status={t.priority}
          colorMap={TASK_PRIORITY_COLORS}
          labelMap={TASK_PRIORITY_LABELS}
          size="xs"
        />
      )}

      {t.estimatedHours != null && t.estimatedHours > 0 && (
        <span className="text-muted-foreground hidden shrink-0 tabular-nums sm:inline">
          {formatHours(t.estimatedHours)}
        </span>
      )}

      {done ? (
        <span className="text-muted-foreground shrink-0 tabular-nums">
          {t.completedAt ? formatDate(t.completedAt) : "-"}
        </span>
      ) : overdue ? (
        <Badge
          variant="outline"
          className="shrink-0 gap-1 border-red-300 py-0 text-[10px] text-red-600"
        >
          <AlertTriangle className="h-3 w-3" />
          {formatDate(t.dueDate!)}
        </Badge>
      ) : (
        <span className="text-muted-foreground shrink-0 tabular-nums">
          {t.dueDate ? formatDate(t.dueDate) : "no date"}
        </span>
      )}
    </li>
  )
}

export function MyProgress() {
  // Shares the ["my-tasks"] cache entry with the My Tasks page, so it must cache
  // the SAME shape: the `{ data }` envelope, not the unwrapped array. My Tasks
  // reads `data.data` and patches it on drag (qc.setQueryData), so unwrapping
  // here made whichever page mounted second read the other one's shape out of
  // the cache - which is what threw "tasks.filter is not a function".
  const { data, isLoading } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: () => apiFetch<{ data: MyTask[] }>("/api/tasks?mine=true"),
    staleTime: 30_000,
  })

  const tasks = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data])

  const { todo, done, overdue, inProgress, byProject } = useMemo(() => {
    const now = new Date()
    const open = tasks.filter((t) => OPEN.includes(t.status))
    const finished = tasks.filter((t) => t.status === "DONE")

    // Overdue first, then soonest due, then undated last.
    const todo = [...open].sort((a, b) => {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })

    const done = [...finished].sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
    )

    // My own work, rolled up per project: what is left where.
    const map = new Map<string, { name: string; id: string; open: number; done: number }>()
    for (const t of tasks) {
      const e = map.get(t.project.id) ?? {
        name: t.project.name,
        id: t.project.id,
        open: 0,
        done: 0,
      }
      if (t.status === "DONE") e.done++
      else if (OPEN.includes(t.status)) e.open++
      map.set(t.project.id, e)
    }

    return {
      todo,
      done,
      overdue: open.filter((t) => t.dueDate && new Date(t.dueDate) < now).length,
      inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      byProject: [...map.values()].sort((a, b) => b.open - a.open),
    }
  }, [tasks])

  if (isLoading) return <Skeleton className="h-96 rounded" />

  const total = todo.length + done.length
  const completionRate = total > 0 ? Math.round((done.length / total) * 100) : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ListTodo} label="To do" value={todo.length} />
        <Stat icon={CircleDot} label="In progress" value={inProgress} />
        <Stat
          icon={CheckCircle2}
          label="Done"
          value={done.length}
          sub={completionRate != null ? `${completionRate}%` : undefined}
          tone="good"
        />
        <Stat
          icon={AlertTriangle}
          label="Overdue"
          value={overdue}
          tone={overdue > 0 ? "bad" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* What I have to do */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">What I have to do</CardTitle>
            <p className="text-muted-foreground text-xs">
              Everything still open, soonest due first.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {todo.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={CheckCircle2} compact title="Nothing open. All caught up." />
              </div>
            ) : (
              <ul className="divide-border/60 max-h-[28rem] divide-y overflow-y-auto">
                {todo.map((t) => (
                  <TaskRow key={t.id} t={t} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* What I have done */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">What I have done</CardTitle>
            <p className="text-muted-foreground text-xs">Completed work, most recent first.</p>
          </CardHeader>
          <CardContent className="p-0">
            {done.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={CheckCircle2} compact title="Nothing completed yet." />
              </div>
            ) : (
              <ul className="divide-border/60 max-h-[28rem] divide-y overflow-y-auto">
                {done.map((t) => (
                  <TaskRow key={t.id} t={t} done />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Where my work sits */}
      {byProject.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">My work by project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-1">
            {byProject.map((p) => {
              const t = p.open + p.done
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <Link
                    href={`/projects/${p.id}`}
                    className="w-40 shrink-0 truncate text-xs hover:underline"
                  >
                    {p.name}
                  </Link>
                  {/* gap-0.5 keeps a 2px gutter between the two fills. */}
                  <div className="bg-muted flex h-2 flex-1 gap-0.5 overflow-hidden rounded-[2px]">
                    {p.done > 0 && (
                      <div
                        className="rounded-[2px] bg-emerald-500"
                        style={{ width: `${(p.done / t) * 100}%` }}
                        title={`Done: ${p.done}`}
                      />
                    )}
                    {p.open > 0 && (
                      <div
                        className="rounded-[2px] bg-slate-400"
                        style={{ width: `${(p.open / t) * 100}%` }}
                        title={`Open: ${p.open}`}
                      />
                    )}
                  </div>
                  <span className="text-muted-foreground w-24 shrink-0 text-right text-[11px] tabular-nums">
                    {p.done} done · {p.open} left
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
