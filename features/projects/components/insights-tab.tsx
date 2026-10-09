"use client"

import { useMemo, useState } from "react"
import {
  RefreshCw,
  Plug,
  IndianRupee,
  Eye,
  MousePointerClick,
  ShoppingCart,
  TrendingUp,
  Users,
  ExternalLink,
} from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TabsBar } from "@/components/shared/tabs-bar"
import { IntegrationDialog } from "./integration-tab"
import { StatCard } from "@/components/shared/stat-card"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { TableViewMenu } from "@/components/shared/table-view-menu"
import { StatusBadge } from "@/components/shared/status-badge"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { TONE } from "@/lib/constants"
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_LABEL_STYLE } from "@/lib/chart-theme"
import { FacebookIcon, inr, compact, CAMPAIGN_STATUS_COLORS } from "./meta-shared"
import { DateRangePicker, type DayRange } from "./date-range-picker"
import { useProjectIntegration, useSyncMeta } from "../hooks/use-integration"

export function InsightsTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const [connections, setConnections] = useState(false)
  return (
    <Tabs defaultValue="meta" className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsBar
          spacing="none"
          variant="underline"
          className="w-auto flex-1"
          items={[{ value: "meta", label: "Meta Ads", icon: MetaAdsIcon }]}
        />
        <Button variant="outline" className="gap-1.5" onClick={() => setConnections(true)}>
          <Plug className="h-3.5 w-3.5" /> Connections
        </Button>
      </div>
      <TabsContent value="meta">
        <MetaInsights projectId={projectId} canManage={canManage} />
      </TabsContent>
      <IntegrationDialog
        projectId={projectId}
        canManage={canManage}
        open={connections}
        onOpenChange={setConnections}
      />
    </Tabs>
  )
}

/** Meta blue is part of the platform's identity, so the tab icon keeps it. */
function MetaAdsIcon() {
  return <FacebookIcon className="text-[#1877F2]" />
}

const ALL_RANGE = "all"

const RANGES: { label: string; days?: number }[] = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "All", days: undefined },
]

const CAMPAIGN_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
] as const

function MetaInsights({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const [rangeDays, setRangeDays] = useState<number | undefined>(30)
  // Overrides the preset rather than replacing it, so clearing it falls back to the last preset.
  const [customRange, setCustomRange] = useState<DayRange | undefined>()
  const { data, isLoading } = useProjectIntegration(
    projectId,
    customRange ? { from: customRange.from, to: customRange.to } : { days: rangeDays },
  )
  const sync = useSyncMeta(projectId)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all")

  const allCampaigns = data?.topCampaigns ?? []
  const q = search.trim().toLowerCase()
  // Biggest spend first until someone sorts by a column heading.
  const filtered = useMemo(
    () =>
      allCampaigns
        .filter(
          (c) =>
            (statusFilter === "all" || c.status === statusFilter) &&
            (!q || c.name.toLowerCase().includes(q)),
        )
        .sort((a, b) => b.spend - a.spend),
    [allCampaigns, statusFilter, q],
  )
  const rangeKey = customRange ? `${customRange.from}~${customRange.to}` : String(rangeDays)

  if (isLoading && !data) return <ListSkeleton rows={3} height="h-24" />

  if (!data?.connected) {
    return (
      <EmptyState
        compact
        icon={ExternalLink}
        title="Meta Ads isn't connected."
        description="Connect it in the Integration tab to see performance here."
      />
    )
  }

  const t = data.totals
  const columns: DataTableColumn<(typeof allCampaigns)[number]>[] = [
    {
      header: "Campaign",
      sortValue: (c) => c.name,
      className: "max-w-[320px] truncate",
      cell: (c) => (
        <span className="font-medium" title={c.name}>
          {c.name}
        </span>
      ),
    },
    {
      header: "Status",
      sortValue: (c) => c.status,
      cell: (c) => (
        <StatusBadge
          status={c.status}
          colorMap={CAMPAIGN_STATUS_COLORS}
          size="xs"
          fallbackColor={TONE.neutral}
        />
      ),
    },
    {
      header: "Spend",
      align: "right",
      className: "tabular-nums",
      sortValue: (c) => c.spend,
      cell: (c) => inr(c.spend),
    },
    {
      header: "Impr.",
      align: "right",
      className: "tabular-nums",
      sortValue: (c) => c.impressions,
      cell: (c) => c.impressions.toLocaleString("en-IN"),
    },
    {
      header: "Clicks",
      align: "right",
      className: "tabular-nums",
      sortValue: (c) => c.clicks,
      cell: (c) => c.clicks.toLocaleString("en-IN"),
    },
    {
      header: "Purchases",
      align: "right",
      className: "tabular-nums",
      sortValue: (c) => c.purchases,
      cell: (c) => c.purchases,
    },
    {
      header: "ROAS",
      align: "right",
      className: "tabular-nums",
      sortValue: (c) => c.roas,
      cell: (c) => c.roas.toFixed(2) + "x",
    },
  ]
  const statusViews = [
    { value: "all", label: "All", count: allCampaigns.length },
    ...CAMPAIGN_STATUSES.map((s) => ({
      value: s.value,
      label: s.label,
      count: allCampaigns.filter((c) => c.status === s.value).length,
    })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          aria-label="Date range"
          // "All" has no day count, so it needs a sentinel value.
          value={rangeDays === undefined ? ALL_RANGE : String(rangeDays)}
          // A preset is only "on" when no custom span is overriding it.
          muted={Boolean(customRange)}
          onChange={(days) => {
            setRangeDays(days === ALL_RANGE ? undefined : Number(days))
            setCustomRange(undefined)
          }}
          options={RANGES.map((r) => ({
            value: r.days === undefined ? ALL_RANGE : String(r.days),
            label: r.label,
          }))}
        />

        <DateRangePicker
          value={customRange}
          onChange={setCustomRange}
          onClear={() => setCustomRange(undefined)}
        />
        {data.lastSyncedAt && (
          <span className="text-muted-foreground text-xs">
            Last synced {new Date(data.lastSyncedAt).toLocaleString("en-IN")}
          </span>
        )}
        {canManage && (
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => sync.mutate(undefined)}
            loading={sync.isPending}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Sync now
          </Button>
        )}
      </div>

      {data.lastSyncError && (
        <p className="text-destructive text-xs">Last sync error: {data.lastSyncError}</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Spend" value={inr(t.spend)} icon={IndianRupee} loading={isLoading} />
        <StatCard
          title="Impressions"
          value={compact(t.impressions)}
          icon={Eye}
          loading={isLoading}
        />
        <StatCard
          title="Clicks"
          value={compact(t.clicks)}
          description={`${t.ctr.toFixed(2)}% CTR`}
          icon={MousePointerClick}
          loading={isLoading}
        />
        <StatCard title="Reach" value={compact(t.reach)} icon={Users} loading={isLoading} />
        <StatCard
          title="Purchases"
          value={String(t.purchases)}
          icon={ShoppingCart}
          loading={isLoading}
        />
        <StatCard
          title="Purchase value"
          value={inr(t.purchaseValue)}
          icon={IndianRupee}
          loading={isLoading}
        />
        <StatCard
          title="ROAS"
          value={t.roas.toFixed(2) + "x"}
          icon={TrendingUp}
          iconColor={t.roas >= 1 ? "text-green-600" : "text-red-500"}
          iconBg={t.roas >= 1 ? "bg-green-500/10" : "bg-red-500/10"}
          loading={isLoading}
        />
        <StatCard
          title="Avg CPC"
          value={t.clicks > 0 ? inr(t.spend / t.clicks) : "-"}
          icon={IndianRupee}
          loading={isLoading}
        />
      </div>

      {data.daily.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
              Spend vs purchase value
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.daily} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => String(d).slice(5)}
                  fontSize={11}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tickFormatter={(v) => compact(Number(v))}
                  fontSize={11}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  width={44}
                />
                {/* No itemStyle: the two areas are told apart by colour alone. */}
                <Tooltip
                  formatter={(v, n) => [inr(Number(v)), n === "spend" ? "Spend" : "Purchase value"]}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                />
                <Area
                  type="monotone"
                  dataKey="spend"
                  stroke="#3b82f6"
                  fill="url(#gSpend)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="purchaseValue"
                  stroke="#10b981"
                  fill="url(#gRev)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {allCampaigns.length === 0 ? (
        <EmptyState
          compact
          icon={ExternalLink}
          title="No campaign data yet."
          description="Click Sync now to pull the latest from Meta."
        />
      ) : (
        // Name + index in the unfiltered list: Meta names can repeat, and ticks survive a filter change.
        <DataTable
          tableId="meta-campaigns"
          exportName="meta-campaigns"
          itemLabel="campaign"
          columns={columns}
          rows={filtered}
          rowKey={(c) => `${c.name}|${allCampaigns.indexOf(c)}`}
          showSerial
          minWidth="min-w-[760px]"
          pageKey={`${rangeKey}|${statusFilter}|${q}`}
          toolbar={
            <>
              <TableViewMenu
                label="Status"
                value={statusFilter}
                options={statusViews}
                onChange={setStatusFilter}
              />
              <TableSearch
                value={search}
                onChange={setSearch}
                placeholder="Search campaigns"
                label="Search campaigns by name"
              />
            </>
          }
          empty="No campaigns match these filters."
        />
      )}
    </div>
  )
}
