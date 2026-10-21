"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Info } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import {
  currentPlanMonth,
  formatMonth,
  monthISO,
  parseMonth,
  shiftMonth,
} from "../lib/calendar-months"
import { SCORE_WEIGHTS, type DeliveryScore } from "../lib/delivery-score"
import type { DeliveryScores } from "../server/delivery-score.queries"

const ALL = "all"

/** The report scope's project list - same key as the Progress page, so it is shared. */
function useScopeProjects() {
  return useQuery({
    queryKey: ["deliverables-report-scope"],
    queryFn: () =>
      apiFetch<{ data: { projects: { id: string; name: string }[] } }>(
        "/api/projects/deliverables/report/scope",
      ).then((r) => r.data),
    staleTime: 60_000,
  })
}

function useDeliveryScores(month: string, projectId: string) {
  const qs = new URLSearchParams({ month })
  if (projectId !== ALL) qs.set("projectId", projectId)
  return useQuery({
    queryKey: ["delivery-scores", month, projectId],
    queryFn: () =>
      apiFetch<{ data: DeliveryScores }>(`/api/projects/delivery-scores?${qs}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

const tone = (score: number | null) =>
  score === null
    ? "text-muted-foreground"
    : score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive"

/** "Goals 75% (2) · Deliverables 3/4 on time · Tasks 1/2 on time" - the score is never shown alone. */
function Breakdown({ s }: { s: DeliveryScore }) {
  const bits = [
    s.goals.count > 0 && `Goals ${s.goals.score}% (${s.goals.count})`,
    s.deliverables.due > 0 && `Deliverables ${s.deliverables.onTime}/${s.deliverables.due} on time`,
    s.tasks.due > 0 && `Tasks ${s.tasks.onTime}/${s.tasks.due} on time`,
  ].filter(Boolean)
  return <span className="text-muted-foreground text-[11px]">{bits.join(" · ")}</span>
}

function ScoreTable({
  title,
  rows,
}: {
  title: string
  rows: { id: string; name: string; sub: string | null; score: DeliveryScore }[]
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-xs">
            Nothing was due this month.
          </p>
        ) : (
          <ol className="divide-y">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.name}
                    {r.sub && <span className="text-muted-foreground font-normal"> · {r.sub}</span>}
                  </p>
                  <Breakdown s={r.score} />
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "text-lg leading-none font-semibold tabular-nums",
                      tone(r.score.score),
                    )}
                  >
                    {r.score.score ?? "-"}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    based on {r.score.basedOn} item{r.score.basedOn === 1 ? "" : "s"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

/** People and teams ranked by one delivery score for a month, each with what it is made of. */
export function DeliveryScoresView() {
  const [month, setMonth] = React.useState(currentPlanMonth())
  const [projectId, setProjectId] = React.useState(ALL)
  const projects = useScopeProjects()
  const { data, isLoading } = useDeliveryScores(month, projectId)

  const ym = parseMonth(`${month}-01`)!
  const step = (by: number) => {
    const m = shiftMonth(ym, by)
    setMonth(monthISO(m.year, m.month0).slice(0, 7))
  }
  const isCurrent = month >= currentPlanMonth()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-32 text-center text-sm font-medium">{formatMonth(`${month}-01`)}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => step(1)}
            disabled={isCurrent}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {(projects.data?.projects.length ?? 0) > 1 && (
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-9 w-56 text-sm" aria-label="Project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              {projects.data!.projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-muted-foreground ml-auto flex items-center gap-1.5 text-[11px]">
          <Info className="h-3.5 w-3.5" />
          Goals they own {SCORE_WEIGHTS.goals * 100}% · deliverables made by their due day{" "}
          {SCORE_WEIGHTS.deliverables * 100}% · tasks done by their due day{" "}
          {SCORE_WEIGHTS.tasks * 100}%. A part with nothing in it is left out.
        </p>
      </div>

      {isLoading && !data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-sm" />
          <Skeleton className="h-72 rounded-sm" />
        </div>
      ) : !data || (data.people.length === 0 && data.teams.length === 0) ? (
        <EmptyState
          title="Nothing to score yet"
          description="Scores appear once goals, deliverables or tasks fall due in the month."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ScoreTable
            title={data.role === "member" ? "You" : "People"}
            rows={data.people.map((p) => ({
              id: p.id,
              name: p.name,
              sub: p.designation,
              score: p.score,
            }))}
          />
          {data.role !== "member" && (
            <ScoreTable
              title="Teams"
              rows={data.teams.map((t) => ({
                id: t.id,
                name: t.name,
                sub: projectId === ALL ? t.projectName : null,
                score: t.score,
              }))}
            />
          )}
        </div>
      )}
    </div>
  )
}
