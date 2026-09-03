"use client"

import { useMemo, useState } from "react"
import { Download, ListChecks, RefreshCw, Swords, ThumbsDown, ThumbsUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { TableSkeleton } from "@/components/shared/loading-skeleton"
import { cn } from "@/lib/utils"
import type { KeywordView } from "../types"
import {
  useGenerateBacklog,
  useKeywordBacklog,
  useMineCompetitorKeywords,
  useUpdateKeyword,
} from "../hooks/use-seo"
import { exportKeywords } from "../lib/seo-export"

// =============================================================================
// The keyword backlog (plan step 4): a prioritized, human-refined work-queue of
// queries worth targeting. Score = demand x winnability x business value, so the
// top of the list is genuinely "what to write next".
// =============================================================================

const INTENT_STYLE: Record<string, string> = {
  commercial: "bg-emerald-500/15 text-emerald-600",
  informational: "bg-sky-500/15 text-sky-600",
  branded: "bg-violet-500/15 text-violet-600",
  navigational: "bg-amber-500/15 text-amber-600",
  other: "bg-muted text-muted-foreground",
}
const STATUS_LABEL: Record<string, string> = {
  BACKLOG: "Backlog",
  IN_PROGRESS: "In progress",
  PUBLISHED: "Published",
  PARKED: "Parked",
}

const num = (v: number) => v.toLocaleString("en-IN")

export function KeywordBacklog({
  projectId,
  propertyId,
  siteLabel = "site",
  canManage,
}: {
  projectId: string
  propertyId: string | null
  siteLabel?: string
  canManage: boolean
}) {
  const { data: keywords, isLoading } = useKeywordBacklog(projectId, propertyId)
  const generate = useGenerateBacklog(projectId)
  const mine = useMineCompetitorKeywords(projectId)
  const update = useUpdateKeyword(projectId)

  const [intentFilter, setIntentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("BACKLOG")
  const [winFilter, setWinFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")

  const rows = useMemo(() => {
    let list = keywords ?? []
    if (intentFilter !== "all") list = list.filter((k) => k.intent === intentFilter)
    if (statusFilter !== "all") list = list.filter((k) => k.status === statusFilter)
    if (winFilter === "winnable") list = list.filter((k) => k.winnable === true)
    if (winFilter === "unassessed") list = list.filter((k) => k.winnable === null)
    if (sourceFilter !== "all") list = list.filter((k) => k.source === sourceFilter)
    return list
  }, [keywords, intentFilter, statusFilter, winFilter, sourceFilter])

  if (isLoading)
    return (
      <div className="border-border bg-card overflow-hidden rounded-sm border">
        <TableSkeleton rows={8} cols={8} />
      </div>
    )

  const patch = (
    k: KeywordView,
    p: Parameters<typeof update.mutate>[0] extends infer T ? Partial<T> : never,
  ) => propertyId && update.mutate({ propertyId, keywordId: k.id, ...(p as object) })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {keywords?.length ?? 0} keyword{(keywords?.length ?? 0) === 1 ? "" : "s"} · sorted by
          priority score
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportKeywords(keywords ?? [], siteLabel)}
            disabled={(keywords?.length ?? 0) === 0}
            title={(keywords?.length ?? 0) === 0 ? "Nothing to export yet" : "Download as CSV"}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => propertyId && mine.mutate(propertyId)}
              disabled={mine.isPending || !propertyId}
              title="Read the phrases your competitors target, from the last competitor crawl"
            >
              <Swords className={cn("mr-1.5 h-3.5 w-3.5", mine.isPending && "animate-pulse")} />
              {mine.isPending ? "Mining" : "From competitors"}
            </Button>
          )}
          {canManage && (
            <Button
              size="sm"
              onClick={() => propertyId && generate.mutate(propertyId)}
              disabled={generate.isPending || !propertyId}
            >
              <RefreshCw
                className={cn("mr-1.5 h-3.5 w-3.5", generate.isPending && "animate-spin")}
              />
              {generate.isPending ? "Building…" : "Generate from Search Console"}
            </Button>
          )}
        </div>
      </div>

      {(keywords?.length ?? 0) === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No keyword backlog yet"
          description={
            canManage
              ? "Generate the backlog from this site's Search Console queries. Each is auto-scored by demand and ranking opportunity; you then mark which are winnable."
              : "A project manager needs to generate the backlog first."
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Filter
              value={statusFilter}
              onChange={setStatusFilter}
              width="w-36"
              options={[
                ["all", "All statuses"],
                ["BACKLOG", "Backlog"],
                ["IN_PROGRESS", "In progress"],
                ["PUBLISHED", "Published"],
                ["PARKED", "Parked"],
              ]}
            />
            <Filter
              value={intentFilter}
              onChange={setIntentFilter}
              width="w-40"
              options={[
                ["all", "All intent"],
                ["commercial", "Commercial"],
                ["informational", "Informational"],
                ["branded", "Branded"],
                ["navigational", "Navigational"],
                ["other", "Other"],
              ]}
            />
            <Filter
              value={winFilter}
              onChange={setWinFilter}
              width="w-40"
              options={[
                ["all", "All"],
                ["winnable", "Winnable only"],
                ["unassessed", "Not assessed"],
              ]}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-border border-b text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Keyword</th>
                      <th className="px-3 py-2 text-left font-medium">Source</th>
                      <th className="px-3 py-2 text-left font-medium">Intent</th>
                      <th className="px-3 py-2 text-right font-medium">Impr.</th>
                      <th className="px-3 py-2 text-right font-medium">Pos</th>
                      <th className="px-3 py-2 text-center font-medium">Winnable?</th>
                      <th className="px-3 py-2 text-center font-medium">Value</th>
                      <th className="px-3 py-2 text-right font-medium">Score</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((k) => {
                      const striking = k.position >= 5 && k.position <= 20
                      return (
                        <tr key={k.id} className="border-border/60 border-b last:border-0">
                          <td
                            className="max-w-[280px] truncate px-3 py-2 font-medium"
                            title={k.query}
                          >
                            {k.query}
                          </td>
                          <td className="px-3 py-2">
                            {k.source === "COMPETITOR" ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-sm bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-600"
                                title={
                                  k.sourceDomain
                                    ? `Mined from ${k.sourceDomain}. We cannot see their ranking, so verify it.`
                                    : "Mined from a competitor's pages"
                                }
                              >
                                <Swords className="h-3 w-3" />
                                {k.sourceDomain ?? "competitor"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">
                                Search Console
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
                                INTENT_STYLE[k.intent] ?? INTENT_STYLE.other,
                              )}
                            >
                              {k.intent}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {num(k.impressions)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span
                              className={cn(striking && "font-medium text-emerald-600")}
                              title={
                                striking ? "Striking distance (5-20) - fastest win" : undefined
                              }
                            >
                              {k.position.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                disabled={!canManage}
                                onClick={() =>
                                  patch(k, { winnable: k.winnable === true ? null : true })
                                }
                                className={cn(
                                  "rounded-sm p-1",
                                  k.winnable === true
                                    ? "bg-emerald-500/20 text-emerald-600"
                                    : "text-muted-foreground hover:bg-muted",
                                )}
                                title="Winnable"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!canManage}
                                onClick={() =>
                                  patch(k, { winnable: k.winnable === false ? null : false })
                                }
                                className={cn(
                                  "rounded-sm p-1",
                                  k.winnable === false
                                    ? "bg-red-500/20 text-red-600"
                                    : "text-muted-foreground hover:bg-muted",
                                )}
                                title="Not winnable"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  disabled={!canManage}
                                  onClick={() => patch(k, { businessValue: v })}
                                  className={cn(
                                    "h-2 w-2 rounded-sm",
                                    v <= k.businessValue ? "bg-primary" : "bg-muted",
                                  )}
                                  title={`Business value ${v}/5`}
                                />
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {k.score.toFixed(1)}
                          </td>
                          <td className="px-3 py-2">
                            {canManage ? (
                              <Select
                                value={k.status}
                                onValueChange={(v) => patch(k, { status: v })}
                              >
                                <SelectTrigger className="h-7 w-32 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                                    <SelectItem key={v} value={v}>
                                      {l}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                {STATUS_LABEL[k.status] ?? k.status}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && (
                <p className="text-muted-foreground p-6 text-center text-sm">
                  No keywords match these filters.
                </p>
              )}
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-[11px]">
            Score = demand (impressions) × position opportunity × winnability × business value.
            Striking-distance queries (position 5 to 20, in green) are the fastest wins. Mark{" "}
            <ThumbsUp className="inline h-3 w-3" /> winnable and set the value dots to re-rank.{" "}
            <strong>From competitors</strong> reads the titles and headings of the sites you listed
            as competitors. Those are the phrases they target, not their rankings: Google does not
            give competitor positions away for free, so verify each one in an incognito search.
          </p>
        </>
      )}
    </div>
  )
}

function Filter({
  value,
  onChange,
  options,
  width,
}: {
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  width: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8", width)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
