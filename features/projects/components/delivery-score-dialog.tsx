"use client"

import { Link } from "@/components/tenant-link"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, ListChecks, Package, Target } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn, formatDate } from "@/lib/utils"
import { TASK_STATUS_LABELS } from "@/lib/constants"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMonth } from "../lib/calendar-months"
import { DELIVERABLE_STATUS_LABELS, type DeliverableStatus } from "../lib/deliverable-lifecycle"
import { projectHref } from "../lib/project-href"
import type { DeliveryScore } from "../lib/delivery-score"
import type { DeliveryScoreItems, ItemResult } from "../server/delivery-score.queries"
import { fmtNumber } from "./goal-number"

export type ScoreSubject = { kind: "person" | "team"; id: string; name: string }

const RESULT: Record<ItemResult, { label: string; cls: string }> = {
  on_time: { label: "on time", cls: "text-emerald-600 dark:text-emerald-400" },
  late: { label: "late", cls: "text-destructive" },
  not_due: { label: "not due yet", cls: "text-muted-foreground" },
  left_out: { label: "not counted", cls: "text-muted-foreground/70" },
}

const scoreTone = (s: number | null) =>
  s === null
    ? "text-muted-foreground"
    : s >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : s >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive"

function Section({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: React.ElementType
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-baseline gap-2">
        <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0 self-center" />
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-muted-foreground text-[11px]">{sub}</span>
      </p>
      {children}
    </div>
  )
}

/** One row that opens where the item lives. */
function ItemLink({
  href,
  title,
  meta,
  right,
}: {
  href: string
  title: string
  meta: string
  right: React.ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="hover:bg-muted/40 group flex items-center gap-3 px-3 py-2 text-xs transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-medium group-hover:underline">
            <span className="truncate">{title}</span>
            <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
          </span>
          <span className="text-muted-foreground block truncate text-[11px]">{meta}</span>
        </span>
        <span className="shrink-0 text-right text-[11px]">{right}</span>
      </Link>
    </li>
  )
}

function counted(s: DeliveryScore["deliverables"], items: { result: ItemResult }[]) {
  const waiting = items.filter((i) => i.result === "not_due").length
  return [
    s.due > 0 ? `${s.onTime} of ${s.due} on time` : "none due yet",
    waiting > 0 && `${waiting} not due yet`,
  ]
    .filter(Boolean)
    .join(" · ")
}

/** What one person's or team's score is made of, item by item, each a link to where it lives. */
export function DeliveryScoreDialog({
  subject,
  month,
  projectId,
  onClose,
}: {
  subject: ScoreSubject | null
  month: string
  projectId: string | null
  onClose: () => void
}) {
  const qs = new URLSearchParams({ month })
  if (projectId) qs.set("projectId", projectId)
  if (subject) qs.set(subject.kind === "person" ? "personId" : "teamId", subject.id)
  const { data, isLoading } = useQuery({
    queryKey: ["delivery-score-items", qs.toString()],
    queryFn: () =>
      apiFetch<{ data: DeliveryScoreItems }>(`/api/projects/delivery-scores/items?${qs}`).then(
        (r) => r.data,
      ),
    enabled: subject !== null,
  })

  return (
    <Dialog open={subject !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-baseline justify-between gap-3 pr-6">
            <span>{data?.title ?? subject?.name}</span>
            {data && (
              <span
                className={cn("text-2xl font-semibold tabular-nums", scoreTone(data.score.score))}
              >
                {data.score.score ?? "-"}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {formatMonth(`${month}-01`)} · every goal, deliverable and task behind the score. Click
            one to open it.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <Skeleton className="h-64 rounded-sm" />
        ) : (
          <div className="space-y-5">
            {subject?.kind === "person" && (
              <Section
                icon={Target}
                title="Goals they own"
                sub={
                  data.goals.length > 0
                    ? `${data.score.goals.score}% reached on average (40% of the score)`
                    : "none this month"
                }
              >
                {data.goals.length > 0 && (
                  <ul className="divide-y rounded-sm border">
                    {data.goals.map((g) => (
                      <ItemLink
                        key={g.id}
                        href={projectHref(g.project, "goals", { month })}
                        title={g.parentTitle ? `${g.parentTitle} › ${g.title}` : g.title}
                        meta={`${g.project.name} · ${fmtNumber(g.actual)} of ${fmtNumber(g.target)} ${g.metricLabel ?? ""}${
                          g.expected !== null ? ` · ${fmtNumber(g.expected)} expected by now` : ""
                        }`}
                        right={
                          <span
                            className={cn("font-semibold tabular-nums", scoreTone(g.achievement))}
                          >
                            {g.achievement}%
                          </span>
                        }
                      />
                    ))}
                  </ul>
                )}
              </Section>
            )}

            <Section
              icon={Package}
              title="Deliverables"
              sub={`${counted(data.score.deliverables, data.deliverables)} (35%)`}
            >
              {data.deliverables.length > 0 && (
                <ul className="divide-y rounded-sm border">
                  {data.deliverables.map((d) => (
                    <ItemLink
                      key={d.id}
                      href={projectHref(d.project, "deliverables", { deliverable: d.id })}
                      title={`${d.quantity > 1 ? `${d.quantity} × ` : ""}${d.title}`}
                      meta={[
                        d.project.name,
                        d.teamName,
                        subject?.kind === "team" ? (d.personName ?? "unclaimed") : null,
                        d.type,
                        DELIVERABLE_STATUS_LABELS[d.status as DeliverableStatus] ?? d.status,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      right={
                        <>
                          <span className={RESULT[d.result].cls}>{RESULT[d.result].label}</span>
                          <span className="text-muted-foreground block">
                            due {d.dueOn ? formatDate(d.dueOn, "d MMM") : "-"}
                          </span>
                        </>
                      }
                    />
                  ))}
                </ul>
              )}
            </Section>

            <Section
              icon={ListChecks}
              title="Tasks"
              sub={`${counted(data.score.tasks, data.tasks)} (25%)`}
            >
              {data.tasks.length > 0 && (
                <ul className="divide-y rounded-sm border">
                  {data.tasks.map((t) => (
                    <ItemLink
                      key={t.id}
                      href={projectHref(t.project, "tasks", { task: t.id })}
                      title={t.title}
                      meta={[
                        t.project.name,
                        t.teamName,
                        subject?.kind === "team" ? (t.personName ?? "unassigned") : null,
                        TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? t.status,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      right={
                        <>
                          <span className={RESULT[t.result].cls}>{RESULT[t.result].label}</span>
                          <span className="text-muted-foreground block">
                            due {t.dueDate ? formatDate(t.dueDate, "d MMM") : "-"}
                          </span>
                        </>
                      }
                    />
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
