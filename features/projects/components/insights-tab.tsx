"use client"

import { useMemo, useState } from "react"
import {
  RefreshCw,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatCard } from "@/components/shared/stat-card"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { SearchInput } from "@/components/shared/search-input"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { cn } from "@/lib/utils"
import { TONE } from "@/lib/constants"
import { FacebookIcon, inr, compact, CAMPAIGN_STATUS_COLORS } from "./meta-shared"
import { useProjectIntegration, useSyncMeta } from "../hooks/use-integration"

/**
 * Insights tab = the DATA, with a sub-tab per platform. Connections are managed in
 * the Integration tab; this only reads and renders what's been synced.
 */
export function InsightsTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  return (
    <Tabs defaultValue="meta" className="mt-4 space-y-4">
      <TabsList>
        <TabsTrigger value="meta" className="gap-1.5">
          <FacebookIcon className="h-3.5 w-3.5 text-[#1877F2]" />
          Meta Ads
        </TabsTrigger>
      </TabsList>
      <TabsContent value="meta">
        <MetaInsights projectId={projectId} canManage={canManage} />
      </TabsContent>
    </Tabs>
  )
}

const RANGES: { label: string; days?: number }[] = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "All", days: undefined },
]

type SortKey = "spend" | "roas" | "purchases" | "impressions" | "clicks"
const SORTS: { value: SortKey; label: string }[] = [
  { value: "spend", label: "Spend" },
  { value: "roas", label: "ROAS" },
  { value: "purchases", label: "Purchases" },
  { value: "impressions", label: "Impressions" },
  { value: "clicks", label: "Clicks" },
]

const PAGE_SIZE = 10

function MetaInsights({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const [rangeDays, setRangeDays] = useState<number | undefined>(30)
  const { data, isLoading } = useProjectIntegration(projectId, rangeDays)
  const sync = useSyncMeta(projectId)

  // Campaigns table controls
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all")
  const [sortBy, setSortBy] = useState<SortKey>("spend")
  const [page, setPage] = useState(1)

  const allCampaigns = data?.topCampaigns ?? []
  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    const rows = allCampaigns.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false
      if (q && !c.name.toLowerCase().includes(q)) return false
      return true
    })
    return [...rows].sort((a, b) => b[sortBy] - a[sortBy])
  }, [allCampaigns, statusFilter, q, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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
    { header: "Campaign", cell: (c) => <span className="font-medium">{c.name}</span> },
    {
      header: "Status",
      cell: (c) => (
        <StatusBadge
          status={c.status}
          colorMap={CAMPAIGN_STATUS_COLORS}
          size="xs"
          fallbackColor={TONE.neutral}
        />
      ),
    },
    { header: "Spend", align: "right", className: "tabular-nums", cell: (c) => inr(c.spend) },
    {
      header: "Impr.",
      align: "right",
      className: "tabular-nums",
      cell: (c) => c.impressions.toLocaleString("en-IN"),
    },
    {
      header: "Clicks",
      align: "right",
      className: "tabular-nums",
      cell: (c) => c.clicks.toLocaleString("en-IN"),
    },
    { header: "Purchases", align: "right", className: "tabular-nums", cell: (c) => c.purchases },
    {
      header: "ROAS",
      align: "right",
      className: "tabular-nums",
      cell: (c) => c.roas.toFixed(2) + "x",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Date range + sync */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-card inline-flex items-center rounded-lg border p-0.5 text-xs">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => {
                setRangeDays(r.days)
                setPage(1)
              }}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                rangeDays === r.days
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {data.lastSyncedAt && (
          <span className="text-muted-foreground text-xs">
            Last synced {new Date(data.lastSyncedAt).toLocaleString("en-IN")}
          </span>
        )}
        {canManage && (
          <Button
            size="sm"
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

      {/* KPI cards (windowed) */}
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

      {/* Trend */}
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
                <Tooltip
                  formatter={(v, n) => [inr(Number(v)), n === "spend" ? "Spend" : "Purchase value"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
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

      {/* Campaigns: search + status + sort + pagination */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search campaigns..."
          className="max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                Sort: {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {filtered.length} of {allCampaigns.length} campaigns
        </span>
      </div>

      {allCampaigns.length === 0 ? (
        <EmptyState
          compact
          icon={ExternalLink}
          title="No campaign data yet."
          description="Click Sync now to pull the latest from Meta."
        />
      ) : filtered.length === 0 ? (
        <EmptyState compact icon={ExternalLink} title="No campaigns match these filters." />
      ) : (
        <DataTable
          columns={columns}
          rows={paged}
          rowKey={(c) => c.name}
          showSerial
          serialOffset={(currentPage - 1) * PAGE_SIZE}
          minWidth="min-w-[760px]"
          pagination={{
            page: currentPage,
            totalPages,
            total: filtered.length,
            onPageChange: setPage,
            itemLabel: "campaigns",
          }}
        />
      )}
    </div>
  )
}
