import "server-only"

import { db } from "@/server/db"

// =============================================================================
// Off-page / backlinks (plan step 8). Neither Ahrefs Webmaster Tools nor Search
// Console expose a free backlinks API, but both let you EXPORT the list. A human
// pastes that export here; we store one row per linking page and diff it against
// what we had, so:
//   - links that disappeared from the export are marked LOST,
//   - genuinely new referring domains are counted,
//   - the referring-domain total feeds the scorecard.
// An import is treated as the current full snapshot when `fullSnapshot` is set -
// that is what makes the monthly "net new / lost" diff meaningful.
// =============================================================================

export interface ParsedBacklink {
  sourceUrl: string
  anchor: string | null
  targetUrl: string | null
  domainRating: number | null
}

/** Extract the registrable-ish host from a URL (drops leading www.). */
function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return null
  }
}

/**
 * Parse a pasted export. Accepts either one URL per line, or comma/tab-separated
 * rows `sourceUrl, anchor, targetUrl, domainRating` (extra columns ignored). The
 * first token on a line that looks like an http(s) URL is the source.
 */
export function parseBacklinks(text: string): ParsedBacklink[] {
  const out: ParsedBacklink[] = []
  const seen = new Set<string>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    // Skip an obvious header row.
    if (/^(source|url|referring|from)\b/i.test(line) && !/https?:\/\//i.test(line)) continue

    const cols = line.split(/\s*[,\t]\s*/)
    const sourceUrl = cols.find((c) => /^https?:\/\/\S+$/i.test(c))
    if (!sourceUrl) continue
    const key = sourceUrl.replace(/\/$/, "").toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const rest = cols.filter((c) => c !== sourceUrl)
    const anchor = rest.find((c) => c && !/^https?:\/\//i.test(c) && !/^\d+$/.test(c)) ?? null
    const targetUrl = rest.find((c) => /^https?:\/\//i.test(c)) ?? null
    const drStr = rest.find((c) => /^\d{1,3}$/.test(c))
    const domainRating = drStr ? Math.min(100, parseInt(drStr, 10)) : null

    out.push({ sourceUrl, anchor, targetUrl, domainRating })
  }
  return out
}

export interface ImportResult {
  added: number
  refreshed: number
  lost: number
  totalActive: number
  referringDomains: number
}

/** Store an import and diff it. With `fullSnapshot`, links previously ACTIVE but
 *  absent from this import are marked LOST (the monthly-diff behaviour). */
export async function importBacklinks(
  propertyId: string,
  rows: ParsedBacklink[],
  opts: { source?: string; fullSnapshot?: boolean } = {},
): Promise<ImportResult | null> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true },
  })
  if (!property) return null

  const source = opts.source ?? "MANUAL"
  const now = new Date()

  const existing = await db.seoBacklink.findMany({
    where: { propertyId },
    select: { id: true, sourceUrl: true, status: true },
  })
  const byUrl = new Map(existing.map((e) => [e.sourceUrl.replace(/\/$/, "").toLowerCase(), e]))

  const importedKeys = new Set<string>()
  let added = 0
  let refreshed = 0

  for (const r of rows) {
    const domain = domainOf(r.sourceUrl)
    if (!domain) continue
    const key = r.sourceUrl.replace(/\/$/, "").toLowerCase()
    importedKeys.add(key)
    const prior = byUrl.get(key)

    if (prior) {
      await db.seoBacklink.update({
        where: { id: prior.id },
        data: {
          status: "ACTIVE",
          lastSeen: now,
          sourceDomain: domain,
          ...(r.anchor ? { anchor: r.anchor } : {}),
          ...(r.targetUrl ? { targetUrl: r.targetUrl } : {}),
          ...(r.domainRating !== null ? { domainRating: r.domainRating } : {}),
          source,
        },
      })
      refreshed++
    } else {
      await db.seoBacklink.create({
        data: {
          propertyId,
          sourceUrl: r.sourceUrl,
          sourceDomain: domain,
          targetUrl: r.targetUrl,
          anchor: r.anchor,
          domainRating: r.domainRating,
          source,
          status: "ACTIVE",
          firstSeen: now,
          lastSeen: now,
        },
      })
      added++
    }
  }

  // Full-snapshot diff: anything active we didn't see this time is now lost.
  let lost = 0
  if (opts.fullSnapshot) {
    const missing = existing.filter(
      (e) =>
        e.status === "ACTIVE" && !importedKeys.has(e.sourceUrl.replace(/\/$/, "").toLowerCase()),
    )
    if (missing.length) {
      await db.seoBacklink.updateMany({
        where: { id: { in: missing.map((m) => m.id) } },
        data: { status: "LOST", lastSeen: now },
      })
      lost = missing.length
    }
  }

  const active = await db.seoBacklink.findMany({
    where: { propertyId, status: "ACTIVE" },
    select: { sourceDomain: true },
  })
  const referringDomains = new Set(active.map((a) => a.sourceDomain)).size

  return { added, refreshed, lost, totalActive: active.length, referringDomains }
}

export interface ReferringDomainView {
  domain: string
  links: number
  domainRating: number | null
  firstSeen: string
}

export interface BacklinkSummaryView {
  totalActive: number
  totalLost: number
  referringDomains: number
  /** Distinct referring domains first seen in the last 28 days. */
  newDomains28d: number
  domains: ReferringDomainView[]
  lastImportAt: string | null
}

/** Referring-domain rollup + headline counts for the Backlinks tab. */
export async function getBacklinks(propertyId: string): Promise<BacklinkSummaryView> {
  const rows = await db.seoBacklink.findMany({
    where: { propertyId },
    select: {
      sourceDomain: true,
      status: true,
      domainRating: true,
      firstSeen: true,
      lastSeen: true,
    },
  })

  const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
  const domainMap = new Map<string, { links: number; dr: number | null; firstSeen: Date }>()
  let totalActive = 0
  let totalLost = 0

  for (const r of rows) {
    if (r.status === "ACTIVE") totalActive++
    else totalLost++
    if (r.status !== "ACTIVE") continue
    const cur = domainMap.get(r.sourceDomain)
    if (cur) {
      cur.links++
      if (r.domainRating !== null && (cur.dr === null || r.domainRating > cur.dr))
        cur.dr = r.domainRating
      if (r.firstSeen < cur.firstSeen) cur.firstSeen = r.firstSeen
    } else {
      domainMap.set(r.sourceDomain, { links: 1, dr: r.domainRating, firstSeen: r.firstSeen })
    }
  }

  const domains: ReferringDomainView[] = [...domainMap.entries()]
    .map(([domain, v]) => ({
      domain,
      links: v.links,
      domainRating: v.dr,
      firstSeen: v.firstSeen.toISOString(),
    }))
    .sort((a, b) => (b.domainRating ?? 0) - (a.domainRating ?? 0) || b.links - a.links)

  const newDomains28d = domains.filter((d) => new Date(d.firstSeen) >= cutoff).length
  const lastImport = rows.reduce<Date | null>(
    (a, r) => (a === null || r.lastSeen > a ? r.lastSeen : a),
    null,
  )

  return {
    totalActive,
    totalLost,
    referringDomains: domainMap.size,
    newDomains28d,
    domains,
    lastImportAt: lastImport?.toISOString() ?? null,
  }
}

/**
 * Referring-domain counts for the scorecard's metric #5 (plan step 10): how many
 * active referring domains we have now vs how many we had before this 28-day
 * window began (domains first seen earlier and still active). Growth in referring
 * domains is exactly what the metric rewards. Returns null when no backlinks have
 * ever been imported, so the metric stays honestly "unavailable".
 */
export async function referringDomainGrowth(
  propertyId: string,
  windowStart: Date,
): Promise<{ current: number; previous: number; netNew: number } | null> {
  const rows = await db.seoBacklink.findMany({
    where: { propertyId },
    select: { sourceDomain: true, status: true, firstSeen: true },
  })
  if (rows.length === 0) return null

  const activeDomains = new Set<string>()
  const priorDomains = new Set<string>()
  const newDomains = new Set<string>()
  for (const r of rows) {
    if (r.status !== "ACTIVE") continue
    activeDomains.add(r.sourceDomain)
    if (r.firstSeen < windowStart) priorDomains.add(r.sourceDomain)
    else newDomains.add(r.sourceDomain)
  }
  return { current: activeDomains.size, previous: priorDomains.size, netNew: newDomains.size }
}
