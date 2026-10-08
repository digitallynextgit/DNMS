import "server-only"

import { db } from "@/server/db"
import { searchAnalytics, lastCompleteWindow, toDateKey } from "@/lib/gsc"
import { normalizeGscProperty } from "./seo.schemas"

// Pulls one Search Console window and stores it as a snapshot. The UI only ever diffs stored
// snapshots - fast, inside quota, and history survives lost access.

const QUERY_ROWS = 500
const PAGE_ROWS = 200

/** GSC property id: `siteUrl`, else the domain property. Normalised for older bare-host rows. */
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

/** Sync one property for one window (default: last complete 7 days). Re-running overwrites it. */
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
    // Dimension rows don't sum to the totals (Google drops small rows), so store totals too.
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

    // Replace the breakdown wholesale so a re-sync leaves no stale rows.
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
    // Record the failure so the UI can explain stale numbers.
    await db.seoProperty
      .update({ where: { id: property.id }, data: { lastSyncError: error } })
      .catch(() => {})
    return { ok: false, propertyId: property.id, domain: property.domain, error }
  }
}

/** Sync every active site on a project, one at a time (Google rate-limits per project). */
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

/** Backfill the N windows before the latest, so a new property has a trend line at once. */
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
    // A hard failure (no access, bad id) fails every window - stop.
    if (!res.ok) break
  }
  return results
}
