import "server-only"

import { db } from "@/server/db"
import type {
  SeoAlert,
  SeoConfig,
  SeoDelta,
  SeoOverview,
  SeoPropertySummary,
  SeoRollup,
  SeoRowStat,
  SeoSiteTask,
} from "../types"
import { resolveSiteUrl } from "./seo.service"

// =============================================================================
// Reads for the SEO tab. Everything here is computed from stored snapshots -
// no Search Console calls - so the page loads instantly and stays inside quota.
// =============================================================================

// Work that still needs doing. DONE/DISCARDED are finished either way.
const OPEN_TASK_STATUSES = ["TODO", "IN_PROGRESS", "ON_HOLD"] as const
const SITE_TASKS = 15

const TREND_SNAPSHOTS = 12
// Upper bound on how much history the picker offers (about 18 months).
const MAX_SNAPSHOTS = 80
const TOP_ROWS = 20
const STRIKING_ROWS = 15

type PropertyRow = {
  id: string
  projectId: string
  label: string
  isPrimary: boolean
  domain: string
  siteUrl: string | null
  gaPropertyId: string | null
  moneyKeywords: string[]
  moneyPages: string[]
  competitors: string[]
  targetClicks: number | null
  targetPosition: number | null
  isActive: boolean
  lastSyncedAt: Date | null
  lastSyncError: string | null
}

export function serializeConfig(p: PropertyRow): SeoConfig {
  return {
    id: p.id,
    projectId: p.projectId,
    label: p.label,
    isPrimary: p.isPrimary,
    domain: p.domain,
    siteUrl: p.siteUrl,
    gaPropertyId: p.gaPropertyId,
    moneyKeywords: p.moneyKeywords,
    moneyPages: p.moneyPages,
    competitors: p.competitors,
    targetClicks: p.targetClicks,
    targetPosition: p.targetPosition,
    isActive: p.isActive,
    lastSyncedAt: p.lastSyncedAt ? p.lastSyncedAt.toISOString() : null,
    lastSyncError: p.lastSyncError,
  }
}

const CONFIG_SELECT = {
  id: true,
  projectId: true,
  label: true,
  isPrimary: true,
  domain: true,
  siteUrl: true,
  gaPropertyId: true,
  moneyKeywords: true,
  moneyPages: true,
  competitors: true,
  targetClicks: true,
  targetPosition: true,
  isActive: true,
  lastSyncedAt: true,
  lastSyncError: true,
} as const

/** Every site tracked under a project, primary first. */
export async function getSeoProperties(projectId: string): Promise<SeoConfig[]> {
  const rows = await db.seoProperty.findMany({
    where: { projectId },
    select: CONFIG_SELECT,
    orderBy: [{ isPrimary: "desc" }, { label: "asc" }],
  })
  return rows.map(serializeConfig)
}

export async function getSeoConfig(propertyId: string): Promise<SeoConfig | null> {
  const p = await db.seoProperty.findUnique({ where: { id: propertyId }, select: CONFIG_SELECT })
  return p ? serializeConfig(p) : null
}

/**
 * `lowerIsBetter` flips the sign so a *falling* average position (rank 12 -> 8)
 * reads as positive growth in the UI.
 *
 * `comparable` must be false when no previous snapshot exists, so callers can
 * hide the change instead of reporting a swing against an implied zero.
 */
function delta(
  current: number,
  previous: number,
  lowerIsBetter = false,
  comparable = true,
): SeoDelta {
  if (!comparable) {
    return { current, previous: 0, change: 0, changePct: null, comparable: false }
  }
  const raw = current - previous
  const change = lowerIsBetter ? -raw : raw
  const changePct = previous === 0 ? null : (change / Math.abs(previous)) * 100
  return { current, previous, change, changePct, comparable: true }
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10)

/** Which window the report should describe. Defaults to the latest single week. */
export interface OverviewOptions {
  /** Show the window ending on or before this ISO date (YYYY-MM-DD). */
  endDate?: string | null
  /** How many stored weeks to combine. 1 is a single week. */
  weeks?: number
}

type SnapshotRow = {
  id: string
  periodStart: Date
  periodEnd: Date
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/**
 * Combine several weekly snapshots into one set of totals.
 *
 * CTR is recomputed as clicks over impressions rather than averaged, and position
 * is weighted by impressions. Averaging either across weeks is a classic
 * reporting bug: a week with 3 impressions would swing the number as hard as a
 * week with 3,000.
 */
function combineSnapshots(rows: SnapshotRow[]) {
  const clicks = rows.reduce((a, r) => a + r.clicks, 0)
  const impressions = rows.reduce((a, r) => a + r.impressions, 0)
  const weightedPosition = rows.reduce((a, r) => a + r.position * r.impressions, 0)
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position:
      impressions > 0
        ? weightedPosition / impressions
        : rows.length
          ? rows.reduce((a, r) => a + r.position, 0) / rows.length
          : 0,
  }
}

/** Roll per-key stats (queries or pages) up across several snapshots. */
function combineRows<T extends { clicks: number; impressions: number; position: number }>(
  rows: (T & { key: string })[],
) {
  const map = new Map<
    string,
    {
      key: string
      clicks: number
      impressions: number
      weighted: number
      posSum: number
      n: number
    }
  >()
  for (const r of rows) {
    const cur = map.get(r.key)
    if (cur) {
      cur.clicks += r.clicks
      cur.impressions += r.impressions
      cur.weighted += r.position * r.impressions
      cur.posSum += r.position
      cur.n += 1
    } else {
      map.set(r.key, {
        key: r.key,
        clicks: r.clicks,
        impressions: r.impressions,
        weighted: r.position * r.impressions,
        posSum: r.position,
        n: 1,
      })
    }
  }
  return [...map.values()].map((v) => ({
    key: v.key,
    clicks: v.clicks,
    impressions: v.impressions,
    ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
    position: v.impressions > 0 ? v.weighted / v.impressions : v.posSum / v.n,
  }))
}

export async function getSeoOverview(
  propertyId: string,
  opts: OverviewOptions = {},
): Promise<SeoOverview | null> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: CONFIG_SELECT,
  })
  if (!property) return null

  const config = serializeConfig(property)

  const openTasks = await db.projectTask.findMany({
    where: { seoPropertyId: propertyId, status: { in: [...OPEN_TASK_STATUSES] } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: SITE_TASKS,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      assignee: { select: { firstName: true, lastName: true } },
    },
  })
  const tasks: SeoSiteTask[] = openTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? dateKey(t.dueDate) : null,
    assigneeName: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : null,
  }))

  const weeks = Math.max(1, Math.min(52, Math.trunc(opts.weeks ?? 1)))

  // Every stored week, newest first. The picker needs the full list, and the
  // comparison window may sit outside the trend chart's range.
  const [snapshots, snapshotCount] = await Promise.all([
    db.seoSnapshot.findMany({
      where: { propertyId: property.id },
      orderBy: { periodEnd: "desc" },
      take: MAX_SNAPSHOTS,
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        clicks: true,
        impressions: true,
        ctr: true,
        position: true,
      },
    }),
    db.seoSnapshot.count({ where: { propertyId: property.id } }),
  ])

  const availablePeriods = snapshots.map((s) => ({
    start: dateKey(s.periodStart),
    end: dateKey(s.periodEnd),
  }))

  const empty: SeoOverview = {
    config,
    period: null,
    previousPeriod: null,
    clicks: delta(0, 0, false, false),
    impressions: delta(0, 0, false, false),
    ctr: delta(0, 0, false, false),
    position: delta(0, 0, true, false),
    topQueries: [],
    topPages: [],
    moneyKeywords: [],
    strikingDistance: [],
    trend: [],
    alerts: [],
    snapshotCount,
    tasks,
    availablePeriods,
    weeks,
  }
  if (snapshots.length === 0) {
    empty.alerts = buildAlerts(empty)
    return empty
  }

  // Anchor the window. With no endDate this is the newest stored week; with one
  // it is the newest week ending on or before that date, so a date picked
  // mid-week still resolves to real stored data instead of nothing.
  const anchorIndex = opts.endDate
    ? snapshots.findIndex((s) => dateKey(s.periodEnd) <= opts.endDate!)
    : 0
  if (anchorIndex === -1) {
    // The requested date predates every stored snapshot.
    empty.alerts = buildAlerts(empty)
    return empty
  }

  // The chosen window, then the equally sized window immediately before it.
  const current = snapshots.slice(anchorIndex, anchorIndex + weeks)
  const previous = snapshots.slice(anchorIndex + weeks, anchorIndex + weeks * 2)
  const latest = current[0]!
  const oldestInWindow = current[current.length - 1]!

  const cur = combineSnapshots(current)
  const pre = combineSnapshots(previous)
  // Only claim a comparison when the previous window holds the same number of
  // weeks. Comparing four weeks against one would invent growth.
  const comparable = previous.length === weeks

  const currentIds = current.map((s) => s.id)
  const previousIds = previous.map((s) => s.id)

  const [rawQueries, rawPages, rawPrevQueries, rawPrevPages] = await Promise.all([
    db.seoQueryStat.findMany({
      where: { snapshotId: { in: currentIds } },
      select: { query: true, clicks: true, impressions: true, ctr: true, position: true },
    }),
    db.seoPageStat.findMany({
      where: { snapshotId: { in: currentIds } },
      select: { page: true, clicks: true, impressions: true, ctr: true, position: true },
    }),
    previousIds.length
      ? db.seoQueryStat.findMany({
          where: { snapshotId: { in: previousIds } },
          select: { query: true, clicks: true, impressions: true, position: true },
        })
      : Promise.resolve([]),
    previousIds.length
      ? db.seoPageStat.findMany({
          where: { snapshotId: { in: previousIds } },
          select: { page: true, clicks: true, impressions: true, position: true },
        })
      : Promise.resolve([]),
  ])

  // Roll each key up across the weeks in the window.
  const latestQueries = combineRows(rawQueries.map((r) => ({ ...r, key: r.query }))).sort(
    (a, b) => b.clicks - a.clicks || b.impressions - a.impressions,
  )
  const latestPages = combineRows(rawPages.map((r) => ({ ...r, key: r.page })))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, TOP_ROWS)
  const prevQueries = combineRows(rawPrevQueries.map((r) => ({ ...r, key: r.query })))
  const prevPages = combineRows(rawPrevPages.map((r) => ({ ...r, key: r.page })))

  const prevQueryMap = new Map(prevQueries.map((r) => [r.key, r]))
  const prevPageMap = new Map(prevPages.map((r) => [r.key, r]))

  const toRow = (
    key: string,
    r: { clicks: number; impressions: number; ctr: number; position: number },
    p?: { clicks: number; position: number },
  ): SeoRowStat => ({
    key,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
    prevClicks: p ? p.clicks : null,
    prevPosition: p ? p.position : null,
  })

  const allQueryRows = latestQueries.map((r) => toRow(r.key, r, prevQueryMap.get(r.key)))

  const topQueries = allQueryRows.slice(0, TOP_ROWS)
  const topPages = latestPages.map((r) => toRow(r.key, r, prevPageMap.get(r.key)))

  // Money keywords: exact match first, then a contains-match, so "seo agency
  // delhi" still resolves when GSC reports "best seo agency delhi".
  const byExact = new Map(allQueryRows.map((r) => [r.key.toLowerCase(), r]))
  const moneyKeywords = property.moneyKeywords.map((kw) => {
    const needle = kw.trim().toLowerCase()
    const hit =
      byExact.get(needle) ?? allQueryRows.find((r) => r.key.toLowerCase().includes(needle))
    if (hit) return { ...hit, key: kw, tracked: true }
    return {
      key: kw,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      prevClicks: null,
      prevPosition: null,
      tracked: false,
    }
  })

  // Positions 8-30 with real impressions: already relevant to Google, close
  // enough that on-page work can move them onto page one.
  const strikingDistance = allQueryRows
    .filter((r) => r.position >= 8 && r.position <= 30 && r.impressions >= 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, STRIKING_ROWS)

  const overview: SeoOverview = {
    config,
    period: { start: dateKey(oldestInWindow.periodStart), end: dateKey(latest.periodEnd) },
    previousPeriod: previous.length
      ? {
          start: dateKey(previous[previous.length - 1]!.periodStart),
          end: dateKey(previous[0]!.periodEnd),
        }
      : null,
    clicks: delta(cur.clicks, pre.clicks, false, comparable),
    impressions: delta(cur.impressions, pre.impressions, false, comparable),
    ctr: delta(cur.ctr, pre.ctr, false, comparable),
    position: delta(cur.position, pre.position, true, comparable),
    topQueries,
    topPages,
    moneyKeywords,
    strikingDistance,
    trend: snapshots
      .slice(0, TREND_SNAPSHOTS)
      .reverse()
      .map((s) => ({
        periodEnd: dateKey(s.periodEnd),
        clicks: s.clicks,
        impressions: s.impressions,
        position: s.position,
      })),
    alerts: [],
    snapshotCount,
    tasks,
    availablePeriods,
    weeks,
  }
  overview.alerts = buildAlerts(overview, {
    latestPageCount: latestPages.length,
    prevPageCount: prevPages.length,
  })
  return overview
}

/**
 * Every site on a project plus the combined numbers - the view that makes an
 * account like KYG (13 subdomains) readable at a glance.
 *
 * Deliberately totals-only: it reads the latest two snapshots per site and never
 * touches the per-query tables, so 13 sites cost 13 small reads instead of
 * thousands of keyword rows. Keyword-level alerts live in each site's own
 * overview (and still fire from the weekly cron).
 */
export async function getSeoRollup(projectId: string): Promise<SeoRollup> {
  const properties = await db.seoProperty.findMany({
    where: { projectId },
    select: CONFIG_SELECT,
    orderBy: [{ isPrimary: "desc" }, { label: "asc" }],
  })

  // Two grouped counts for the whole project rather than 2 queries per site.
  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)
  const [openByProp, overdueByProp] = await Promise.all([
    db.projectTask.groupBy({
      by: ["seoPropertyId"],
      where: { projectId, seoPropertyId: { not: null }, status: { in: [...OPEN_TASK_STATUSES] } },
      _count: { _all: true },
    }),
    db.projectTask.groupBy({
      by: ["seoPropertyId"],
      where: {
        projectId,
        seoPropertyId: { not: null },
        status: { in: [...OPEN_TASK_STATUSES] },
        dueDate: { lt: todayUtc },
      },
      _count: { _all: true },
    }),
  ])
  const openCount = new Map(openByProp.map((r) => [r.seoPropertyId, r._count._all]))
  const overdueCount = new Map(overdueByProp.map((r) => [r.seoPropertyId, r._count._all]))

  const summaries: SeoPropertySummary[] = []
  const alerts: SeoRollup["alerts"] = []

  // Fetch snapshots for ALL properties in ONE query and keep the latest two per
  // property in JS (PERF-09) - previously this was a snapshot query per property.
  // The @@index([propertyId, periodEnd]) backs this ordering.
  const allSnaps = await db.seoSnapshot.findMany({
    where: { propertyId: { in: properties.map((p) => p.id) } },
    orderBy: { periodEnd: "desc" },
    select: {
      propertyId: true,
      periodStart: true,
      periodEnd: true,
      clicks: true,
      impressions: true,
      ctr: true,
      position: true,
    },
  })
  const snapsByProp = new Map<string, typeof allSnaps>()
  for (const s of allSnaps) {
    const list = snapsByProp.get(s.propertyId)
    if (list) {
      if (list.length < 2) list.push(s)
    } else {
      snapsByProp.set(s.propertyId, [s])
    }
  }

  for (const p of properties) {
    const snaps = snapsByProp.get(p.id) ?? []
    const latest = snaps[0] ?? null
    const prev = snaps[1] ?? null
    const config = serializeConfig(p)

    const summary: SeoPropertySummary = {
      id: p.id,
      label: p.label,
      domain: p.domain,
      isPrimary: p.isPrimary,
      isActive: p.isActive,
      lastSyncedAt: config.lastSyncedAt,
      lastSyncError: config.lastSyncError,
      period: latest
        ? { start: dateKey(latest.periodStart), end: dateKey(latest.periodEnd) }
        : null,
      clicks: delta(latest?.clicks ?? 0, prev?.clicks ?? 0, false, !!prev),
      impressions: delta(latest?.impressions ?? 0, prev?.impressions ?? 0, false, !!prev),
      position: delta(latest?.position ?? 0, prev?.position ?? 0, true, !!prev),
      ctr: latest?.ctr ?? 0,
      alerts: [],
      openTasks: openCount.get(p.id) ?? 0,
      overdueTasks: overdueCount.get(p.id) ?? 0,
    }

    // Reuse the same rule engine the per-site view uses. Money keywords are left
    // empty on purpose here - those alerts need query rows we didn't fetch.
    summary.alerts = buildAlerts({
      config,
      period: summary.period,
      previousPeriod: prev
        ? { start: dateKey(prev.periodStart), end: dateKey(prev.periodEnd) }
        : null,
      clicks: summary.clicks,
      impressions: summary.impressions,
      ctr: delta(summary.ctr, prev?.ctr ?? 0),
      position: summary.position,
      topQueries: [],
      topPages: [],
      moneyKeywords: [],
      strikingDistance: [],
      trend: [],
      alerts: [],
      snapshotCount: snaps.length,
      tasks: [],
      // The roll-up only needs the alert rules, not a period picker.
      availablePeriods: [],
      weeks: 1,
    })

    for (const a of summary.alerts) {
      if (a.level === "info") continue
      alerts.push({ ...a, property: p.label, propertyId: p.id })
    }
    summaries.push(summary)
  }

  const withData = summaries.filter((s) => s.period)
  const sum = (pick: (s: SeoPropertySummary) => number) =>
    summaries.reduce((acc, s) => acc + pick(s), 0)

  // Impression-weighted so a low-traffic subdomain can't drag the account's
  // average position around.
  const weighted = (cur: boolean) => {
    const totalImpr = sum((s) => (cur ? s.impressions.current : s.impressions.previous))
    if (totalImpr === 0) return 0
    return (
      summaries.reduce(
        (acc, s) =>
          acc +
          (cur ? s.position.current : s.position.previous) *
            (cur ? s.impressions.current : s.impressions.previous),
        0,
      ) / totalImpr
    )
  }

  // The account total is comparable as soon as ANY site has a prior week.
  const anyComparable = summaries.some((s) => s.clicks.comparable)
  const clicks = delta(
    sum((s) => s.clicks.current),
    sum((s) => s.clicks.previous),
    false,
    anyComparable,
  )
  const impressions = delta(
    sum((s) => s.impressions.current),
    sum((s) => s.impressions.previous),
    false,
    anyComparable,
  )

  // Newest window across the sites - they can be a day apart if one synced late.
  const period =
    withData.length > 0
      ? withData.map((s) => s.period!).reduce((a, b) => (b.end > a.end ? b : a))
      : null

  const order = { critical: 0, warning: 1, info: 2 } as const
  alerts.sort((a, b) => order[a.level] - order[b.level])

  return {
    projectId,
    properties: summaries,
    totals: {
      clicks,
      impressions,
      position: delta(weighted(true), weighted(false), true, anyComparable),
      ctr: impressions.current > 0 ? clicks.current / impressions.current : 0,
    },
    alerts,
    period,
  }
}

/**
 * The monitoring rules from the SEO plan, evaluated against stored snapshots.
 * Only rules we can honestly evaluate from Search Console data live here -
 * Core Web Vitals and noindex checks need PSI/crawl data and are not faked.
 */
export function buildAlerts(
  o: SeoOverview,
  counts?: { latestPageCount: number; prevPageCount: number },
): SeoAlert[] {
  const alerts: SeoAlert[] = []

  if (o.config.lastSyncError) {
    alerts.push({
      level: "critical",
      title: "Last sync failed",
      detail: o.config.lastSyncError,
    })
  }

  if (!o.period) {
    alerts.push({
      level: "info",
      title: "No data yet",
      detail: "Run a sync to pull this property's Search Console history.",
    })
    return alerts
  }

  // Growth rules only make sense with a real comparison period.
  if (o.previousPeriod) {
    if (o.clicks.changePct !== null && o.clicks.changePct <= -30) {
      alerts.push({
        level: "critical",
        title: `Clicks down ${Math.abs(o.clicks.changePct).toFixed(0)}%`,
        detail: `${o.clicks.previous} → ${o.clicks.current} clicks week over week. Check for lost rankings, deindexing or a site change.`,
      })
    }
    if (o.position.previous > 0 && o.position.current - o.position.previous >= 5) {
      alerts.push({
        level: "warning",
        title: "Average position dropped",
        detail: `Avg position moved from ${o.position.previous.toFixed(1)} to ${o.position.current.toFixed(1)}.`,
      })
    }
    if (counts && counts.prevPageCount > 0) {
      const drop = ((counts.prevPageCount - counts.latestPageCount) / counts.prevPageCount) * 100
      if (drop >= 10) {
        alerts.push({
          level: "warning",
          title: `Ranking pages down ${drop.toFixed(0)}%`,
          detail: `${counts.prevPageCount} → ${counts.latestPageCount} pages earning impressions. Possible indexing problem.`,
        })
      }
    }
  }

  const slipped = o.moneyKeywords.filter(
    (k) => k.tracked && k.prevPosition !== null && k.prevPosition <= 10 && k.position > 10,
  )
  for (const k of slipped) {
    alerts.push({
      level: "warning",
      title: `"${k.key}" fell off page one`,
      detail: `Position ${k.prevPosition!.toFixed(1)} → ${k.position.toFixed(1)}.`,
    })
  }

  const missing = o.moneyKeywords.filter((k) => !k.tracked)
  if (missing.length) {
    alerts.push({
      level: "info",
      title: `${missing.length} money keyword${missing.length > 1 ? "s" : ""} not ranking`,
      detail: `No Search Console impressions for: ${missing
        .slice(0, 5)
        .map((k) => k.key)
        .join(", ")}${missing.length > 5 ? "…" : ""}. These need content.`,
    })
  }

  if (o.config.targetClicks && o.config.targetClicks > 0) {
    // Weekly snapshot vs a monthly goal - compare like for like.
    const monthlyPace = o.clicks.current * (30 / 7)
    const pct = (monthlyPace / o.config.targetClicks) * 100
    if (pct < 70) {
      alerts.push({
        level: "warning",
        title: `Behind the click target (${pct.toFixed(0)}%)`,
        detail: `Current pace is ~${Math.round(monthlyPace)} clicks/month against a target of ${o.config.targetClicks}.`,
      })
    }
  }

  return alerts
}

/**
 * Is this site already tracked on the project?
 *
 * Compares the SEARCH CONSOLE PROPERTY, not the typed domain. "knowyourgenes.in"
 * and "www.knowyourgenes.in" are different strings but resolve to the same
 * `sc-domain:knowyourgenes.in`, so a domain-only check let the same site be
 * added twice - which then double-counts in the rollup and spends the GSC quota
 * syncing one property twice.
 *
 * `excludeId` lets an edit save itself without colliding with its own row.
 */
export async function findConflictingProperty(
  projectId: string,
  input: { domain: string; siteUrl: string | null },
  excludeId?: string,
): Promise<{ id: string; label: string; domain: string } | null> {
  const rows = await db.seoProperty.findMany({
    where: { projectId, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, label: true, domain: true, siteUrl: true },
  })

  const wanted = resolveSiteUrl(input)
  return rows.find((r) => r.domain === input.domain || resolveSiteUrl(r) === wanted) ?? null
}
