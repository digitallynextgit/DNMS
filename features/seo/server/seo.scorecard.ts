import "server-only"

import { db } from "@/server/db"

// =============================================================================
// The monthly scorecard from the SEO plan, step 10.
//
// Ten weighted metrics, 100 points total. The hard part is honesty: several
// inputs (backlinks, crawl errors) have no free API, and GA4/CrUX may not be
// connected yet. Rather than scoring an unmeasured metric as 0 - which would
// make a healthy site look broken - each metric reports `available`, unavailable
// ones are excluded from BOTH the numerator and the denominator, and `coverage`
// records how much of the 100 points was actually measurable.
//
// A score of 82 at 55% coverage is a very different claim from 82 at 95%, and
// the UI shows both.
// =============================================================================

export type MetricKey =
  | "organicClicks"
  | "organicConversions"
  | "moneyPositions"
  | "queryCount"
  | "referringDomains"
  | "indexedPages"
  | "cwvGreen"
  | "crawlErrors"
  | "contentPublished"
  | "aiCitations"

export interface ScorecardMetric {
  key: MetricKey
  label: string
  weight: number
  /** False when we have no data source for it - excluded from the score. */
  available: boolean
  value: number | null
  previous: number | null
  /** 0..1 of this metric's weight that was earned. */
  ratio: number | null
  points: number
  /** Why it scored what it did, in plain words. */
  note: string
}

export interface Scorecard {
  propertyId: string
  period: { start: string; end: string }
  previousPeriod: { start: string; end: string }
  /** 0-100, normalised over the weight that could be measured. */
  score: number
  /** 0-100, share of the 100 points that was measurable. */
  coverage: number
  band: "HEALTHY" | "WATCH" | "INTERVENE" | "ESCALATE"
  metrics: ScorecardMetric[]
}

const WEIGHTS: Record<MetricKey, { weight: number; label: string }> = {
  organicClicks: { weight: 20, label: "Organic clicks (28d vs prev)" },
  organicConversions: { weight: 20, label: "Organic conversions" },
  moneyPositions: { weight: 15, label: "Money-query top-10s" },
  queryCount: { weight: 10, label: "Queries with impressions" },
  referringDomains: { weight: 10, label: "Referring domains (net new)" },
  indexedPages: { weight: 5, label: "Indexed vs published pages" },
  cwvGreen: { weight: 5, label: "CWV all-green % (money pages)" },
  crawlErrors: { weight: 5, label: "Critical crawl errors" },
  contentPublished: { weight: 5, label: "Content published vs planned" },
  aiCitations: { weight: 5, label: "AI citations + referral traffic" },
}

/** Plan step 10: 80+ healthy | 60-79 watch | 40-59 intervene | <40 escalate. */
export function bandFor(score: number): Scorecard["band"] {
  if (score >= 80) return "HEALTHY"
  if (score >= 60) return "WATCH"
  if (score >= 40) return "INTERVENE"
  return "ESCALATE"
}

/**
 * Growth metrics score on change, not absolute value: flat = 0.6 (holding
 * ground is not failure), +20% or better = full marks, -30% or worse = 0.
 */
function growthRatio(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 1 : 0.6
  const change = (current - previous) / previous
  if (change >= 0.2) return 1
  if (change <= -0.3) return 0
  // Piecewise-linear through (-0.3, 0), (0, 0.6), (0.2, 1).
  return change >= 0 ? 0.6 + (change / 0.2) * 0.4 : 0.6 * (1 + change / 0.3)
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10)
const asDate = (k: string) => new Date(`${k}T00:00:00.000Z`)

/** Sum the stored weekly snapshots covering a window. */
async function gscTotals(propertyId: string, start: string, end: string) {
  const rows = await db.seoSnapshot.findMany({
    where: { propertyId, periodEnd: { gte: asDate(start), lte: asDate(end) } },
    select: { id: true, clicks: true, impressions: true },
  })
  return {
    clicks: rows.reduce((a, r) => a + r.clicks, 0),
    impressions: rows.reduce((a, r) => a + r.impressions, 0),
    snapshotIds: rows.map((r) => r.id),
  }
}

/**
 * Build (and store) the scorecard for a 28-day window ending `endDate`.
 * 28 days rather than a calendar month so the comparison is like-for-like -
 * February vs January would otherwise punish a site for the calendar.
 */
export async function buildScorecard(
  propertyId: string,
  endDate = new Date(),
): Promise<Scorecard | null> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, projectId: true, moneyKeywords: true, moneyPages: true },
  })
  if (!property) return null

  const end = new Date(endDate)
  end.setUTCHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 27)
  const prevEnd = new Date(start)
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setUTCDate(prevStart.getUTCDate() - 27)

  const period = { start: dateKey(start), end: dateKey(end) }
  const previousPeriod = { start: dateKey(prevStart), end: dateKey(prevEnd) }

  const metrics: ScorecardMetric[] = []
  const add = (
    key: MetricKey,
    m: Partial<ScorecardMetric> & { available: boolean; note: string },
  ) => {
    const { weight, label } = WEIGHTS[key]
    const ratio = m.available ? (m.ratio ?? 0) : null
    metrics.push({
      key,
      label,
      weight,
      available: m.available,
      value: m.value ?? null,
      previous: m.previous ?? null,
      ratio,
      points: ratio === null ? 0 : Math.round(ratio * weight * 10) / 10,
      note: m.note,
    })
  }

  // ── 1. Organic clicks (GSC, 20) ────────────────────────────────────────────
  const cur = await gscTotals(property.id, period.start, period.end)
  const prev = await gscTotals(property.id, previousPeriod.start, previousPeriod.end)
  const hasGsc = cur.snapshotIds.length > 0
  add("organicClicks", {
    available: hasGsc,
    value: cur.clicks,
    previous: prev.clicks,
    ratio: growthRatio(cur.clicks, prev.clicks),
    note: hasGsc
      ? `${cur.clicks} vs ${prev.clicks} in the previous 28 days.`
      : "No Search Console snapshots in this window.",
  })

  // ── 2. Organic conversions (GA4, 20) ───────────────────────────────────────
  const [trafficNow, trafficPrev] = await Promise.all([
    db.seoTraffic.findFirst({
      where: { propertyId: property.id, periodEnd: { gte: asDate(period.start) } },
      orderBy: { periodEnd: "desc" },
      select: { conversions: true, sessions: true, aiReferrals: true },
    }),
    db.seoTraffic.findFirst({
      where: { propertyId: property.id, periodEnd: { lt: asDate(period.start) } },
      orderBy: { periodEnd: "desc" },
      select: { conversions: true, sessions: true, aiReferrals: true },
    }),
  ])
  add("organicConversions", {
    available: !!trafficNow,
    value: trafficNow?.conversions ?? null,
    previous: trafficPrev?.conversions ?? null,
    ratio: trafficNow ? growthRatio(trafficNow.conversions, trafficPrev?.conversions ?? 0) : null,
    note: trafficNow
      ? `${trafficNow.conversions} conversions from ${trafficNow.sessions} organic sessions.`
      : "GA4 not connected - add the GA4 property id and grant the service account.",
  })

  // ── 3. Money-query top-10s (GSC, 15) ───────────────────────────────────────
  if (hasGsc && property.moneyKeywords.length > 0) {
    const rows = await db.seoQueryStat.findMany({
      where: { snapshotId: { in: cur.snapshotIds } },
      select: { query: true, position: true },
    })
    // Best (lowest) position seen for each money keyword this window.
    let inTop10 = 0
    for (const kw of property.moneyKeywords) {
      const needle = kw.trim().toLowerCase()
      const best = rows
        .filter((r) => r.query.toLowerCase().includes(needle))
        .reduce<number | null>((a, r) => (a === null || r.position < a ? r.position : a), null)
      if (best !== null && best <= 10) inTop10++
    }
    add("moneyPositions", {
      available: true,
      value: inTop10,
      previous: null,
      ratio: inTop10 / property.moneyKeywords.length,
      note: `${inTop10} of ${property.moneyKeywords.length} money keywords rank in the top 10.`,
    })
  } else {
    add("moneyPositions", {
      available: false,
      note: hasGsc ? "No money keywords set for this site." : "No Search Console data.",
    })
  }

  // ── 4. Queries with impressions (GSC, 10) ──────────────────────────────────
  if (hasGsc) {
    const [nowCount, prevCount] = await Promise.all([
      db.seoQueryStat.count({ where: { snapshotId: { in: cur.snapshotIds } } }),
      db.seoQueryStat.count({ where: { snapshotId: { in: prev.snapshotIds } } }),
    ])
    add("queryCount", {
      available: true,
      value: nowCount,
      previous: prevCount,
      ratio: growthRatio(nowCount, prevCount),
      note: `${nowCount} distinct queries earning impressions (was ${prevCount}).`,
    })
  } else {
    add("queryCount", { available: false, note: "No Search Console data." })
  }

  // ── 5. Referring domains (10) - no free API ────────────────────────────────
  add("referringDomains", {
    available: false,
    note: "Ahrefs Webmaster Tools has no public API - import a backlink export to score this.",
  })

  // ── 6. Indexed vs published pages (GSC, 5) ─────────────────────────────────
  if (hasGsc) {
    const [nowPages, prevPages] = await Promise.all([
      db.seoPageStat.count({ where: { snapshotId: { in: cur.snapshotIds } } }),
      db.seoPageStat.count({ where: { snapshotId: { in: prev.snapshotIds } } }),
    ])
    add("indexedPages", {
      available: true,
      value: nowPages,
      previous: prevPages,
      ratio: growthRatio(nowPages, prevPages),
      note: `${nowPages} pages earning impressions (was ${prevPages}). A drop suggests an indexing problem.`,
    })
  } else {
    add("indexedPages", { available: false, note: "No Search Console data." })
  }

  // ── 7. CWV all-green on money pages (CrUX/PSI, 5) ──────────────────────────
  const vitals = await db.seoVitals.findMany({
    where: { propertyId: property.id, checkedAt: { gte: asDate(period.start) } },
    orderBy: { checkedAt: "desc" },
    select: { url: true, verdict: true, source: true, checkedAt: true },
  })
  // Latest row per URL only - a page checked weekly must not count four times.
  const latestByUrl = new Map<string, (typeof vitals)[number]>()
  for (const v of vitals) if (!latestByUrl.has(v.url)) latestByUrl.set(v.url, v)
  const checked = [...latestByUrl.values()].filter((v) => v.verdict)
  if (checked.length > 0) {
    const green = checked.filter((v) => v.verdict === "GOOD").length
    add("cwvGreen", {
      available: true,
      value: Math.round((green / checked.length) * 100),
      previous: null,
      ratio: green / checked.length,
      note: `${green} of ${checked.length} checked pages pass all Core Web Vitals.`,
    })
  } else {
    add("cwvGreen", {
      available: false,
      note: "No Core Web Vitals measured yet - run a vitals check.",
    })
  }

  // ── 8. Critical crawl errors (5) - needs the crawler (phase 2) ─────────────
  add("crawlErrors", {
    available: false,
    note: "Crawl checks are not built yet.",
  })

  // ── 9. Content published vs planned (content calendar, 5) ──────────────────
  const [planned, posted] = await Promise.all([
    db.contentCalendarEntry.count({
      where: {
        projectId: property.projectId,
        date: { gte: asDate(period.start), lte: asDate(period.end) },
      },
    }),
    db.contentCalendarEntry.count({
      where: {
        projectId: property.projectId,
        date: { gte: asDate(period.start), lte: asDate(period.end) },
        status: "POSTED",
      },
    }),
  ])
  add("contentPublished", {
    available: planned > 0,
    value: posted,
    previous: planned,
    ratio: planned > 0 ? Math.min(1, posted / planned) : null,
    note:
      planned > 0
        ? `${posted} of ${planned} planned posts published.`
        : "Nothing planned in the content calendar for this window.",
  })

  // ── 10. AI citations + referral traffic (GA4, 5) ───────────────────────────
  add("aiCitations", {
    available: !!trafficNow,
    value: trafficNow?.aiReferrals ?? null,
    previous: trafficPrev?.aiReferrals ?? null,
    ratio: trafficNow ? growthRatio(trafficNow.aiReferrals, trafficPrev?.aiReferrals ?? 0) : null,
    note: trafficNow
      ? `${trafficNow.aiReferrals} sessions referred by AI assistants.`
      : "GA4 not connected.",
  })

  // Normalise over measured weight only.
  const measured = metrics.filter((m) => m.available)
  const measuredWeight = measured.reduce((a, m) => a + m.weight, 0)
  const earned = measured.reduce((a, m) => a + m.points, 0)
  const score = measuredWeight > 0 ? Math.round((earned / measuredWeight) * 1000) / 10 : 0
  const coverage = Math.round(measuredWeight * 10) / 10

  const card: Scorecard = {
    propertyId: property.id,
    period,
    previousPeriod,
    score,
    coverage,
    band: bandFor(score),
    metrics,
  }

  await db.seoScorecard.upsert({
    where: {
      propertyId_periodStart_periodEnd: {
        propertyId: property.id,
        periodStart: asDate(period.start),
        periodEnd: asDate(period.end),
      },
    },
    create: {
      propertyId: property.id,
      periodStart: asDate(period.start),
      periodEnd: asDate(period.end),
      score,
      coverage,
      band: card.band,
      metrics: metrics as unknown as object,
    },
    update: { score, coverage, band: card.band, metrics: metrics as unknown as object },
  })

  return card
}
