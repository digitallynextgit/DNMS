import "server-only"

import { db } from "@/server/db"
import { fetchOutline, type PageOutline } from "@/lib/crawl"
import { resolveMoneyPages } from "./seo.vitals.service"

// Competitor gap analysis: crawl a sample of each competitor's pages, treat titles and headings
// as topics, and keep the ones we don't cover. Heuristic - a human vets each gap.

const MAX_COMPETITORS = 4
const MAX_PAGES_PER_COMPETITOR = 12
const MAX_OUR_PAGES = 8
const MAX_GAPS = 60

function hostOf(domain: string): string {
  return domain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
}

// No topic signal - dropped so "the best crm software" matches "crm software".
const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "with",
  "your",
  "our",
  "how",
  "what",
  "why",
  "best",
  "top",
  "guide",
  "vs",
  "is",
  "are",
  "you",
  "we",
  "it",
  "at",
  "by",
  "from",
  "this",
  "that",
  "get",
  "all",
  "new",
  "more",
  "home",
  "about",
  "contact",
  "blog",
  "page",
  "read",
  "learn",
  "us",
  "&",
])

/** Significant lowercase tokens from a phrase - the topic's fingerprint. */
function tokenize(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
}

function cleanTopic(phrase: string): string {
  return (
    phrase
      // Drop the " | Brand" / " - Brand" suffix titles usually carry.
      .split(/\s+[|–\-]\s+/)[0]!
      .trim()
      .replace(/\s+/g, " ")
  )
}

interface CompetitorReport {
  domain: string
  ok: boolean
  pagesCrawled: number
  topics: { topic: string; url: string; title: string | null }[]
}

interface Gap {
  topic: string
  sampleTitle: string | null
  competitor: string
  sourceUrl: string
}

export interface CompetitorGapResult {
  ok: boolean
  auditId?: string
  competitorsChecked: number
  ourPagesChecked: number
  gapCount: number
  error?: string
}

/** Crawl a sample of a site breadth-first. Sequential - parallel requests look like an attack. */
async function crawlSite(host: string, maxPages: number): Promise<PageOutline[]> {
  const origin = `https://${host}`
  const queue = [origin, `${origin}/`]
  const seen = new Set<string>()
  const out: PageOutline[] = []

  while (queue.length && out.length < maxPages) {
    const url = queue.shift()!
    const norm = url.replace(/\/$/, "")
    if (seen.has(norm)) continue
    seen.add(norm)

    const page = await fetchOutline(url, host)
    if (!page.ok) continue
    out.push(page)

    for (const link of page.links) {
      const ln = link.replace(/\/$/, "")
      if (!seen.has(ln) && queue.length < maxPages * 4) queue.push(link)
    }
  }
  return out
}

/**
 * Tokens WE already cover: money keywords, our Search Console queries, our money pages' headings.
 */
async function buildOurCoverage(
  propertyId: string,
  host: string,
): Promise<{ tokens: Set<string>; ourPagesChecked: number }> {
  const tokens = new Set<string>()

  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { moneyKeywords: true },
  })
  for (const kw of property?.moneyKeywords ?? []) tokenize(kw).forEach((t) => tokens.add(t))

  // Our Search Console queries - the strongest signal of what we already rank for.
  const latest = await db.seoSnapshot.findFirst({
    where: { propertyId },
    orderBy: { periodEnd: "desc" },
    select: { id: true },
  })
  if (latest) {
    const queries = await db.seoQueryStat.findMany({
      where: { snapshotId: latest.id },
      orderBy: { impressions: "desc" },
      take: 500,
      select: { query: true },
    })
    for (const q of queries) tokenize(q.query).forEach((t) => tokens.add(t))
  }

  const ourUrls = (await resolveMoneyPages(propertyId)).slice(0, MAX_OUR_PAGES)
  let ourPagesChecked = 0
  for (const url of ourUrls) {
    const page = await fetchOutline(url, host)
    if (!page.ok) continue
    ourPagesChecked++
    if (page.title) tokenize(page.title).forEach((t) => tokens.add(t))
    for (const h of page.headings) tokenize(h).forEach((t) => tokens.add(t))
  }

  return { tokens, ourPagesChecked }
}

/** We cover under a third of the topic's words. Single-word topics are too generic to count. */
function isGap(topicTokens: string[], coverage: Set<string>): boolean {
  if (topicTokens.length < 2) return false
  const covered = topicTokens.filter((t) => coverage.has(t)).length
  return covered / topicTokens.length < 0.34
}

export async function runCompetitorGap(propertyId: string): Promise<CompetitorGapResult> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, domain: true, competitors: true },
  })
  if (!property)
    return {
      ok: false,
      competitorsChecked: 0,
      ourPagesChecked: 0,
      gapCount: 0,
      error: "Property not found",
    }

  const competitors = property.competitors.map(hostOf).filter(Boolean).slice(0, MAX_COMPETITORS)
  if (competitors.length === 0)
    return {
      ok: false,
      competitorsChecked: 0,
      ourPagesChecked: 0,
      gapCount: 0,
      error: "No competitors configured. Add competitor domains to this site first.",
    }

  const ourHost = hostOf(property.domain)
  const { tokens: coverage, ourPagesChecked } = await buildOurCoverage(propertyId, ourHost)

  const reports: CompetitorReport[] = []
  const gapByTopic = new Map<string, Gap>()

  for (const domain of competitors) {
    const pages = await crawlSite(domain, MAX_PAGES_PER_COMPETITOR)
    const topics: CompetitorReport["topics"] = []

    for (const page of pages) {
      const phrases = [page.title, ...page.headings].filter((p): p is string => !!p)
      for (const phrase of phrases) {
        const topic = cleanTopic(phrase)
        const toks = tokenize(topic)
        if (toks.length < 2) continue
        topics.push({ topic, url: page.url, title: page.title })

        if (isGap(toks, coverage)) {
          const key = toks.slice().sort().join(" ") // order-independent dedupe key
          if (!gapByTopic.has(key)) {
            gapByTopic.set(key, {
              topic,
              sampleTitle: page.title,
              competitor: domain,
              sourceUrl: page.url,
            })
          }
        }
      }
    }

    reports.push({
      domain,
      ok: pages.length > 0,
      pagesCrawled: pages.length,
      topics: topics.slice(0, 60), // keep the stored blob bounded
    })
  }

  // Longer, more specific gaps first - they make better standalone articles.
  const gaps = [...gapByTopic.values()]
    .sort((a, b) => tokenize(b.topic).length - tokenize(a.topic).length)
    .slice(0, MAX_GAPS)

  const audit = await db.seoCompetitorAudit.create({
    data: {
      propertyId: property.id,
      competitorsChecked: reports.filter((r) => r.ok).length,
      ourPagesChecked,
      gapCount: gaps.length,
      competitors: reports as unknown as object,
      gaps: gaps as unknown as object,
    },
    select: { id: true },
  })

  return {
    ok: true,
    auditId: audit.id,
    competitorsChecked: reports.filter((r) => r.ok).length,
    ourPagesChecked,
    gapCount: gaps.length,
  }
}

export interface CompetitorAuditView {
  id: string
  competitorsChecked: number
  ourPagesChecked: number
  gapCount: number
  competitors: CompetitorReport[]
  gaps: Gap[]
  createdAt: string
}

export async function getCompetitorAudit(propertyId: string): Promise<CompetitorAuditView | null> {
  const row = await db.seoCompetitorAudit.findFirst({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  })
  if (!row) return null
  return {
    id: row.id,
    competitorsChecked: row.competitorsChecked,
    ourPagesChecked: row.ourPagesChecked,
    gapCount: row.gapCount,
    competitors: row.competitors as unknown as CompetitorReport[],
    gaps: row.gaps as unknown as Gap[],
    createdAt: row.createdAt.toISOString(),
  }
}
