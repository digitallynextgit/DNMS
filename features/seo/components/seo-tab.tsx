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
  Target,
  Trash2,
  CheckSquare,
  Gauge,
  FileText,
  Link2,
  Rocket,
  Layers,
  CalendarDays,
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parseDateString, toDateString } from "@/components/shared/date-field"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import {
  StatCardsSkeleton,
  TableSkeleton,
  ChartSkeleton,
} from "@/components/shared/loading-skeleton"
import { cn } from "@/lib/utils"
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_LABEL_STYLE } from "@/lib/chart-theme"
import type {
  SeoAlert,
  SeoOverview,
  SeoPropertySummary,
  SeoRollup,
  SeoRowStat,
  SetupField,
} from "../types"
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/constants"
import {
  useDeleteSeoSite,
  useSeoOverview,
  useSeoRollup,
  useSeoSetup,
  useSeoSites,
  useSyncAllSeo,
  useSyncSeoSite,
} from "../hooks/use-seo"
import { exportOverview, exportRollup } from "../lib/seo-export"
import { SiteFormDialog } from "./site-form-dialog"
import { SiteSettingsDialog } from "./site-settings-dialog"
import { ScorecardPanel } from "./scorecard-panel"
import { TechnicalPanel } from "./technical-panel"
import { KeywordBacklog } from "./keyword-backlog"
import { CompetitorPanel } from "./competitor-panel"
import { ContentBriefPanel } from "./content-brief-panel"
import { BacklinksPanel } from "./backlinks-panel"
import { MonitorStatus } from "./monitor-status"
import { SetupGuide } from "./setup-guide"
import { AiExplain, TabHeader } from "./seo-toolbar"

// =============================================================================
// SEO tab. A project can track MANY sites (KYG = 13 subdomains under one
// account), so the default view is the roll-up across all of them and each site
// drills down to its own full report.
// =============================================================================

const ALL = "__all__"
const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const num = (v: number) => v.toLocaleString("en-IN")

/**
 * Whether showing the domain next to the label tells you anything new. Most
 * sites are labelled after their host, so "Knowyourgenes.in" alongside
 * "www.knowyourgenes.in" is noise that pushed the real name out of the trigger.
 */
function domainAddsInfo(label: string, domain: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "")
  return norm(label) !== norm(domain)
}

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
  const [settingsFor, setSettingsFor] = useState<string | null>(null)
  /** When set, the settings dialog opens straight into this one field. */
  const [settingsField, setSettingsField] = useState<SetupField | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const syncAll = useSyncAllSeo(projectId)
  const removeSite = useDeleteSeoSite(projectId)

  const sites = data?.properties ?? []
  const gscConfigured = !!data?.gscConfigured
  // A site can vanish (deleted elsewhere) while it's selected - fall back rather
  // than querying an id that no longer exists.
  const current = sites.find((s) => s.id === selected) ?? null
  const activeId = current?.id ?? null

  if (isLoading)
    return (
      <div className="mt-4 space-y-4">
        <StatCardsSkeleton count={4} />
        <div className="border-border bg-card overflow-hidden rounded-sm border">
          <TableSkeleton rows={6} cols={5} />
        </div>
      </div>
    )

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
                  onClick: () => setFormOpen(true),
                }
              : undefined
          }
        />
        {canManage && (
          <SiteFormDialog
            projectId={projectId}
            open={formOpen}
            onOpenChange={setFormOpen}
            gscConfigured={gscConfigured}
          />
        )}
      </div>
    )
  }

  const settingsSite = settingsFor ? (sites.find((s) => s.id === settingsFor) ?? null) : null

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={setSelected}>
            {/* The trigger's default [&>span]:line-clamp-1 sets display:-webkit-box
                on the value span, which would break the flex row inside it. Swap it
                for flex + truncate so the label ellipsises cleanly instead. */}
            <SelectTrigger className="w-full min-w-0 sm:w-72 [&>span]:line-clamp-none [&>span]:flex [&>span]:min-w-0 [&>span]:overflow-hidden">
              {/* Children here override Radix's default of echoing the selected
                  item's markup, so the two-line options below can be richer than
                  what the single-line trigger shows. */}
              <SelectValue>
                {current ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{current.label}</span>
                    {domainAddsInfo(current.label, current.domain) && (
                      <span className="text-muted-foreground hidden truncate text-xs sm:inline">
                        {current.domain}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Layers className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    All sites ({sites.length})
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-w-[min(24rem,90vw)]">
              <SelectItem value={ALL}>
                <span className="flex items-center gap-2">
                  <Layers className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">All sites ({sites.length})</span>
                </span>
              </SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex min-w-0 items-start gap-2">
                    <Globe className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{s.label}</span>
                        {!s.isActive && (
                          <span className="text-muted-foreground bg-muted shrink-0 rounded-sm px-1 text-[10px]">
                            paused
                          </span>
                        )}
                      </span>
                      {domainAddsInfo(s.label, s.domain) && (
                        <span className="text-muted-foreground block truncate text-xs">
                          {s.domain}
                        </span>
                      )}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && !current.isActive && <Badge variant="outline">Paused</Badge>}
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add site
            </Button>
            {current ? (
              <SiteActions
                projectId={projectId}
                site={current.id}
                onEdit={() => {
                  setSettingsField(null)
                  setSettingsFor(current.id)
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
        <SiteReport
          projectId={projectId}
          propertyId={activeId}
          siteLabel={current?.label ?? ""}
          canManage={canManage}
          onEditSite={(field) => {
            if (!current) return
            setSettingsField(field ?? null)
            setSettingsFor(current.id)
          }}
        />
      )}

      {canManage && (
        <>
          <SiteFormDialog
            projectId={projectId}
            open={formOpen}
            onOpenChange={setFormOpen}
            gscConfigured={gscConfigured}
          />
          {settingsSite && (
            <SiteSettingsDialog
              projectId={projectId}
              site={settingsSite}
              initialField={settingsField}
              open={!!settingsFor}
              onOpenChange={(v) => {
                if (!v) {
                  setSettingsFor(null)
                  setSettingsField(null)
                }
              }}
            />
          )}
        </>
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
  if (isLoading)
    return (
      <div className="space-y-4">
        <StatCardsSkeleton count={4} />
        <div className="border-border bg-card overflow-hidden rounded-sm border">
          <TableSkeleton rows={5} cols={5} />
        </div>
      </div>
    )
  if (!r) return null

  const hasData = r.properties.some((p) => p.period)

  return (
    <div className="space-y-4">
      <TabHeader
        title="All sites"
        description={
          r.period
            ? `Week of ${r.period.start} → ${r.period.end}, combined across ${r.properties.length} site${r.properties.length > 1 ? "s" : ""}. Click a site below for its full report and setup.`
            : "Combined view. Click a site below for its full report and setup."
        }
        onExport={() => exportRollup(r)}
        exportDisabled={!hasData}
      />

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
                      <Globe className="text-muted-foreground h-3.5 w-3.5" />
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
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {p.period ? num(p.impressions.current) : "-"}
                  </td>
                  <td className="px-4 py-2 text-right">{p.period ? pct(p.ctr) : "-"}</td>
                  <td className="px-4 py-2 text-right">
                    {p.period ? p.position.current.toFixed(1) : "-"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {p.openTasks === 0 ? (
                      <span className="text-muted-foreground">-</span>
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

/**
 * Period controls for the whole site report. Search Console data is stored one
 * week per snapshot, so the choices are which stored week to end on and how many
 * of them to combine. Both are real stored windows rather than an arbitrary date
 * range, which keeps every number traceable to data we actually hold.
 */
function PeriodFilter({
  overview: o,
  periodEnd,
  weeks,
  loading,
  onPeriodEnd,
  onWeeks,
}: {
  overview: SeoOverview
  periodEnd: string | null
  weeks: number
  loading: boolean
  onPeriodEnd: (v: string | null) => void
  onWeeks: (v: number) => void
}) {
  const [open, setOpen] = useState(false)
  const periods = o.availablePeriods

  // Nothing to filter until at least one week is stored.
  if (periods.length === 0) return null

  // Never offer a span longer than the history we hold.
  const spanOptions = [1, 4, 12, 26].filter((w) => w === 1 || w <= periods.length)

  const newest = periods[0]!
  const oldest = periods[periods.length - 1]!
  const minDate = parseDateString(oldest.start)
  const maxDate = parseDateString(newest.end)

  const label = periodEnd && o.period ? formatRange(o.period.start, o.period.end) : "Latest week"

  return (
    <div className="flex items-center gap-2">
      {loading && <RefreshCw className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 justify-start text-xs font-normal"
            title={
              o.period
                ? `Showing ${formatRange(o.period.start, o.period.end)}${
                    o.previousPeriod
                      ? `, compared with ${formatRange(o.previousPeriod.start, o.previousPeriod.end)}`
                      : ", with no earlier window to compare against"
                  }`
                : "No data for this period"
            }
          >
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <div className="flex items-center justify-between gap-2 border-b p-2">
            <span className="text-xs font-medium">Pick any week</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                onPeriodEnd(null)
                onWeeks(1)
                setOpen(false)
              }}
            >
              Latest week
            </Button>
          </div>

          <Calendar
            mode="single"
            captionLayout="dropdown"
            startMonth={minDate}
            endMonth={maxDate}
            defaultMonth={parseDateString(o.period?.end ?? newest.end)}
            selected={parseDateString(o.period?.end ?? newest.end)}
            // Any day inside a stored week resolves server side to that week, so
            // only dates outside the stored range need blocking.
            disabled={(d) => (!!minDate && d < minDate) || (!!maxDate && d > maxDate)}
            onSelect={(d) => {
              if (!d) return
              onPeriodEnd(toDateString(d))
              setOpen(false)
            }}
          />

          {o.period && (
            <p className="text-muted-foreground border-t p-2 text-[11px]">
              {formatRange(o.period.start, o.period.end)}
              {o.previousPeriod
                ? ` vs ${formatRange(o.previousPeriod.start, o.previousPeriod.end)}`
                : " (nothing earlier to compare)"}
              {o.config.lastSyncedAt &&
                ` · synced ${new Date(o.config.lastSyncedAt).toLocaleDateString("en-IN")}`}
            </p>
          )}
        </PopoverContent>
      </Popover>

      <Select value={String(weeks)} onValueChange={(v) => onWeeks(Number(v))}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {spanOptions.map((w) => (
            <SelectItem key={w} value={String(w)}>
              {w === 1 ? "1 week" : `${w} weeks`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** "21 Jul to 27 Jul 2026", dropping the repeated year and month where possible. */
function formatRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`)
  const e = new Date(`${end}T00:00:00Z`)
  const day = (d: Date) => d.getUTCDate()
  const mon = (d: Date) => d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
  const yr = (d: Date) => d.getUTCFullYear()
  if (yr(s) !== yr(e)) return `${day(s)} ${mon(s)} ${yr(s)} to ${day(e)} ${mon(e)} ${yr(e)}`
  if (mon(s) !== mon(e)) return `${day(s)} ${mon(s)} to ${day(e)} ${mon(e)} ${yr(e)}`
  return `${day(s)} to ${day(e)} ${mon(e)} ${yr(e)}`
}

/** The tabs, grouped by the question each one answers. Ten flat tabs made it
 *  impossible to tell where anything lived; these seven each own a job, and the
 *  description under the heading says what that job is. */
const TABS = [
  { value: "start", label: "Start here", Icon: Rocket },
  { value: "performance", label: "Performance", Icon: Search },
  { value: "keywords", label: "Keywords", Icon: ListOrdered },
  { value: "content", label: "Content", Icon: FileText },
  { value: "health", label: "Health", Icon: Gauge },
  { value: "links", label: "Links", Icon: Link2 },
  { value: "work", label: "Work", Icon: CheckSquare },
] as const

function SiteReport({
  projectId,
  propertyId,
  siteLabel,
  canManage,
  onEditSite,
}: {
  projectId: string
  propertyId: string | null
  siteLabel: string
  canManage: boolean
  onEditSite: (field?: SetupField) => void
}) {
  // null end = the newest stored week. Both live here so every tab below reads
  // the same window.
  const [periodEnd, setPeriodEnd] = useState<string | null>(null)
  const [weeks, setWeeks] = useState(1)
  const {
    data: o,
    isLoading,
    isFetching,
  } = useSeoOverview(projectId, propertyId, {
    end: periodEnd,
    weeks,
  })
  const { data: setup } = useSeoSetup(projectId, propertyId)
  // Land on "Start here" until the essentials are configured, then on Performance.
  const [tab, setTab] = useState<string | null>(null)

  if (isLoading)
    return (
      <div className="space-y-4">
        <StatCardsSkeleton count={4} />
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    )
  if (!o) return null

  const needsSetup = !!setup && setup.nextStepId !== null
  const active = tab ?? (needsSetup ? "start" : "performance")

  return (
    <div className="space-y-4">
      <MonitorStatus projectId={projectId} propertyId={propertyId} canManage={canManage} />

      <Tabs value={active} onValueChange={setTab} className="space-y-4">
        {/* Tabs on the left, period filter on the right, sharing one row. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="flex-wrap">
            {TABS.map(({ value, label, Icon }) => (
              <TabsTrigger key={value} value={value} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" /> {label}
                {value === "start" && needsSetup && (
                  <span className="bg-primary text-primary-foreground ml-0.5 rounded-sm px-1.5 text-[10px] leading-4">
                    {setup!.total - setup!.completed}
                  </span>
                )}
                {value === "work" && o.tasks.length > 0 && (
                  <span className="bg-muted ml-0.5 rounded-sm px-1.5 text-[10px] leading-4">
                    {o.tasks.length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <PeriodFilter
            overview={o}
            periodEnd={periodEnd}
            weeks={weeks}
            loading={isFetching}
            onPeriodEnd={setPeriodEnd}
            onWeeks={setWeeks}
          />
        </div>

        {/* 1. Start here - the guided checklist */}
        <TabsContent value="start" className="space-y-4">
          <TabHeader
            title="Set this site up, step by step"
            description="Each step unlocks part of the report. Work top to bottom - the highlighted one is next."
          />
          <SetupGuide
            projectId={projectId}
            propertyId={propertyId}
            siteLabel={siteLabel}
            canManage={canManage}
            onEditSite={onEditSite}
            onGoToTab={setTab}
          />
        </TabsContent>

        {/* 2. Performance - is it growing? */}
        <TabsContent value="performance" className="space-y-4">
          <TabHeader
            title="Performance"
            description="Clicks, impressions and average position from Search Console, week over week."
            onExport={() => exportOverview(o)}
            exportDisabled={!o.period}
          >
            <AiExplain projectId={projectId} propertyId={propertyId} />
          </TabHeader>
          {needsSetup && (
            <SetupGuide
              compact
              projectId={projectId}
              propertyId={propertyId}
              siteLabel={siteLabel}
              canManage={canManage}
              onEditSite={onEditSite}
              onGoToTab={setTab}
            />
          )}
          <GrowthReport o={o} canManage={canManage} />
          <StatTable title="Top pages" rows={o.topPages} isUrl />
        </TabsContent>

        {/* 3. Keywords - what should we target? */}
        <TabsContent value="keywords" className="space-y-4">
          <TabHeader
            title="Keywords"
            description="The terms you're judged on, the ones nearly winning, and the scored backlog of what to write next."
          />
          <MoneyKeywords o={o} onEditSite={canManage ? () => onEditSite("keywords") : undefined} />
          <StatTable
            title="Striking distance (position 8 to 30)"
            hint="Already relevant to Google. On-page work here moves them onto page one fastest."
            rows={o.strikingDistance}
          />
          <KeywordBacklog
            projectId={projectId}
            propertyId={propertyId}
            siteLabel={siteLabel}
            canManage={canManage}
          />
        </TabsContent>

        {/* 4. Content - what do we write? */}
        <TabsContent value="content" className="space-y-4">
          <TabHeader
            title="Content"
            description="Briefs move a target query from outline → QA → published → measured after 30 days. Competitor gaps below are the raw ideas."
          />
          <ContentBriefPanel
            projectId={projectId}
            propertyId={propertyId}
            siteLabel={siteLabel}
            canManage={canManage}
          />
          <CompetitorPanel
            projectId={projectId}
            propertyId={propertyId}
            siteLabel={siteLabel}
            canManage={canManage}
            onEditSite={canManage ? () => onEditSite("competitors") : undefined}
          />
        </TabsContent>

        {/* 5. Health - is anything broken? */}
        <TabsContent value="health" className="space-y-4">
          <TabHeader
            title="Health"
            description="The weighted scorecard, Core Web Vitals, and the technical crawl of your money pages."
          />
          <ScorecardPanel
            projectId={projectId}
            propertyId={propertyId}
            siteLabel={siteLabel}
            canManage={canManage}
          />
          <TechnicalPanel
            projectId={projectId}
            propertyId={propertyId}
            siteLabel={siteLabel}
            canManage={canManage}
          />
        </TabsContent>

        {/* 6. Links - who links to us? */}
        <TabsContent value="links" className="space-y-4">
          <TabHeader
            title="Links"
            description="Referring domains from your imported backlink exports. Re-import monthly to see what you gained and lost."
          />
          <BacklinksPanel
            projectId={projectId}
            propertyId={propertyId}
            siteLabel={siteLabel}
            canManage={canManage}
          />
        </TabsContent>

        {/* 7. Work - what is the team doing? */}
        <TabsContent value="work" className="space-y-4">
          <TabHeader
            title="Work"
            description="Tasks tagged to this site. Create one from the project's Tasks tab and set its Site field."
          />
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
                  {/* No itemStyle: the row colours ARE the key here (teal =
                      clicks, grey = impressions), and a flat foreground would
                      erase the only thing telling the two lines apart. */}
                  <ReTooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
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

function MoneyKeywords({ o, onEditSite }: { o: SeoOverview; onEditSite?: () => void }) {
  if (o.moneyKeywords.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div>
            <p className="font-medium">No money keywords set</p>
            <p className="text-muted-foreground text-xs">
              Add the terms this site must win - they get tracked every week and alert you when they
              slip off page one. The Start here tab can suggest them with AI.
            </p>
          </div>
          {onEditSite && (
            <Button size="sm" variant="outline" onClick={onEditSite}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Add keywords
            </Button>
          )}
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
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{k.tracked ? num(k.clicks) : "-"}</td>
                  <td className="px-4 py-2 text-right">{k.tracked ? num(k.impressions) : "-"}</td>
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
            Create a task from the Tasks tab and set its <strong>Site</strong> to {o.config.label} -
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
          <p className="text-sm font-medium">Open work - {o.config.label}</p>
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
                          "rounded-sm px-1.5 py-0.5 text-xs font-medium",
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
                      {t.dueDate ?? "-"}
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
          <code className="bg-muted mt-2 inline-block rounded-sm px-2 py-1 text-xs">
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
