import "server-only"

import { db } from "@/server/db"
import { fetchVitals, type FormFactor } from "@/lib/psi"
import { fetchOrganicTraffic } from "@/lib/ga4"
import { lastCompleteWindow } from "@/lib/gsc"

// =============================================================================
// Core Web Vitals + GA4 collection for a tracked site.
// Both write into the store the scorecard reads; neither ever throws for a
// single bad URL, since one unreachable page must not abort a whole run.
// =============================================================================

const MAX_PAGES = 10 // the plan's "5-10 money pages"

/**
 * How long a reading stays fresh enough to reuse.
 *
 * CrUX field data is a 28-day rolling average that Google refreshes once a day,
 * so measuring the same URL more often than this spends quota to learn nothing.
 * The weekly job uses the long window; an operator who clicked "measure now"
 * gets the short one, which still absorbs a double-click.
 */
const FRESH_MS = { scheduled: 20 * 60 * 60 * 1000, manual: 15 * 60 * 1000 } as const

// PSI allows 240 calls/minute with a key. Spacing calls keeps a multi-site run
// clear of the burst limit instead of relying on the retry inside lib/psi.
const GAP_MS = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Which URLs to measure: the configured money pages, else the top pages by
 * clicks from the most recent snapshot (so a site with no config still gets
 * something useful), else the site root.
 */
export async function resolveMoneyPages(propertyId: string): Promise<string[]> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { domain: true, moneyPages: true },
  })
  if (!property) return []
  if (property.moneyPages.length > 0) return property.moneyPages.slice(0, MAX_PAGES)

  const latest = await db.seoSnapshot.findFirst({
    where: { propertyId },
    orderBy: { periodEnd: "desc" },
    select: { id: true },
  })
  if (latest) {
    const pages = await db.seoPageStat.findMany({
      where: { snapshotId: latest.id },
      orderBy: { clicks: "desc" },
      take: MAX_PAGES,
      select: { page: true },
    })
    if (pages.length > 0) return pages.map((p) => p.page)
  }
  return [`https://${property.domain.replace(/^https?:\/\//, "")}/`]
}

export interface VitalsRunResult {
  propertyId: string
  checked: number
  failed: number
  green: number
  /** URLs whose last reading was still fresh, so no call was spent on them. */
  skipped: number
  /**
   * Set when the run stopped early because PSI refused us (quota gone, or the
   * key is missing/rejected). Distinguishing this from `failed` matters: the
   * pages are fine, the API is not, and the UI must say so rather than claim
   * every money page is unreachable.
   */
  quotaError?: string
  urls: { url: string; verdict: string | null; source: string }[]
}

/** Measure Core Web Vitals for a site's money pages. */
export async function runVitalsCheck(
  propertyId: string,
  formFactor: FormFactor = "MOBILE",
  opts: { trigger?: "scheduled" | "manual" } = {},
): Promise<VitalsRunResult> {
  const urls = await resolveMoneyPages(propertyId)
  const out: VitalsRunResult = {
    propertyId,
    checked: 0,
    failed: 0,
    green: 0,
    skipped: 0,
    urls: [],
  }
  if (urls.length === 0) return out

  // Reuse readings Google has not refreshed yet - one query for the whole page
  // set rather than a round trip per URL.
  const freshSince = new Date(Date.now() - FRESH_MS[opts.trigger ?? "scheduled"])
  const fresh = await db.seoVitals.findMany({
    where: { propertyId, formFactor, url: { in: urls }, checkedAt: { gte: freshSince } },
    select: { url: true },
    distinct: ["url"],
  })
  const isFresh = new Set(fresh.map((r) => r.url))

  // Sequential: PSI is slow (a real Lighthouse run) and rate-limits hard when
  // hit in parallel.
  let first = true
  for (const url of urls) {
    if (isFresh.has(url)) {
      out.skipped++
      continue
    }
    if (!first) await sleep(GAP_MS)
    first = false

    const res = await fetchVitals(url, formFactor)
    if (!res.ok) {
      // A quota refusal is not this page's fault and will not clear by trying
      // the next one - stop, and let the caller report why.
      if (res.reason === "QUOTA") {
        out.quotaError = res.message
        console.error("[psi] run aborted:", res.message)
        break
      }
      out.failed++
      console.warn("[psi] unmeasurable", url, res.message)
      continue
    }

    const v = res.vitals
    await db.seoVitals.create({
      data: {
        propertyId,
        url: v.url,
        formFactor: v.formFactor,
        source: v.source,
        lcpMs: v.lcpMs,
        inpMs: v.inpMs,
        cls: v.cls,
        fcpMs: v.fcpMs,
        ttfbMs: v.ttfbMs,
        performanceScore: v.performanceScore,
        verdict: v.verdict,
      },
    })
    out.checked++
    if (v.verdict === "GOOD") out.green++
    out.urls.push({ url: v.url, verdict: v.verdict, source: v.source })
  }
  return out
}

export interface TrafficRunResult {
  ok: boolean
  propertyId: string
  period?: { start: string; end: string }
  sessions?: number
  conversions?: number
  error?: string
}

/**
 * Pull the last complete 28 days of organic traffic from GA4. Skipped (not
 * failed) when the site has no GA4 property id configured.
 */
export async function runTrafficSync(propertyId: string): Promise<TrafficRunResult> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, gaPropertyId: true },
  })
  if (!property) return { ok: false, propertyId, error: "Property not found" }
  if (!property.gaPropertyId) {
    return { ok: false, propertyId, error: "No GA4 property id set for this site" }
  }

  // Same 28-day window the scorecard uses, on the same Search Console lag so the
  // two halves of the report describe the same days.
  const period = lastCompleteWindow(28)

  try {
    const t = await fetchOrganicTraffic({
      propertyId: property.gaPropertyId,
      startDate: period.start,
      endDate: period.end,
    })
    await db.seoTraffic.upsert({
      where: {
        propertyId_periodStart_periodEnd: {
          propertyId: property.id,
          periodStart: new Date(`${period.start}T00:00:00.000Z`),
          periodEnd: new Date(`${period.end}T00:00:00.000Z`),
        },
      },
      create: {
        propertyId: property.id,
        periodStart: new Date(`${period.start}T00:00:00.000Z`),
        periodEnd: new Date(`${period.end}T00:00:00.000Z`),
        ...t,
      },
      update: t,
    })
    return {
      ok: true,
      propertyId: property.id,
      period,
      sessions: t.sessions,
      conversions: t.conversions,
    }
  } catch (err) {
    return {
      ok: false,
      propertyId: property.id,
      error: err instanceof Error ? err.message : "GA4 sync failed",
    }
  }
}
