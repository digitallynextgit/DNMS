"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { ArrowRight, CircleDot, CornerDownRight, Flag, Pencil, Play, Plus } from "lucide-react"
import { formatHours } from "../lib/format-hours"

interface TimelineEntry {
  id: string
  status: string
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
  actor: { id: string; firstName: string; lastName: string } | null
  /** Why it was moved here - the hold or discard reason. */
  note: string | null
  legIndex: number
}

interface TimelineLeg {
  id: string
  index: number
  title: string
  createdAt: string
  dueDate: string | null
  estimatedHours: number | null
  isCurrent: boolean
}

interface EditEntry {
  id: string
  at: string
  actor: { id: string; firstName: string; lastName: string } | null
  changes: { label: string; from: string; to: string }[]
  legIndex: number
}

interface Timeline {
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  entries: TimelineEntry[]
  totals: Record<string, number>
  edits: EditEntry[]
  estimatedHours: number | null
  loggedHours: number
  inProgressSince: string | null
  holdExpectedDate: string | null
  legs: TimelineLeg[]
  chainLoggedHours: number
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

/** Day only, e.g. "13 Aug 2026" - a resume date carries no meaningful time. */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function actorName(a: { firstName: string; lastName: string } | null): string | null {
  return a ? `${a.firstName} ${a.lastName}`.trim() : null
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

/** One rail, two kinds of thing that happened to the task. */
type Moment =
  | { kind: "phase"; at: string; phase: TimelineEntry }
  | { kind: "edit"; at: string; edit: EditEntry }

const legOf = (m: Moment): number => (m.kind === "phase" ? m.phase.legIndex : m.edit.legIndex)

/**
 * The task's activity log: every phase it passed through and every edit anyone
 * made, on ONE chronology.
 *
 * Phases and edits used to be separate ideas - the timeline knew the first, the
 * audit log the second, and neither could answer "what happened to this task".
 * Interleaved by time they read as the story they are, so a title rewritten
 * mid-flight sits exactly where it happened rather than in another list.
 */
export function TaskTimeline({ taskId, open }: { taskId: string | undefined; open: boolean }) {
  const { data, isLoading } = useTaskTimeline(taskId, open)
  const hasOpenPeriod = !!data?.entries.some((e) => !e.endedAt)
  useTick(open && hasOpenPeriod)

  const moments = useMemo<Moment[]>(() => {
    if (!data) return []
    const phases: Moment[] = data.entries.map((p) => ({
      kind: "phase",
      at: p.startedAt,
      phase: p,
    }))
    const edits: Moment[] = (data.edits ?? []).map((e) => ({ kind: "edit", at: e.at, edit: e }))
    // Ties broken by leg, so the moment a new leg starts never sorts above the
    // hold that caused it - the divider would then appear before its own cause.
    return [...phases, ...edits].sort((a, b) => a.at.localeCompare(b.at) || legOf(a) - legOf(b))
  }, [data])

  if (isLoading) return <Skeleton className="h-32 rounded-sm" />
  if (!data) return null

  // Only worth a summary when a status was entered more than once - otherwise it
  // just repeats the single number already sitting on that row.
  const repeated = Object.entries(data.totals).filter(
    ([status]) => data.entries.filter((e) => e.status === status).length > 1,
  )

  return (
    <div className="space-y-4">
      {/* The three moments people actually ask about. */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <MomentCard icon={Plus} label="Created" value={formatMoment(data.createdAt)} />
        <MomentCard
          icon={Play}
          label="Started"
          value={data.startedAt ? formatMoment(data.startedAt) : "Not started"}
          muted={!data.startedAt}
        />
        <MomentCard
          icon={Flag}
          label="Completed"
          value={data.completedAt ? formatMoment(data.completedAt) : "Not completed"}
          muted={!data.completedAt}
        />
      </div>

      {/* Only when the work actually spans more than one task - otherwise it is
          a banner saying "this happened once", which is noise. */}
      {data.legs.length > 1 && (
        <div className="bg-muted/40 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border-l-2 border-l-amber-500 px-2 py-1.5 text-[11px]">
          <span className="font-medium">Carried across {data.legs.length} days</span>
          <span className="text-muted-foreground">
            started {formatDay(data.createdAt)} · {formatHours(data.chainLoggedHours)} spent in
            total
          </span>
        </div>
      )}

      {repeated.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {repeated
            .sort((a, b) => b[1] - a[1])
            .map(([status, seconds]) => (
              <span
                key={status}
                className="bg-muted/60 inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px]"
              >
                <span className="text-muted-foreground">
                  {TASK_STATUS_LABELS[status] ?? status} total
                </span>
                <span className="font-medium">{formatDuration(seconds)}</span>
              </span>
            ))}
        </div>
      )}

      <ol className="space-y-0">
        {moments.map((m, i) => {
          const last = i === moments.length - 1
          const running = m.kind === "phase" && !m.phase.endedAt
          const who = actorName(m.kind === "phase" ? m.phase.actor : m.edit.actor)

          // The work was carried onto a new task here. Announcing it inline is
          // the whole point: without it the log jumps to a task created days
          // later with no explanation of where it came from.
          const leg = legOf(m)
          const startsNewLeg = leg > 1 && (i === 0 || legOf(moments[i - 1]!) !== leg)
          const legInfo = startsNewLeg ? data.legs.find((l) => l.index === leg) : undefined

          return (
            <Fragment key={`${m.kind}-${m.kind === "phase" ? m.phase.id : m.edit.id}`}>
              {legInfo && (
                <li className="flex gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <CornerDownRight className="text-muted-foreground/60 mt-0.5 h-3 w-3 shrink-0" />
                    <span className="bg-border mt-1 w-px flex-1" />
                  </div>
                  <div className="-translate-y-0.5">
                    <p className="text-[11px] font-medium">
                      Carried over to a new task
                      {legInfo.dueDate && ` for ${formatDay(legInfo.dueDate)}`}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {legInfo.estimatedHours != null
                        ? `${formatHours(legInfo.estimatedHours)} of unfinished work moved across`
                        : "No hours left on the estimate"}
                      {legInfo.isCurrent && " · the task you are looking at"}
                    </p>
                  </div>
                </li>
              )}
              <li className="flex gap-3 pb-4 last:pb-0">
                {/* Rail: a dot for a phase, a pencil for an edit, so the two are
                  distinguishable before reading a word of either. */}
                <div className="flex flex-col items-center">
                  {m.kind === "phase" ? (
                    <CircleDot
                      className={cn(
                        "mt-0.5 h-3 w-3 shrink-0",
                        running ? "animate-pulse text-blue-500" : "text-muted-foreground/40",
                      )}
                    />
                  ) : (
                    <Pencil className="text-muted-foreground/40 mt-0.5 h-3 w-3 shrink-0" />
                  )}
                  {!last && <span className="bg-border mt-1 w-px flex-1" />}
                </div>

                <div className="min-w-0 flex-1 -translate-y-0.5">
                  {m.kind === "phase" ? (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={m.phase.status}
                          colorMap={TASK_STATUS_COLORS}
                          labelMap={TASK_STATUS_LABELS}
                          size="xs"
                        />
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            running && "text-blue-600 dark:text-blue-400",
                          )}
                        >
                          {formatDuration(
                            running
                              ? (Date.now() - new Date(m.phase.startedAt).getTime()) / 1000
                              : (m.phase.durationSeconds ?? 0),
                          )}
                          {running && " so far"}
                        </span>
                        {/* Only shown on the OPEN hold: a resume date on a stretch
                          the task has already left is a date that has been
                          superseded, not history. */}
                        {running && m.phase.status === "ON_HOLD" && data.holdExpectedDate && (
                          <span className="text-muted-foreground text-[11px]">
                            · expected back {formatDay(data.holdExpectedDate)}
                          </span>
                        )}
                      </div>
                      {/* "On hold" and "Discarded" are only half an answer without
                        the why - which is the question the log gets asked. */}
                      {m.phase.note && (
                        <p className="bg-muted/40 text-muted-foreground rounded-sm px-2 py-1 text-[11px] break-words whitespace-pre-wrap">
                          {m.phase.note}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium">
                        Edited{m.edit.changes.length > 1 && ` · ${m.edit.changes.length} fields`}
                      </span>
                      {m.edit.changes.map((c) => (
                        <div
                          key={c.label}
                          className="bg-muted/40 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-sm px-2 py-1 text-[11px]"
                        >
                          <span className="text-muted-foreground">{c.label}</span>
                          {/* Old struck through, new plain: which is which has to
                            be readable at a glance, not inferred from order. */}
                          <span className="text-muted-foreground/70 line-through">{c.from}</span>
                          <ArrowRight className="text-muted-foreground/50 h-3 w-3 shrink-0" />
                          <span className="font-medium">{c.to}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-muted-foreground mt-1 text-[11px]">
                    {formatMoment(m.at)}
                    {who && ` · ${who}`}
                  </p>
                </div>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}

function MomentCard({
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
    <div className="bg-muted/40 min-w-0 rounded-sm p-2">
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
