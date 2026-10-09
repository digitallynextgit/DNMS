"use client"

import { useMemo, useState } from "react"
import { Download, ListChecks, RefreshCw, Swords, ThumbsDown, ThumbsUp } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableViewMenu } from "@/components/shared/table-view-menu"
import { cn } from "@/lib/utils"
import type { KeywordView } from "../types"
import {
  useGenerateBacklog,
  useKeywordBacklog,
  useMineCompetitorKeywords,
  useUpdateKeyword,
} from "../hooks/use-seo"
import { exportKeywords } from "../lib/seo-export"

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

  // Every filter but status, so the status menu's counts match what picking one shows.
  const narrowed = useMemo(() => {
    let list = keywords ?? []
    if (intentFilter !== "all") list = list.filter((k) => k.intent === intentFilter)
    if (winFilter === "winnable") list = list.filter((k) => k.winnable === true)
    if (winFilter === "unassessed") list = list.filter((k) => k.winnable === null)
    if (sourceFilter !== "all") list = list.filter((k) => k.source === sourceFilter)
    return list
  }, [keywords, intentFilter, winFilter, sourceFilter])
  const rows = useMemo(
    () => (statusFilter === "all" ? narrowed : narrowed.filter((k) => k.status === statusFilter)),
    [narrowed, statusFilter],
  )

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

  const statusOrder = Object.keys(STATUS_LABEL)
  const statusViews = [
    { value: "all", label: "All", count: narrowed.length },
    ...statusOrder.map((s) => ({
      value: s,
      label: STATUS_LABEL[s] ?? s,
      count: narrowed.filter((k) => k.status === s).length,
    })),
  ]

  const columns: DataTableColumn<KeywordView>[] = [
    {
      header: "Keyword",
      sortValue: (k) => k.query,
      className: "max-w-[280px] truncate font-medium",
      cell: (k) => <span title={k.query}>{k.query}</span>,
    },
    {
      header: "Source",
      sortValue: (k) =>
        k.source === "COMPETITOR" ? (k.sourceDomain ?? "competitor") : "Search Console",
      cell: (k) =>
        k.source === "COMPETITOR" ? (
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
          <span className="text-muted-foreground text-[10px]">Search Console</span>
        ),
    },
    {
      header: "Intent",
      sortValue: (k) => k.intent,
      cell: (k) => (
        <span
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
            INTENT_STYLE[k.intent] ?? INTENT_STYLE.other,
          )}
        >
          {k.intent}
        </span>
      ),
    },
    {
      header: "Impr.",
      align: "right",
      className: "tabular-nums",
      sortValue: (k) => k.impressions,
      cell: (k) => num(k.impressions),
    },
    {
      header: "Pos",
      align: "right",
      className: "tabular-nums",
      sortValue: (k) => k.position,
      cell: (k) => {
        const striking = k.position >= 5 && k.position <= 20
        return (
          <span
            className={cn(striking && "font-medium text-emerald-600")}
            title={striking ? "Striking distance (5-20) - fastest win" : undefined}
          >
            {k.position.toFixed(1)}
          </span>
        )
      },
    },
    {
      header: "Winnable?",
      align: "center",
      // Not assessed sorts last.
      sortValue: (k) => (k.winnable === null ? null : k.winnable ? 1 : 0),
      cell: (k) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            disabled={!canManage}
            onClick={() => patch(k, { winnable: k.winnable === true ? null : true })}
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
            onClick={() => patch(k, { winnable: k.winnable === false ? null : false })}
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
      ),
    },
    {
      header: "Value",
      align: "center",
      sortValue: (k) => k.businessValue,
      cell: (k) => (
        <div className="flex items-center justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              disabled={!canManage}
              onClick={() => patch(k, { businessValue: v })}
              className={cn("h-2 w-2 rounded-sm", v <= k.businessValue ? "bg-primary" : "bg-muted")}
              title={`Business value ${v}/5`}
            />
          ))}
        </div>
      ),
    },
    {
      header: "Score",
      align: "right",
      className: "font-semibold tabular-nums",
      sortValue: (k) => k.score,
      cell: (k) => k.score.toFixed(1),
    },
    {
      header: "Status",
      sortValue: (k) => statusOrder.indexOf(k.status),
      cell: (k) =>
        canManage ? (
          <Select value={k.status} onValueChange={(v) => patch(k, { status: v })}>
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
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {keywords?.length ?? 0} keyword{(keywords?.length ?? 0) === 1 ? "" : "s"} · sorted by
          priority score
        </p>
        <div className="flex items-center gap-2">
          <Button
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
          <DataTable
            tableId="seo-keyword-backlog"
            itemLabel="keyword"
            columns={columns}
            rows={rows}
            rowKey={(k) => k.id}
            pageKey={`${statusFilter}|${intentFilter}|${winFilter}|${sourceFilter}`}
            toolbar={
              <>
                <TableViewMenu
                  label="Status"
                  value={statusFilter}
                  options={statusViews}
                  onChange={setStatusFilter}
                />
                <Filter
                  value={intentFilter}
                  onChange={setIntentFilter}
                  width="w-40"
                  label="Intent"
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
                  label="Winnable"
                  options={[
                    ["all", "All"],
                    ["winnable", "Winnable only"],
                    ["unassessed", "Not assessed"],
                  ]}
                />
              </>
            }
            empty="No keywords match these filters."
          />

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
  label,
}: {
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  width: string
  label: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9", width)} aria-label={label}>
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
