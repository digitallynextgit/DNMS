"use client"

import { useMemo, useState } from "react"
import {
  ExternalLink,
  IndianRupee,
  Package,
  Repeat,
  ShoppingCart,
  Tag,
  TrendingUp,
  Undo2,
} from "lucide-react"
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/shared/stat-card"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_LABEL_STYLE } from "@/lib/chart-theme"
import { inr, compact, SHOPIFY_GREEN } from "./meta-shared"
import { InsightsRangeBar, useInsightsRange } from "./insights-range"
import { useShopifyIntegration, useSyncShopify } from "../hooks/use-integration"
import type { ShopifyBreakdownRow, ShopifyDashboard } from "../server/shopify-sync.service"

// Analytics -> Shopify: the store's sales for the chosen days, synced every 15 minutes.

/** % change from `prev`; null when there is nothing to compare against. */
function change(
  now: number,
  prev: number | undefined,
): { value: number; label: string } | undefined {
  if (prev === undefined || prev <= 0) return undefined
  return { value: Math.round(((now - prev) / prev) * 1000) / 10, label: "% vs previous period" }
}

export function ShopifyInsights({
  projectId,
  canManage,
}: {
  projectId: string
  canManage: boolean
}) {
  const rangeState = useInsightsRange()
  const { data, isLoading } = useShopifyIntegration(projectId, rangeState.range)
  const sync = useSyncShopify(projectId)
  const [search, setSearch] = useState("")

  const products = data?.topProducts
  const q = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      (products ?? []).filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          (p.variantTitle ?? "").toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q),
      ),
    [products, q],
  )

  if (isLoading && !data) return <ListSkeleton rows={3} height="h-24" />

  if (!data?.connected) {
    return (
      <EmptyState
        compact
        icon={ExternalLink}
        title="Shopify isn't connected."
        description="Connect the store from Connections to see its sales here."
      />
    )
  }

  const t = data.totals
  const prev = data.previous ?? undefined
  const knownCustomers = t.newCustomerOrders + t.returningCustomerOrders
  const blendedRoas = data.metaSpend && data.metaSpend > 0 ? t.totalSales / data.metaSpend : null
  // Asking for more than Shopify keeps: say why the early days may be empty.
  const beyondHistory =
    Boolean(rangeState.customRange) ||
    rangeState.rangeDays === undefined ||
    rangeState.rangeDays > data.historyDays

  const columns: DataTableColumn<ShopifyDashboard["topProducts"][number]>[] = [
    {
      header: "Product",
      sortValue: (p) => p.title,
      className: "max-w-[320px] truncate",
      cell: (p) => (
        <span title={p.title}>
          <span className="font-medium">{p.title}</span>
          {p.variantTitle && p.variantTitle !== "Default Title" && (
            <span className="text-muted-foreground"> · {p.variantTitle}</span>
          )}
        </span>
      ),
    },
    {
      header: "SKU",
      sortValue: (p) => p.sku ?? "",
      cell: (p) => <span className="text-muted-foreground">{p.sku || "-"}</span>,
    },
    {
      header: "Orders",
      align: "right",
      className: "tabular-nums",
      sortValue: (p) => p.orders,
      cell: (p) => p.orders.toLocaleString("en-IN"),
    },
    {
      header: "Units",
      align: "right",
      className: "tabular-nums",
      sortValue: (p) => p.units,
      cell: (p) => p.units.toLocaleString("en-IN"),
    },
    {
      header: "Revenue",
      align: "right",
      className: "tabular-nums",
      sortValue: (p) => p.revenue,
      cell: (p) => inr(p.revenue),
    },
    {
      header: "Share",
      align: "right",
      className: "tabular-nums",
      sortValue: (p) => p.share,
      cell: (p) => `${p.share.toFixed(1)}%`,
    },
  ]

  return (
    <div className="space-y-4">
      <InsightsRangeBar
        state={rangeState}
        lastSyncedAt={data.lastSyncedAt}
        canManage={canManage}
        onSync={() => sync.mutate()}
        syncing={sync.isPending}
      />

      {data.lastSyncError && (
        <p className="text-destructive text-xs">Last sync error: {data.lastSyncError}</p>
      )}
      {beyondHistory && (
        <p className="text-muted-foreground text-xs">
          Shopify hands over only the last {data.historyDays} days of orders. Earlier days fill in
          as DNMS keeps syncing, so they may be missing for now.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Total sales"
          value={inr(t.totalSales)}
          trend={change(t.totalSales, prev?.totalSales)}
          icon={IndianRupee}
          loading={isLoading}
        />
        <StatCard
          title="Orders"
          value={t.orders.toLocaleString("en-IN")}
          description={`${t.fulfilledOrders} fulfilled`}
          trend={change(t.orders, prev?.orders)}
          icon={ShoppingCart}
          loading={isLoading}
        />
        <StatCard
          title="Avg order value"
          value={t.orders > 0 ? inr(t.aov) : "-"}
          trend={change(t.aov, prev?.aov)}
          icon={Tag}
          loading={isLoading}
        />
        <StatCard
          title="Units sold"
          value={t.unitsSold.toLocaleString("en-IN")}
          trend={change(t.unitsSold, prev?.unitsSold)}
          icon={Package}
          loading={isLoading}
        />
        <StatCard
          title="Net sales"
          value={inr(t.netSales)}
          description="After discounts and returns"
          icon={IndianRupee}
          loading={isLoading}
        />
        <StatCard
          title="Discounts"
          value={inr(t.discounts)}
          description={
            t.grossSales > 0
              ? `${((t.discounts / t.grossSales) * 100).toFixed(1)}% of gross`
              : undefined
          }
          icon={Undo2}
          loading={isLoading}
        />
        <StatCard
          title="Returning customers"
          value={
            knownCustomers > 0
              ? `${Math.round((t.returningCustomerOrders / knownCustomers) * 100)}%`
              : "-"
          }
          description={
            knownCustomers > 0
              ? `${t.returningCustomerOrders} of ${knownCustomers} orders`
              : "Shopify hasn't said yet"
          }
          icon={Repeat}
          loading={isLoading}
        />
        <StatCard
          title="Blended ROAS"
          value={blendedRoas !== null ? blendedRoas.toFixed(2) + "x" : "-"}
          description={
            blendedRoas !== null
              ? `Store sales ÷ ${inr(data.metaSpend!)} Meta spend`
              : "Needs Meta Ads spend in this range"
          }
          icon={TrendingUp}
          iconColor={
            blendedRoas === null ? undefined : blendedRoas >= 1 ? "text-green-600" : "text-red-500"
          }
          iconBg={
            blendedRoas === null
              ? undefined
              : blendedRoas >= 1
                ? "bg-green-500/10"
                : "bg-red-500/10"
          }
          loading={isLoading}
        />
      </div>

      {t.orders === 0 ? (
        <EmptyState
          compact
          icon={ShoppingCart}
          title="No orders in this range."
          description={
            data.lastSyncedAt
              ? "Pick a longer range, or check back after the next sync."
              : "The first sync hasn't finished yet."
          }
        />
      ) : (
        <>
          <SalesChart daily={data.daily} />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SalesBreakdown totals={t} />
            <BreakdownCard title="By sales channel" rows={data.byChannel} label={(k) => k} />
            <BreakdownCard
              title="By referring site"
              rows={data.byReferrer}
              label={(k) => (k === "direct" ? "Direct / none" : k)}
            />
            <BreakdownCard title="By state" rows={data.byState} label={(k) => k} />
          </div>

          <DataTable
            tableId="shopify-products"
            exportName="shopify-products"
            itemLabel="product"
            columns={columns}
            rows={filtered}
            rowKey={(p) => p.key}
            showSerial
            minWidth="min-w-[720px]"
            pageKey={`${rangeState.rangeKey}|${q}`}
            toolbar={
              <TableSearch
                value={search}
                onChange={setSearch}
                placeholder="Search products"
                label="Search products by name or SKU"
              />
            }
            empty="No products match this search."
          />
        </>
      )}
    </div>
  )
}

function SalesChart({ daily }: { daily: ShopifyDashboard["daily"] }) {
  if (daily.length === 0) return null
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
          Sales and orders by day
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={daily} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gShopifySales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SHOPIFY_GREEN} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SHOPIFY_GREEN} stopOpacity={0} />
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
              yAxisId="sales"
              tickFormatter={(v) => compact(Number(v))}
              fontSize={11}
              stroke="currentColor"
              className="text-muted-foreground"
              width={44}
            />
            <YAxis yAxisId="orders" orientation="right" allowDecimals={false} hide />
            <Tooltip
              formatter={(v, n) =>
                n === "totalSales" ? [inr(Number(v)), "Total sales"] : [String(v), "Orders"]
              }
              contentStyle={CHART_TOOLTIP_STYLE}
              labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            />
            <Bar
              yAxisId="orders"
              dataKey="orders"
              fill="#64748b"
              fillOpacity={0.25}
              radius={[2, 2, 0, 0]}
            />
            <Area
              yAxisId="sales"
              type="monotone"
              dataKey="totalSales"
              stroke={SHOPIFY_GREEN}
              fill="url(#gShopifySales)"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

/** Gross down to total, line by line, as Shopify's own sales report reads. */
function SalesBreakdown({ totals: t }: { totals: ShopifyDashboard["totals"] }) {
  const rows: { label: string; value: number; minus?: boolean; strong?: boolean }[] = [
    { label: "Gross sales", value: t.grossSales },
    { label: "Discounts", value: t.discounts, minus: true },
    { label: "Returns", value: t.returns, minus: true },
    { label: "Net sales", value: t.netSales, strong: true },
    { label: "Shipping", value: t.shipping },
    { label: "Taxes", value: t.taxes },
    { label: "Total sales", value: t.totalSales, strong: true },
  ]
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Sales breakdown
        </p>
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li
              key={r.label}
              className={
                r.strong
                  ? "flex justify-between border-t pt-1.5 font-semibold"
                  : "flex justify-between"
              }
            >
              <span className={r.strong ? undefined : "text-muted-foreground"}>{r.label}</span>
              <span className="tabular-nums">
                {r.minus && r.value > 0 ? "-" : ""}
                {inr(r.value)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

const BREAKDOWN_ROWS = 6

function BreakdownCard({
  title,
  rows,
  label,
}: {
  title: string
  rows: ShopifyBreakdownRow[]
  label: (key: string) => string
}) {
  const total = rows.reduce((s, r) => s + r.sales, 0)
  const shown = rows.slice(0, BREAKDOWN_ROWS)
  const rest = rows.slice(BREAKDOWN_ROWS)
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {title}
        </p>
        <ul className="space-y-2 text-sm">
          {shown.map((r) => {
            const pct = total > 0 ? (r.sales / total) * 100 : 0
            return (
              <li key={r.key}>
                <div className="flex justify-between gap-2">
                  <span className="truncate" title={label(r.key)}>
                    {label(r.key)}
                  </span>
                  <span className="shrink-0 tabular-nums">{inr(r.sales)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: SHOPIFY_GREEN }}
                    />
                  </div>
                  <span className="text-muted-foreground w-20 shrink-0 text-right text-[11px] tabular-nums">
                    {r.orders} order{r.orders === 1 ? "" : "s"}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        {rest.length > 0 && (
          <p className="text-muted-foreground text-[11px]">
            +{rest.length} more · {inr(rest.reduce((s, r) => s + r.sales, 0))}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
