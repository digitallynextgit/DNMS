"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { CircleDot, Flag, Play, Plus } from "lucide-react"

interface TimelineEntry {
  id: string
  status: string
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
  actor: { id: string; firstName: string; lastName: string } | null
}

interface Timeline {
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  entries: TimelineEntry[]
  totals: Record<string, number>
  estimatedHours: number | null
  loggedHours: number
  inProgressSince: string | null
}

function useTaskTimeline(taskId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["task-timeline", taskId],
    queryFn: () =>
      apiFetch<{ data: Timeline }>(`/api/tasks/${taskId}/timeline`).then((r) => r.data),
    enabled: !!taskId && enabled,
    staleTime: 10_000,
  })
}

/** "2d 4h", "3h 12m", "45m", "12s" - the two largest units that matter. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`
  const m = Math.floor(seconds / 60) % 60
  const h = Math.floor(seconds / 3600) % 24
  const d = Math.floor(seconds / 86400)
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

/** Date + time, e.g. "3 Aug 2026, 1:14 pm". */
function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/** Re-render every 30s so an open period's elapsed time stays current. */
function useTick(active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [active])
}

/**
 * Status history for a task: created, started, and every stretch it spent in
 * each status with how long that stretch lasted.
 *
 * The open period counts up live, so a task sitting In Progress shows the time
 * it has been there rather than a stale number.
 */
export function TaskTimeline({ taskId, open }: { taskId: string | undefined; open: boolean }) {
  const { data, isLoading } = useTaskTimeline(taskId, open)
  const hasOpenPeriod = !!data?.entries.some((e) => !e.endedAt)
  useTick(open && hasOpenPeriod)

  if (isLoading) return <Skeleton className="h-32 rounded" />
  if (!data) return null

  const totalTracked = Object.values(data.totals).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-3">
      {/* The three moments people actually ask about. */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Moment icon={Plus} label="Created" value={formatMoment(data.createdAt)} />
        <Moment
          icon={Play}
          label="Started"
          value={data.startedAt ? formatMoment(data.startedAt) : "Not started"}
          muted={!data.startedAt}
        />
        <Moment
          icon={Flag}
          label="Completed"
          value={data.completedAt ? formatMoment(data.completedAt) : "Not completed"}
          muted={!data.completedAt}
        />
      </div>

      {/* Time in each status, across every stretch. */}
      {totalTracked > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(data.totals)
            .sort((a, b) => b[1] - a[1])
            .map(([status, seconds]) => (
              <span
                key={status}
                className="bg-muted/60 inline-flex items-center gap-1.5 rounded-[2px] px-2 py-1 text-[11px]"
              >
                <span className="text-muted-foreground">
                  {TASK_STATUS_LABELS[status] ?? status}
                </span>
                <span className="font-medium">{formatDuration(seconds)}</span>
              </span>
            ))}
        </div>
      )}

      {/* Every stretch, oldest first. */}
      <ol className="space-y-0">
        {data.entries.map((entry, i) => {
          const running = !entry.endedAt
          const seconds = running
            ? (Date.now() - new Date(entry.startedAt).getTime()) / 1000
            : (entry.durationSeconds ?? 0)
          const last = i === data.entries.length - 1

          return (
            <li key={entry.id} className="relative flex gap-3 pb-3 last:pb-0">
              {/* Rail */}
              <div className="flex flex-col items-center">
                <CircleDot
                  className={cn(
                    "mt-0.5 h-3 w-3 shrink-0",
                    running ? "animate-pulse text-blue-500" : "text-muted-foreground/40",
                  )}
                />
                {!last && <span className="bg-border mt-1 w-px flex-1" />}
              </div>

              <div className="min-w-0 flex-1 -translate-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    status={entry.status}
                    colorMap={TASK_STATUS_COLORS}
                    labelMap={TASK_STATUS_LABELS}
                    size="xs"
                  />
                  <span
                    className={cn(
                      "text-[11px]",
                      running ? "font-medium text-blue-600 dark:text-blue-400" : "font-medium",
                    )}
                  >
                    {formatDuration(seconds)}
                    {running && " so far"}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  {formatMoment(entry.startedAt)}
                  {entry.actor && ` · ${entry.actor.firstName} ${entry.actor.lastName}`}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Moment({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: typeof Plus
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="bg-muted/40 min-w-0 rounded-[2px] p-2">
      <p className="text-muted-foreground flex items-center gap-1 text-[10px] tracking-wide uppercase">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-[11px]",
          muted ? "text-muted-foreground" : "font-medium",
        )}
      >
        {value}
      </p>
    </div>
  )
}
