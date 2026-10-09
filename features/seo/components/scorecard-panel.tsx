"use client"

import { AlertTriangle, Download, Gauge, Info, RefreshCw, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatCardsSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { cn } from "@/lib/utils"
import type { ScorecardMetricView, ScorecardView, VitalsView } from "../types"
import { useRebuildScorecard, useRunVitals, useScorecard, useVitals } from "../hooks/use-seo"
import { exportScorecard } from "../lib/seo-export"

// Scorecard plus the Core Web Vitals that feed it. `coverage` is shown as prominently as the score.

const BANDS = {
  HEALTHY: { label: "Healthy", cls: "text-emerald-600", ring: "stroke-emerald-500" },
  WATCH: { label: "Watch", cls: "text-amber-600", ring: "stroke-amber-500" },
  INTERVENE: { label: "Intervene", cls: "text-orange-600", ring: "stroke-orange-500" },
  ESCALATE: { label: "Escalate", cls: "text-red-600", ring: "stroke-red-500" },
} as const

const VERDICTS: Record<string, { label: string; cls: string }> = {
  GOOD: { label: "Good", cls: "bg-emerald-500/15 text-emerald-600" },
  NEEDS_IMPROVEMENT: { label: "Needs work", cls: "bg-amber-500/15 text-amber-600" },
  POOR: { label: "Poor", cls: "bg-red-500/15 text-red-600" },
}

function ScoreRing({ score, band }: { score: number; band: ScorecardView["band"] }) {
  const r = 44
  const c = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} className="stroke-muted fill-none" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className={cn("fill-none", BANDS[band].ring)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold">{score.toFixed(0)}</span>
        <span className="text-muted-foreground text-[10px] tracking-wide uppercase">/ 100</span>
      </div>
    </div>
  )
}

export function ScorecardPanel({
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
  const { data: card, isLoading } = useScorecard(projectId, propertyId)
  const { data: vitals } = useVitals(projectId, propertyId)
  const rebuild = useRebuildScorecard(projectId)
  const runVitals = useRunVitals(projectId)

  if (isLoading)
    return (
      <div className="space-y-4">
        <StatCardsSkeleton count={4} />
        <div className="border-border bg-card overflow-hidden rounded-sm border">
          <TableSkeleton rows={6} cols={4} />
        </div>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => card && exportScorecard(card, siteLabel)}
          disabled={!card}
          title={card ? "Download as CSV" : "Generate the scorecard first"}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
        {canManage && (
          <>
            <Button
              variant="outline"
              onClick={() => propertyId && runVitals.mutate(propertyId)}
              disabled={runVitals.isPending || !propertyId}
            >
              <Zap className={cn("mr-1.5 h-3.5 w-3.5", runVitals.isPending && "animate-pulse")} />
              {runVitals.isPending ? "Measuring…" : "Measure vitals + traffic"}
            </Button>
            <Button
              onClick={() => propertyId && rebuild.mutate(propertyId)}
              disabled={rebuild.isPending || !propertyId}
            >
              <RefreshCw
                className={cn("mr-1.5 h-3.5 w-3.5", rebuild.isPending && "animate-spin")}
              />
              Recalculate
            </Button>
          </>
        )}
      </div>

      {!card ? (
        <Card>
          <CardContent className="p-4 text-sm">
            <p className="font-medium">No scorecard yet</p>
            <p className="text-muted-foreground text-xs">
              {canManage
                ? "Hit Recalculate to build one from the data already stored. It runs automatically each week."
                : "It is generated automatically each week."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-5 p-5">
              <ScoreRing score={card.score} band={card.band} />
              <div className="min-w-[220px] flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Gauge className={cn("h-4 w-4", BANDS[card.band].cls)} />
                  <span className={cn("text-lg font-semibold", BANDS[card.band].cls)}>
                    {BANDS[card.band].label}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {card.periodStart} → {card.periodEnd} (28 days)
                </p>
                <p className="text-muted-foreground text-xs">
                  Scored on <strong>{card.coverage.toFixed(0)} of 100</strong> points of measurable
                  weight.
                  {card.coverage < 80 && " Connect the missing sources for a fuller picture."}
                </p>
                <div className="pt-1">
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-sm">
                    <div
                      className="h-full rounded-sm bg-sky-500"
                      style={{ width: `${Math.min(100, card.coverage)}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground pt-1 text-[11px]">Data coverage</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* A fixed set of metrics, so one page shows them all. */}
          <DataTable
            columns={METRIC_COLUMNS}
            rows={card.metrics}
            rowKey={(m) => m.key}
            columnToggle={false}
            pageSize={false}
            rowClassName={(m) => (m.available ? undefined : "opacity-60")}
            toolbar={
              <TableTitle
                title="Metric breakdown"
                hint="Unmeasured metrics are excluded from the score rather than counted as zero."
              />
            }
          />
        </>
      )}

      <VitalsTable rows={vitals ?? []} />
    </div>
  )
}

function VitalsTable({ rows }: { rows: VitalsView[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex gap-2 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div>
            <p className="font-medium">No Core Web Vitals measured yet</p>
            <p className="text-muted-foreground text-xs">
              “Measure vitals + traffic” checks this site&apos;s money pages (or its top pages by
              clicks if none are set). It also runs weekly.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
  const anyLab = rows.some((r) => r.source === "PSI_LAB")
  return (
    <DataTable
      tableId="seo-vitals"
      itemLabel="page"
      columns={VITALS_COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      columnToggle={false}
      toolbar={
        <TableTitle
          title="Core Web Vitals"
          hint={`Field data comes from real Chrome users and is what Google ranks on.${
            anyLab
              ? " Lab rows are a simulation - used only where a page has too little traffic for field data."
              : ""
          }`}
        />
      }
      footerNote={
        rows.some((r) => r.source === "PSI_LAB" && r.inpMs === null) ? (
          <span className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            INP cannot be measured in a lab run - it needs a real user interaction. Those rows show
            “-” rather than a substitute metric.
          </span>
        ) : undefined
      }
    />
  )
}

const METRIC_COLUMNS: DataTableColumn<ScorecardMetricView>[] = [
  { header: "Metric", sortValue: (m) => m.label, className: "font-medium", cell: (m) => m.label },
  {
    header: "Weight",
    align: "right",
    className: "tabular-nums",
    sortValue: (m) => m.weight,
    cell: (m) => m.weight,
  },
  {
    header: "Points",
    align: "right",
    className: "tabular-nums",
    sortValue: (m) => (m.available ? m.points : null),
    cell: (m) =>
      m.available ? (
        <span
          className={cn(
            m.ratio !== null && m.ratio >= 0.8 && "text-emerald-600",
            m.ratio !== null && m.ratio < 0.4 && "text-red-600",
          )}
        >
          {m.points.toFixed(1)}
        </span>
      ) : (
        <Badge variant="outline" className="text-[10px]">
          no data
        </Badge>
      ),
  },
  {
    header: "Detail",
    className: "text-muted-foreground min-w-[240px] text-xs whitespace-normal",
    cell: (m) => m.note,
  },
]

const VITALS_COLUMNS: DataTableColumn<VitalsView>[] = [
  {
    header: "Page",
    sortValue: (r) => r.url,
    className: "max-w-[320px] truncate",
    cell: (r) => (
      <a
        href={r.url}
        target="_blank"
        rel="noopener noreferrer"
        title={r.url}
        className="hover:underline"
      >
        {r.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
      </a>
    ),
  },
  {
    header: "Source",
    sortValue: (r) => r.source,
    className: "text-xs",
    cell: (r) =>
      r.source === "CRUX_FIELD" ? (
        <span className="text-emerald-600">field</span>
      ) : (
        <span className="text-muted-foreground">lab</span>
      ),
  },
  {
    header: "LCP",
    align: "right",
    className: "tabular-nums",
    sortValue: (r) => r.lcpMs,
    cell: (r) => (r.lcpMs !== null ? `${(r.lcpMs / 1000).toFixed(1)}s` : "-"),
  },
  {
    header: "INP",
    align: "right",
    className: "tabular-nums",
    sortValue: (r) => r.inpMs,
    cell: (r) => (r.inpMs !== null ? `${r.inpMs}ms` : "-"),
  },
  {
    header: "CLS",
    align: "right",
    className: "tabular-nums",
    sortValue: (r) => r.cls,
    cell: (r) => (r.cls !== null ? r.cls.toFixed(2) : "-"),
  },
  {
    header: "Verdict",
    // Good first, poor last.
    sortValue: (r) => (r.verdict ? Object.keys(VERDICTS).indexOf(r.verdict) : null),
    cell: (r) =>
      r.verdict ? (
        <span
          className={cn("rounded-sm px-1.5 py-0.5 text-xs font-medium", VERDICTS[r.verdict]?.cls)}
        >
          {VERDICTS[r.verdict]?.label}
        </span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
]

/** A card table's heading, in the table's toolbar. */
function TableTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}
