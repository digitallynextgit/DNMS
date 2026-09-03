"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock, ListChecks } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { apiFetch } from "@/lib/api-fetch"
import { cn, formatDate } from "@/lib/utils"
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
} from "@/lib/constants"
import { formatHours } from "../lib/format-hours"
import type { MemberProgress } from "../hooks/use-projects"

interface MemberTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  completedAt: string | null
  estimatedHours: number | null
  loggedHours: number
  inProgressSince: string | null
  team: { id: string; name: string } | null
}

const OPEN = ["TODO", "IN_PROGRESS", "IN_REVIEW", "ON_HOLD"]

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "good" | "warn" | "bad"
}) {
  return (
    <div className="bg-muted/40 rounded-sm p-2">
      <p className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * Drill-down for one person on one project: their numbers, then the actual
 * tasks behind them.
 *
 * The row you clicked shows aggregates; this answers the obvious next question,
 * "which tasks are those?", without leaving the page.
 */
export function MemberProgressDialog({
  projectId,
  member,
  range,
  onClose,
}: {
  projectId: string
  /** Null closes the dialog; a member opens it. */
  member: MemberProgress | null
  range?: { from?: string | null; to?: string | null }
  onClose: () => void
}) {
  const params = new URLSearchParams()
  if (range?.from) params.set("from", range.from)
  if (range?.to) params.set("to", range.to)
  const qs = params.toString()

  const { data, isLoading } = useQuery({
    queryKey: ["project-member-tasks", projectId, member?.id, qs],
    queryFn: () =>
      apiFetch<{ data: MemberTask[] }>(
        `/api/projects/${projectId}/members/${member!.id}/tasks${qs ? `?${qs}` : ""}`,
      ).then((r) => r.data),
    enabled: !!member,
    staleTime: 30_000,
  })

  const tasks = data ?? []
  const open = tasks.filter((t) => OPEN.includes(t.status))
  const done = tasks.filter((t) => t.status === "DONE")

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {member && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <AvatarDisplay
                  src={member.profilePhoto}
                  firstName={member.name.split(" ")[0] ?? ""}
                  lastName={member.name.split(" ")[1] ?? ""}
                  size="chip"
                />
                {member.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {member.teamName ? `${member.teamName} · ` : ""}
                {member.total} {member.total === 1 ? "task" : "tasks"} on this project
                {range?.from ? " in the selected dates" : ""}
              </DialogDescription>
            </DialogHeader>

            {/* Their performance, same definitions as the table row. */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <Stat
                label="Completion"
                value={
                  member.completionRate == null ? "no data" : `${member.completionRate.toFixed(0)}%`
                }
                tone={
                  member.completionRate == null
                    ? "default"
                    : member.completionRate >= 70
                      ? "good"
                      : member.completionRate >= 40
                        ? "warn"
                        : "bad"
                }
              />
              <Stat
                label="On time"
                value={member.onTimeRate == null ? "no data" : `${member.onTimeRate.toFixed(0)}%`}
                tone={
                  member.onTimeRate == null ? "default" : member.onTimeRate >= 85 ? "good" : "warn"
                }
              />
              <Stat label="Done" value={`${member.done}`} />
              <Stat
                label="Overdue"
                value={`${member.overdue}`}
                tone={member.overdue > 0 ? "bad" : "good"}
              />
              <Stat
                label="Hours"
                value={`${formatHours(member.loggedHours)} / ${formatHours(member.estimatedHours)}`}
              />
            </div>

            {isLoading ? (
              <Skeleton className="h-48 rounded-sm" />
            ) : tasks.length === 0 ? (
              <EmptyState icon={ListChecks} compact title="No tasks in this scope." />
            ) : (
              <div className="max-h-[46vh] space-y-4 overflow-y-auto pr-1">
                <TaskGroup icon={Clock} title={`Assigned and open (${open.length})`} tasks={open} />
                <TaskGroup
                  icon={CheckCircle2}
                  title={`Completed (${done.length})`}
                  tasks={done}
                  done
                />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TaskGroup({
  icon: Icon,
  title,
  tasks,
  done = false,
}: {
  icon: typeof Clock
  title: string
  tasks: MemberTask[]
  done?: boolean
}) {
  if (tasks.length === 0) return null
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <ul className="divide-border/60 divide-y">
        {tasks.map((t) => {
          const overdue = !done && t.dueDate && new Date(t.dueDate) < new Date()
          return (
            <li key={t.id} className="flex items-center gap-2 py-1.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-medium", done && "text-muted-foreground")}>
                  {t.title}
                </p>
                {t.team && <p className="text-muted-foreground text-[11px]">{t.team.name}</p>}
              </div>

              <StatusBadge
                status={t.status}
                colorMap={TASK_STATUS_COLORS}
                labelMap={TASK_STATUS_LABELS}
                size="xs"
              />
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

              {overdue ? (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 border-red-300 py-0 text-[10px] text-red-600"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {formatDate(t.dueDate!)}
                </Badge>
              ) : (
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {done
                    ? t.completedAt
                      ? formatDate(t.completedAt)
                      : "-"
                    : t.dueDate
                      ? formatDate(t.dueDate)
                      : "no date"}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
