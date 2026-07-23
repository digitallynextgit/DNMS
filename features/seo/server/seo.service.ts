import "server-only"

import { db } from "@/server/db"
import { searchAnalytics, lastCompleteWindow, toDateKey } from "@/lib/gsc"
import { normalizeGscProperty } from "./seo.schemas"

// =============================================================================
// Pulls one reporting window from Search Console and stores it as a snapshot.
//
// Snapshots are the unit of truth for growth: everything the UI shows is a diff
// between two stored windows, never a live API call. That keeps the dashboard
// fast, keeps us inside Google's quota, and means history survives even if a
// property later loses access.
// =============================================================================

const QUERY_ROWS = 500
const PAGE_ROWS = 200

/**
 * GSC property id for a config: the explicit `siteUrl`, else the domain
 * property. Normalised defensively - rows saved before validation existed can
 * hold a bare host, which Google rejects outright.
 */
export function resolveSiteUrl(p: { siteUrl: string | null; domain: string }): string {
  return (
    normalizeGscProperty(p.siteUrl) ?? normalizeGscProperty(p.domain) ?? `sc-domain:${p.domain}`
  )
}

function asDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`)
}

export interface SyncResult {
  ok: boolean
  propertyId: string
  domain: string
  period?: { start: string; end: string }
  clicks?: number
  impressions?: number
  queries?: number
  pages?: number
  error?: string
}

/**
 * Sync a single property for one window (default: the last complete 7 days).
 * Re-running the same window overwrites it, so this is safe to retry.
 */
export async function syncSeoProperty(
  propertyId: string,
  window?: { start: string; end: string },
): Promise<SyncResult> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, domain: true, siteUrl: true },
  })
  if (!property) return { ok: false, propertyId, domain: "", error: "Property not found" }

  const period = window ?? lastCompleteWindow(7)
  const siteUrl = resolveSiteUrl(property)

  try {
    // One totals call plus two dimension calls. Dimension rows do NOT sum to the
    // totals (Google drops low-volume rows for privacy), so we store the totals
    // separately rather than deriving them.
    const [totalsRows, queryRows, pageRows] = await Promise.all([
      searchAnalytics({ siteUrl, startDate: period.start, endDate: period.end }),
      searchAnalytics({
        siteUrl,
        startDate: period.start,
        endDate: period.end,
        dimensions: ["query"],
        rowLimit: QUERY_ROWS,
      }),
      searchAnalytics({
        siteUrl,
        startDate: period.start,
        endDate: period.end,
        dimensions: ["page"],
        rowLimit: PAGE_ROWS,
      }),
    ])

    const totals = totalsRows[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0, keys: [] }

    const snapshot = await db.seoSnapshot.upsert({
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
        clicks: Math.round(totals.clicks),
        impressions: Math.round(totals.impressions),
        ctr: totals.ctr,
        position: totals.position,
      },
      update: {
        clicks: Math.round(totals.clicks),
        impressions: Math.round(totals.impressions),
        ctr: totals.ctr,
        position: totals.position,
      },
      select: { id: true },
    })

    // Replace the breakdown wholesale - a re-sync of the same window should not
    // leave stale rows behind.
    await db.$transaction([
      db.seoQueryStat.deleteMany({ where: { snapshotId: snapshot.id } }),
      db.seoPageStat.deleteMany({ where: { snapshotId: snapshot.id } }),
      db.seoQueryStat.createMany({
        data: queryRows
          .filter((r) => r.keys[0])
          .map((r) => ({
            snapshotId: snapshot.id,
            query: r.keys[0] as string,
            clicks: Math.round(r.clicks),
            impressions: Math.round(r.impressions),
            ctr: r.ctr,
            position: r.position,
          })),
      }),
      db.seoPageStat.createMany({
        data: pageRows
          .filter((r) => r.keys[0])
          .map((r) => ({
            snapshotId: snapshot.id,
            page: r.keys[0] as string,
            clicks: Math.round(r.clicks),
            impressions: Math.round(r.impressions),
            ctr: r.ctr,
            position: r.position,
          })),
      }),
    ])

    await db.seoProperty.update({
      where: { id: property.id },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    })

    return {
      ok: true,
      propertyId: property.id,
      domain: property.domain,
      period,
      clicks: Math.round(totals.clicks),
      impressions: Math.round(totals.impressions),
      queries: queryRows.length,
      pages: pageRows.length,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Sync failed"
    // Record the failure on the property so the UI can explain itself instead of
    // silently showing stale numbers.
    await db.seoProperty
      .update({ where: { id: property.id }, data: { lastSyncError: error } })
      .catch(() => {})
    return { ok: false, propertyId: property.id, domain: property.domain, error }
  }
}

/** Sync every active site on a project - the "Sync all" button for an account
 *  like KYG that tracks many subdomains at once. Sequential to stay inside
 *  Google's per-project rate limit. */
export async function syncProjectSeo(projectId: string): Promise<SyncResult[]> {
  const properties = await db.seoProperty.findMany({
    where: { projectId, isActive: true },
    select: { id: true },
    orderBy: [{ isPrimary: "desc" }, { label: "asc" }],
  })
  const out: SyncResult[] = []
  for (const p of properties) out.push(await syncSeoProperty(p.id))
  return out
}

/**
 * Backfill the N windows before the latest one, so a freshly-configured property
 * has a trend line immediately instead of after N weeks of waiting.
 */
export async function backfillSeoProperty(propertyId: string, weeks = 8): Promise<SyncResult[]> {
  const results: SyncResult[] = []
  const latest = lastCompleteWindow(7)
  for (let i = 0; i < weeks; i++) {
    const end = new Date(`${latest.end}T00:00:00.000Z`)
    end.setUTCDate(end.getUTCDate() - 7 * i)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - 6)
    const res = await syncSeoProperty(propertyId, { start: toDateKey(start), end: toDateKey(end) })
    results.push(res)
    // A hard failure (no access, bad property id) will fail for every window -
    // stop rather than hammering the API 8 times with the same error.
    if (!res.ok) break
  }
  return results
}
