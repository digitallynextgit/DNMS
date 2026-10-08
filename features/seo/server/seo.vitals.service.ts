import "server-only"

import { db } from "@/server/db"
import { fetchVitals, type FormFactor } from "@/lib/psi"
import { fetchOrganicTraffic } from "@/lib/ga4"
import { lastCompleteWindow } from "@/lib/gsc"

// Core Web Vitals + GA4 collection for the scorecard. One bad URL never aborts a run.

const MAX_PAGES = 10

/** How long a reading stays reusable. CrUX refreshes daily, so re-measuring sooner wastes quota. */
const FRESH_MS = { scheduled: 20 * 60 * 60 * 1000, manual: 15 * 60 * 1000 } as const

// PSI allows 240 calls/minute; spacing keeps multi-site runs under the burst limit.
const GAP_MS = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** URLs to measure: configured money pages, else the latest top pages by clicks, else the root. */
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
  /** Set when PSI refused us (quota or key), so the UI blames the API, not the pages. */
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

  // Reuse readings Google hasn't refreshed yet - one query for the whole set.
  const freshSince = new Date(Date.now() - FRESH_MS[opts.trigger ?? "scheduled"])
  const fresh = await db.seoVitals.findMany({
    where: { propertyId, formFactor, url: { in: urls }, checkedAt: { gte: freshSince } },
    select: { url: true },
    distinct: ["url"],
  })
  const isFresh = new Set(fresh.map((r) => r.url))

  // Sequential: PSI is slow and rate-limits hard in parallel.
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
      // A quota refusal won't clear on the next URL - stop and report.
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

/** Last complete 28 days of organic traffic from GA4. Skipped when no GA4 property is set. */
export async function runTrafficSync(propertyId: string): Promise<TrafficRunResult> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, gaPropertyId: true },
  })
  if (!property) return { ok: false, propertyId, error: "Property not found" }
  if (!property.gaPropertyId) {
    return { ok: false, propertyId, error: "No GA4 property id set for this site" }
  }

  // Same 28-day window and lag as the scorecard, so both describe the same days.
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
