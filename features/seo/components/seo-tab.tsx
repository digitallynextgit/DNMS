"use client"

import { useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Eye,
  Globe,
  Info,
  ListOrdered,
  Minus,
  MousePointerClick,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Target,
  Trash2,
  CheckSquare,
  Gauge,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { cn } from "@/lib/utils"
import type { SeoAlert, SeoOverview, SeoPropertySummary, SeoRollup, SeoRowStat } from "../types"
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/constants"
import {
  useDeleteSeoSite,
  useSeoOverview,
  useSeoRollup,
  useSeoSites,
  useSyncAllSeo,
  useSyncSeoSite,
} from "../hooks/use-seo"
import { SiteFormDialog } from "./site-form-dialog"
import { ScorecardPanel } from "./scorecard-panel"

// =============================================================================
// SEO tab. A project can track MANY sites (KYG = 13 subdomains under one
// account), so the default view is the roll-up across all of them and each site
// drills down to its own full report.
// =============================================================================

const ALL = "__all__"
const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const num = (v: number) => v.toLocaleString("en-IN")

/** Signed change. `change` already carries a corrected sign from the server, so
 *  positive always means "better", even for average position. */
function Delta({
  change,
  changePct,
  decimals = 0,
}: {
  change: number
  changePct: number | null
  decimals?: number
}) {
  const flat = Math.abs(change) < (decimals ? 0.05 : 0.5)
  const good = change > 0
  const Icon = flat ? Minus : good ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        flat ? "text-muted-foreground" : good ? "text-emerald-600" : "text-red-600",
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(change).toFixed(decimals)}
      {changePct !== null && !flat && (
        <span className="opacity-70">({Math.abs(changePct).toFixed(0)}%)</span>
      )}
    </span>
  )
}

function AlertCard({ a, prefix }: { a: SeoAlert; prefix?: string }) {
  return (
    <Card
      className={cn(
        a.level === "critical" && "border-red-500/40 bg-red-500/5",
        a.level === "warning" && "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <CardContent className="flex gap-2 p-3 text-sm">
        {a.level === "info" ? (
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        ) : (
          <AlertTriangle
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              a.level === "critical" ? "text-red-600" : "text-amber-600",
            )}
          />
        )}
        <div>
          <p className="font-medium">
            {prefix && <span className="text-muted-foreground">{prefix} · </span>}
            {a.title}
          </p>
          <p className="text-muted-foreground text-xs">{a.detail}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function SeoTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { data, isLoading } = useSeoSites(projectId)
  const [selected, setSelected] = useState<string>(ALL)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const syncAll = useSyncAllSeo(projectId)
  const removeSite = useDeleteSeoSite(projectId)

  const sites = data?.properties ?? []
  const gscConfigured = !!data?.gscConfigured
  // A site can vanish (deleted elsewhere) while it's selected - fall back rather
  // than querying an id that no longer exists.
  const current = sites.find((s) => s.id === selected) ?? null
  const activeId = current?.id ?? null

  if (isLoading) return <ListSkeleton />

  if (sites.length === 0) {
    return (
      <div className="mt-4 space-y-4">
        <SetupNotice serviceAccount={data?.serviceAccount ?? null} configured={gscConfigured} />
        <EmptyState
          icon={Search}
          title="No sites tracked yet"
          description={
            canManage
              ? "Add the first site to start pulling Search Console data. Subdomains of the same client belong here too."
              : "A project manager needs to add a site before reports appear."
          }
          action={
            canManage
              ? {
                  label: "Add site",
                  onClick: () => {
                    setEditing(null)
                    setFormOpen(true)
                  },
                }
              : undefined
          }
        />
        {canManage && (
          <SiteFormDialog
            projectId={projectId}
            site={null}
            open={formOpen}
            onOpenChange={setFormOpen}
            gscConfigured={gscConfigured}
          />
        )}
      </div>
    )
  }

  const editTarget = editing ? (sites.find((s) => s.id === editing) ?? null) : null

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sites ({sites.length})</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label} — {s.domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && !current.isActive && <Badge variant="outline">Paused</Badge>}
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add site
            </Button>
            {current ? (
              <SiteActions
                projectId={projectId}
                site={current.id}
                onEdit={() => {
                  setEditing(current.id)
                  setFormOpen(true)
                }}
                onDelete={() => setConfirmDelete(current.id)}
              />
            ) : (
              <Button size="sm" onClick={() => syncAll.mutate()} disabled={syncAll.isPending}>
                <RefreshCw
                  className={cn("mr-1.5 h-3.5 w-3.5", syncAll.isPending && "animate-spin")}
                />
                Sync all
              </Button>
            )}
          </div>
        )}
      </div>

      {selected === ALL ? (
        <RollupView projectId={projectId} onOpenSite={setSelected} />
      ) : (
        <SiteReport projectId={projectId} propertyId={activeId} canManage={canManage} />
      )}

      {canManage && (
        <SiteFormDialog
          projectId={projectId}
          site={editTarget}
          open={formOpen}
          onOpenChange={(v) => {
            setFormOpen(v)
            if (!v) setEditing(null)
          }}
          gscConfigured={gscConfigured}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop tracking this site?</AlertDialogTitle>
            <AlertDialogDescription>
              Its stored Search Console history is deleted with it. To pause syncing without losing
              history, edit the site and turn off “Include in weekly sync” instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  removeSite.mutate(confirmDelete)
                  if (selected === confirmDelete) setSelected(ALL)
                }
                setConfirmDelete(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SiteActions({
  projectId,
  site,
  onEdit,
  onDelete,
}: {
  projectId: string
  site: string
  onEdit: () => void
  onDelete: () => void
}) {
  const sync = useSyncSeoSite(projectId)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => sync.mutate({ propertyId: site, backfill: true })}
        disabled={sync.isPending}
      >
        Backfill 8 weeks
      </Button>
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        Edit
      </Button>
      <Button variant="outline" size="sm" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" onClick={() => sync.mutate({ propertyId: site })} disabled={sync.isPending}>
        <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", sync.isPending && "animate-spin")} />
        Sync
      </Button>
    </>
  )
}

// --- roll-up ----------------------------------------------------------------

function RollupView({
  projectId,
  onOpenSite,
}: {
  projectId: string
  onOpenSite: (id: string) => void
}) {
  const { data: r, isLoading } = useSeoRollup(projectId, true)
  if (isLoading) return <ListSkeleton />
  if (!r) return null

  const hasData = r.properties.some((p) => p.period)

  return (
    <div className="space-y-4">
      {r.period && (
        <p className="text-muted-foreground text-xs">
          Week of {r.period.start} → {r.period.end}, combined across {r.properties.length} site
          {r.properties.length > 1 ? "s" : ""}.
        </p>
      )}

      {!hasData && (
        <EmptyState
          icon={RefreshCw}
          title="No Search Console data yet"
          description="Use “Sync all” to pull data for every site. Backfill on a single site gives it 8 weeks of history straight away."
        />
      )}

      {hasData && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Clicks"
            value={num(r.totals.clicks.current)}
            icon={MousePointerClick}
            description={
              r.totals.clicks.comparable
                ? `vs ${num(r.totals.clicks.previous)} last week`
                : "no previous week yet"
            }
            trend={
              r.totals.clicks.comparable && r.totals.clicks.changePct !== null
                ? { value: r.totals.clicks.changePct, label: "wk/wk" }
                : undefined
            }
          />
          <StatCard
            title="Impressions"
            value={num(r.totals.impressions.current)}
            icon={Eye}
            description={
              r.totals.impressions.comparable
                ? `vs ${num(r.totals.impressions.previous)} last week`
                : "no previous week yet"
            }
            trend={
              r.totals.impressions.comparable && r.totals.impressions.changePct !== null
                ? { value: r.totals.impressions.changePct, label: "wk/wk" }
                : undefined
            }
          />
          <StatCard title="CTR" value={pct(r.totals.ctr)} icon={Target} description="all sites" />
          <StatCard
            title="Avg position"
            value={r.totals.position.current.toFixed(1)}
            icon={ListOrdered}
            description="impression-weighted"
          />
        </div>
      )}

      {r.alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Needs attention</p>
          {r.alerts.map((a, i) => (
            <AlertCard key={i} a={a} prefix={a.property} />
          ))}
        </div>
      )}

      <SitesTable properties={r.properties} onOpenSite={onOpenSite} />
    </div>
  )
}

function SitesTable({
  properties,
  onOpenSite,
}: {
  properties: SeoPropertySummary[]
  onOpenSite: (id: string) => void
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-border border-b px-4 py-3">
          <p className="text-sm font-medium">Sites</p>
          <p className="text-muted-foreground text-xs">Click a site for its full report.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-border border-b text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Site</th>
                <th className="px-4 py-2 text-right font-medium">Clicks</th>
                <th className="px-4 py-2 text-right font-medium">Impr.</th>
                <th className="px-4 py-2 text-right font-medium">CTR</th>
                <th className="px-4 py-2 text-right font-medium">Avg pos</th>
                <th className="px-4 py-2 text-right font-medium">Work</th>
                <th className="px-4 py-2 text-right font-medium">Synced</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onOpenSite(p.id)}
                  className="hover:bg-muted/50 border-border/60 cursor-pointer border-b last:border-0"
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      {p.isPrimary ? (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      ) : (
                        <Globe className="text-muted-foreground h-3.5 w-3.5" />
                      )}
                      <span className="font-medium">{p.label}</span>
                      {!p.isActive && (
                        <Badge variant="outline" className="text-[10px]">
                          paused
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">{p.domain}</p>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {p.period ? (
                      <span className="inline-flex items-center gap-1.5">
                        {num(p.clicks.current)}
                        {p.clicks.comparable && (
                          <Delta change={p.clicks.change} changePct={p.clicks.changePct} />
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {p.period ? num(p.impressions.current) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">{p.period ? pct(p.ctr) : "—"}</td>
                  <td className="px-4 py-2 text-right">
                    {p.period ? p.position.current.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {p.openTasks === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {p.openTasks} open
                        {p.overdueTasks > 0 && (
                          <Badge
                            variant="outline"
                            className="border-red-500/40 text-[10px] text-red-600"
                          >
                            {p.overdueTasks} late
                          </Badge>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {p.lastSyncError ? (
                      <span className="text-red-600">failed</span>
                    ) : p.lastSyncedAt ? (
                      new Date(p.lastSyncedAt).toLocaleDateString("en-IN")
                    ) : (
                      <span className="text-muted-foreground">never</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// --- one site ---------------------------------------------------------------

function SiteReport({
  projectId,
  propertyId,
  canManage,
}: {
  projectId: string
  propertyId: string | null
  canManage: boolean
}) {
  const { data: o, isLoading } = useSeoOverview(projectId, propertyId)
  if (isLoading) return <ListSkeleton />
  if (!o) return null

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        {o.period ? `Week of ${o.period.start} → ${o.period.end}` : "No data synced yet"}
        {o.config.lastSyncedAt &&
          ` · last synced ${new Date(o.config.lastSyncedAt).toLocaleString("en-IN")}`}
      </p>

      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList>
          <TabsTrigger value="growth" className="gap-1.5">
            <Search className="h-3.5 w-3.5" /> Growth
          </TabsTrigger>
          <TabsTrigger value="keywords" className="gap-1.5">
            <ListOrdered className="h-3.5 w-3.5" /> Keywords
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Pages
          </TabsTrigger>
          <TabsTrigger value="scorecard" className="gap-1.5">
            <Gauge className="h-3.5 w-3.5" /> Scorecard
          </TabsTrigger>
          <TabsTrigger value="work" className="gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" /> Work
            {o.tasks.length > 0 && (
              <span className="bg-muted ml-0.5 rounded-full px-1.5 text-[10px] leading-4">
                {o.tasks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="growth">
          <GrowthReport o={o} canManage={canManage} />
        </TabsContent>
        <TabsContent value="keywords">
          <div className="space-y-4">
            <MoneyKeywords o={o} />
            <StatTable
              title="Striking distance (position 8–30)"
              hint="Already relevant to Google. On-page work here moves them onto page one fastest."
              rows={o.strikingDistance}
            />
            <StatTable title="Top queries" rows={o.topQueries} />
          </div>
        </TabsContent>
        <TabsContent value="pages">
          <StatTable title="Top pages" rows={o.topPages} isUrl />
        </TabsContent>
        <TabsContent value="scorecard">
          <ScorecardPanel projectId={projectId} propertyId={propertyId} canManage={canManage} />
        </TabsContent>
        <TabsContent value="work">
          <SiteWork o={o} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function GrowthReport({ o, canManage }: { o: SeoOverview; canManage: boolean }) {
  if (!o.period) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="No Search Console data yet"
        description={
          canManage
            ? "Run a sync to pull this site's history. “Backfill 8 weeks” gives you a trend line straight away."
            : "A project manager needs to run the first sync."
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      {o.alerts.length > 0 && (
        <div className="space-y-2">
          {o.alerts.map((a, i) => (
            <AlertCard key={i} a={a} />
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Clicks"
          value={num(o.clicks.current)}
          icon={MousePointerClick}
          description={
            o.clicks.comparable ? `vs ${num(o.clicks.previous)} last week` : "no comparison yet"
          }
          trend={
            o.clicks.comparable && o.clicks.changePct !== null
              ? { value: o.clicks.changePct, label: "wk/wk" }
              : undefined
          }
        />
        <StatCard
          title="Impressions"
          value={num(o.impressions.current)}
          icon={Eye}
          description={
            o.impressions.comparable
              ? `vs ${num(o.impressions.previous)} last week`
              : "no comparison yet"
          }
          trend={
            o.impressions.comparable && o.impressions.changePct !== null
              ? { value: o.impressions.changePct, label: "wk/wk" }
              : undefined
          }
        />
        <StatCard
          title="CTR"
          value={pct(o.ctr.current)}
          icon={Target}
          description="clicks ÷ impressions"
        />
        <StatCard
          title="Avg position"
          value={o.position.current.toFixed(1)}
          icon={ListOrdered}
          description={
            o.position.comparable
              ? `vs ${o.position.previous.toFixed(1)} last week`
              : "no comparison yet"
          }
        />
      </div>

      {o.trend.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-medium">Clicks &amp; impressions by week</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={o.trend}>
                  <defs>
                    <linearGradient id="seoClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#25c1c1" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#25c1c1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="seoImpr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="periodEnd"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="r"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ReTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                    formatter={(v) => num(Number(v ?? 0))}
                  />
                  <Area
                    yAxisId="r"
                    type="monotone"
                    dataKey="impressions"
                    name="Impressions"
                    stroke="#94a3b8"
                    fill="url(#seoImpr)"
                    strokeWidth={1.5}
                  />
                  <Area
                    yAxisId="l"
                    type="monotone"
                    dataKey="clicks"
                    name="Clicks"
                    stroke="#25c1c1"
                    fill="url(#seoClicks)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {o.snapshotCount === 1 && (
        <p className="text-muted-foreground text-xs">
          Only one week is stored, so there is nothing to compare against yet. Use “Backfill 8
          weeks” to build history immediately.
        </p>
      )}
    </div>
  )
}

function MoneyKeywords({ o }: { o: SeoOverview }) {
  if (o.moneyKeywords.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm">
          <p className="font-medium">No money keywords set</p>
          <p className="text-muted-foreground text-xs">
            Edit this site and add the terms it must win — they get tracked every week and alert you
            when they slip off page one.
          </p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-border border-b px-4 py-3">
          <p className="text-sm font-medium">Money keywords</p>
          <p className="text-muted-foreground text-xs">The terms this site is judged on.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-border border-b text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Keyword</th>
                <th className="px-4 py-2 text-right font-medium">Position</th>
                <th className="px-4 py-2 text-right font-medium">Clicks</th>
                <th className="px-4 py-2 text-right font-medium">Impressions</th>
              </tr>
            </thead>
            <tbody>
              {o.moneyKeywords.map((k) => (
                <tr key={k.key} className="border-border/60 border-b last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-medium">{k.key}</span>
                    {!k.tracked && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        not ranking
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {k.tracked ? (
                      <span className="inline-flex items-center gap-2">
                        {k.position.toFixed(1)}
                        {k.prevPosition !== null && (
                          <Delta
                            change={-(k.position - k.prevPosition)}
                            changePct={null}
                            decimals={1}
                          />
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{k.tracked ? num(k.clicks) : "—"}</td>
                  <td className="px-4 py-2 text-right">{k.tracked ? num(k.impressions) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function StatTable({
  title,
  hint,
  rows,
  isUrl = false,
}: {
  title: string
  hint?: string
  rows: SeoRowStat[]
  isUrl?: boolean
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">Nothing to show for this period.</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-border border-b px-4 py-3">
          <p className="text-sm font-medium">{title}</p>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-border border-b text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{isUrl ? "Page" : "Query"}</th>
                <th className="px-4 py-2 text-right font-medium">Clicks</th>
                <th className="px-4 py-2 text-right font-medium">Impr.</th>
                <th className="px-4 py-2 text-right font-medium">CTR</th>
                <th className="px-4 py-2 text-right font-medium">Position</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-border/60 border-b last:border-0">
                  <td className="max-w-[380px] truncate px-4 py-2" title={r.key}>
                    {isUrl ? (
                      <a
                        href={r.key}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {r.key.replace(/^https?:\/\/[^/]+/, "") || "/"}
                      </a>
                    ) : (
                      r.key
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="inline-flex items-center gap-2">
                      {num(r.clicks)}
                      {r.prevClicks !== null && r.prevClicks !== r.clicks && (
                        <Delta change={r.clicks - r.prevClicks} changePct={null} />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">{num(r.impressions)}</td>
                  <td className="px-4 py-2 text-right">{pct(r.ctr)}</td>
                  <td className="px-4 py-2 text-right">{r.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

/** What the team is actually doing for this site - the answer to "the numbers
 *  moved, so what are we doing about it?" */
function SiteWork({ o }: { o: SeoOverview }) {
  if (o.tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm">
          <p className="font-medium">No open work for this site</p>
          <p className="text-muted-foreground text-xs">
            Create a task from the Tasks tab and set its <strong>Site</strong> to {o.config.label} —
            it will show up here.
          </p>
        </CardContent>
      </Card>
    )
  }
  const today = new Date().toISOString().slice(0, 10)
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-border border-b px-4 py-3">
          <p className="text-sm font-medium">Open work — {o.config.label}</p>
          <p className="text-muted-foreground text-xs">
            Tasks tagged to this site, soonest due first.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-border border-b text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Task</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Assignee</th>
                <th className="px-4 py-2 text-right font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {o.tasks.map((t) => {
                const late = !!t.dueDate && t.dueDate < today
                return (
                  <tr key={t.id} className="border-border/60 border-b last:border-0">
                    <td className="max-w-[380px] truncate px-4 py-2" title={t.title}>
                      {t.title}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs font-medium",
                          TASK_STATUS_COLORS[t.status] ?? "bg-muted",
                        )}
                      >
                        {TASK_STATUS_LABELS[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-2">
                      {t.assigneeName ?? "Unassigned"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right whitespace-nowrap",
                        late && "font-medium text-red-600",
                      )}
                    >
                      {t.dueDate ?? "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

/** Explains the one manual step Google requires: granting the service account. */
function SetupNotice({
  serviceAccount,
  configured,
}: {
  serviceAccount: string | null
  configured: boolean
}) {
  if (configured && serviceAccount) {
    return (
      <Card className="border-border">
        <CardContent className="p-4 text-sm">
          <p className="font-medium">Grant Search Console access</p>
          <p className="text-muted-foreground text-xs">
            In Search Console → Settings → Users and permissions, add this service account as a user
            (read access is enough) on <strong>every</strong> site you track:
          </p>
          <code className="bg-muted mt-2 inline-block rounded px-2 py-1 text-xs">
            {serviceAccount}
          </code>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="flex gap-2 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">Search Console credentials are not configured</p>
          <p className="text-muted-foreground text-xs">
            An admin needs to paste a service-account JSON under{" "}
            <strong>Admin → Integrations → Google Search Console</strong> (or configure Google
            Drive, which SEO falls back to). You can still add sites now; syncing works once the
            credentials exist.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
