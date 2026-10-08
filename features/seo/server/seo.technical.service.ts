import "server-only"

import { db } from "@/server/db"
import { auditPage, checkRobots, checkSitemap, type PageAudit, type PageIssue } from "@/lib/crawl"
import { submitToIndexNow, isIndexNowConfigured } from "@/lib/indexnow"
import { resolveMoneyPages } from "./seo.vitals.service"

// Technical audit for one site: crawl the money pages, check sitemap.xml and robots.txt, store
// the result (criticalCount feeds the scorecard), then ping IndexNow.

function hostOf(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
}

function originOf(domain: string): string {
  const host = hostOf(domain)
  return `https://${host}`
}

export interface TechnicalAuditResult {
  ok: boolean
  auditId?: string
  pagesChecked: number
  criticalCount: number
  warningCount: number
  error?: string
}

export async function runTechnicalAudit(propertyId: string): Promise<TechnicalAuditResult> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, domain: true },
  })
  if (!property)
    return {
      ok: false,
      pagesChecked: 0,
      criticalCount: 0,
      warningCount: 0,
      error: "Property not found",
    }

  const host = hostOf(property.domain)
  const origin = originOf(property.domain)
  const urls = await resolveMoneyPages(propertyId)

  // Sequential - parallel requests to a client's live server could look like an attack.
  const pages: PageAudit[] = []
  for (const url of urls) {
    pages.push(await auditPage(url, host))
  }

  const [sitemap, robots] = await Promise.all([checkSitemap(origin), checkRobots(origin)])

  const siteIssues: PageIssue[] = []
  if (sitemap.issue) siteIssues.push(sitemap.issue)
  if (robots.issue) siteIssues.push(robots.issue)

  const allIssues = [...siteIssues, ...pages.flatMap((p) => p.issues)]
  const criticalCount = allIssues.filter((i) => i.level === "critical").length
  const warningCount = allIssues.filter((i) => i.level === "warning").length

  const audit = await db.seoTechnicalAudit.create({
    data: {
      propertyId: property.id,
      pagesChecked: pages.length,
      criticalCount,
      warningCount,
      sitemapOk: sitemap.ok,
      robotsOk: robots.ok,
      sitemapUrls: sitemap.urlCount,
      pages: pages as unknown as object,
      siteIssues: siteIssues as unknown as object,
    },
    select: { id: true },
  })

  // Nudge the checked URLs for recrawl. Best-effort - never block on it.
  if (await isIndexNowConfigured()) {
    await submitToIndexNow(
      host,
      pages.filter((p) => p.ok).map((p) => p.url),
    ).catch(() => {})
  }

  return {
    ok: true,
    auditId: audit.id,
    pagesChecked: pages.length,
    criticalCount,
    warningCount,
  }
}

/** The latest audit for a site, or null. Used by the UI and the scorecard. */
export async function getLatestAudit(propertyId: string) {
  return db.seoTechnicalAudit.findFirst({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  })
}
