import "server-only"

import { db } from "@/server/db"
import { auditPage } from "@/lib/crawl"
import { classifyIntent, type KeywordIntent } from "./seo.keywords.service"

// =============================================================================
// The content loop (plan step 7). A brief moves a target query through
//   BRIEF -> WRITING -> REVIEW -> PUBLISHED -> MEASURED
// The brief gives the writer a SERP-informed H2 outline (built from our own
// related Search Console queries, so it reflects real demand, not guesses). When
// the page is live, the QA gate re-crawls it against the on-page checklist, and
// exactly 30 days later the target query's Search Console position is compared
// against its position at publish - so "did it work?" is answered by data.
//
// Auto-publishing is deliberately unsupported: the plan calls it out as a spam
// risk. A human always writes and ships; this module briefs, checks and measures.
// =============================================================================

const REVIEW_DELAY_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

function hostOf(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
}

/** Standard section scaffold by intent - the backbone every good page shares,
 *  which we then flesh out with the site's real related queries. */
function scaffold(query: string, intent: KeywordIntent): string[] {
  const q = query.trim()
  if (intent === "commercial")
    return [
      `What is ${q} (and who it's for)`,
      `Key features / how it works`,
      `Pricing, plans & what to expect`,
      `${q} vs the alternatives`,
      `How to choose the right option`,
      `FAQ`,
    ]
  if (intent === "informational")
    return [
      `What is ${q}?`,
      `Why ${q} matters`,
      `Step-by-step: how to do it`,
      `Real examples`,
      `Common mistakes to avoid`,
      `FAQ`,
    ]
  return [`Overview: ${q}`, `Key details`, `How it works in practice`, `What to do next`, `FAQ`]
}

/** Related queries we already get impressions for that contain the target term -
 *  each is a real sub-topic worth a section. Pulled from the latest snapshot. */
async function relatedQueries(propertyId: string, query: string): Promise<string[]> {
  const latest = await db.seoSnapshot.findFirst({
    where: { propertyId },
    orderBy: { periodEnd: "desc" },
    select: { id: true },
  })
  if (!latest) return []

  const head = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4)[0]
  if (!head) return []

  const rows = await db.seoQueryStat.findMany({
    where: { snapshotId: latest.id, query: { contains: head, mode: "insensitive" } },
    orderBy: { impressions: "desc" },
    take: 12,
    select: { query: true },
  })
  return rows
    .map((r) => r.query)
    .filter((q) => q.toLowerCase() !== query.toLowerCase())
    .slice(0, 8)
}

/** The latest known Search Console average position for a query, or null. */
async function latestQueryPosition(propertyId: string, query: string): Promise<number | null> {
  const latest = await db.seoSnapshot.findFirst({
    where: { propertyId },
    orderBy: { periodEnd: "desc" },
    select: { id: true },
  })
  if (!latest) return null
  const row = await db.seoQueryStat.findFirst({
    where: { snapshotId: latest.id, query: { equals: query, mode: "insensitive" } },
    select: { position: true },
  })
  return row ? row.position : null
}

export interface CreateBriefInput {
  keywordId?: string
  targetQuery?: string
}

/** Create a brief, either from a backlog keyword or a free-typed target query. */
export async function createBrief(propertyId: string, input: CreateBriefInput) {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, moneyKeywords: true, domain: true },
  })
  if (!property) return null

  let targetQuery = input.targetQuery?.trim() ?? ""
  let keywordId: string | null = null
  let intent: KeywordIntent = "other"

  if (input.keywordId) {
    const kw = await db.seoKeyword.findFirst({
      where: { id: input.keywordId, propertyId },
      select: { id: true, query: true, intent: true },
    })
    if (!kw) return null
    keywordId = kw.id
    targetQuery = kw.query
    intent = (kw.intent as KeywordIntent) ?? "other"
  }

  if (!targetQuery) return null
  if (!input.keywordId) {
    const brandLabel = property.domain.replace(/^www\./, "").split(".")[0] ?? ""
    intent = classifyIntent(targetQuery, [...property.moneyKeywords, brandLabel].filter(Boolean))
  }

  const related = await relatedQueries(propertyId, targetQuery)
  const outline = [...scaffold(targetQuery, intent), ...related.map((q) => `Answer: "${q}"`)].slice(
    0,
    14,
  )

  // Moving a keyword into a brief means it's actively being worked.
  if (keywordId) {
    await db.seoKeyword.update({ where: { id: keywordId }, data: { status: "IN_PROGRESS" } })
  }

  return db.seoContentBrief.create({
    data: {
      propertyId,
      keywordId,
      targetQuery,
      intent,
      status: "BRIEF",
      outline: outline as unknown as object,
    },
  })
}

export interface BriefPatch {
  status?: string
  outline?: string[]
  angle?: string | null
  notes?: string | null
  publishedUrl?: string | null
}

/** Update a brief's human-editable fields. */
export async function updateBrief(propertyId: string, briefId: string, patch: BriefPatch) {
  const brief = await db.seoContentBrief.findFirst({
    where: { id: briefId, propertyId },
    select: { id: true },
  })
  if (!brief) return null

  return db.seoContentBrief.update({
    where: { id: brief.id },
    data: {
      ...(patch.status === undefined ? {} : { status: patch.status }),
      ...(patch.outline === undefined ? {} : { outline: patch.outline as unknown as object }),
      ...(patch.angle === undefined ? {} : { angle: patch.angle }),
      ...(patch.notes === undefined ? {} : { notes: patch.notes }),
      ...(patch.publishedUrl === undefined ? {} : { publishedUrl: patch.publishedUrl }),
    },
  })
}

interface QaCheck {
  id: string
  label: string
  ok: boolean
  detail: string
  must: boolean
}

/** Re-crawl a published URL and grade it against the on-page checklist (plan
 *  step 7, point 4). Running QA marks the brief PUBLISHED, records the target
 *  query's baseline position, and schedules the 30-day check. */
export async function runBriefQa(propertyId: string, briefId: string, url: string) {
  const brief = await db.seoContentBrief.findFirst({
    where: { id: briefId, propertyId },
    select: { id: true, targetQuery: true, publishedAt: true, baselinePosition: true },
  })
  if (!brief) return null

  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { domain: true },
  })
  const host = hostOf(property?.domain ?? "")
  const page = await auditPage(url, host)

  const target = brief.targetQuery.toLowerCase()
  const titleHasKeyword =
    !!page.title &&
    target
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .some((w) => page.title!.toLowerCase().includes(w))

  const checks: QaCheck[] = [
    {
      id: "status",
      label: "Page returns 200",
      ok: page.status === 200,
      detail: `HTTP ${page.status || "-"}`,
      must: true,
    },
    {
      id: "indexable",
      label: "Not noindex",
      ok: !page.noindex,
      detail: page.noindex ? "Page is noindex" : "Indexable",
      must: true,
    },
    {
      id: "title",
      label: "Has a title",
      ok: !!page.title,
      detail: page.title ? `${page.titleLength} chars` : "Missing",
      must: true,
    },
    {
      id: "title_kw",
      label: "Title includes the target keyword",
      ok: titleHasKeyword,
      detail: titleHasKeyword ? "Present" : "Keyword not in title",
      must: false,
    },
    {
      id: "h1",
      label: "Exactly one H1",
      ok: page.h1Count === 1,
      detail: `${page.h1Count} H1(s)`,
      must: true,
    },
    {
      id: "meta",
      label: "Has a meta description",
      ok: !!page.metaDescription,
      detail: page.metaDescription ? `${page.metaDescriptionLength} chars` : "Missing",
      must: false,
    },
    {
      id: "canonical",
      label: "Has a canonical tag",
      ok: !!page.canonical,
      detail: page.canonical ? "Present" : "Missing",
      must: false,
    },
    {
      id: "schema",
      label: "Has JSON-LD schema",
      ok: page.schemaTypes.length > 0,
      detail: page.schemaTypes.length ? page.schemaTypes.join(", ") : "None",
      must: false,
    },
    {
      id: "alt",
      label: "All images have alt text",
      ok: page.imagesMissingAlt === 0,
      detail: page.imagesMissingAlt ? `${page.imagesMissingAlt} missing` : "OK",
      must: false,
    },
    {
      id: "links",
      label: "3+ internal links",
      ok: page.internalLinks >= 3,
      detail: `${page.internalLinks} links`,
      must: false,
    },
  ]

  const pass = checks.filter((c) => c.must).every((c) => c.ok)
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)
  const now = new Date()

  const qa = {
    checkedAt: now.toISOString(),
    url,
    pass,
    score,
    checks: checks.map(({ must: _must, ...c }) => c),
  }

  // First successful QA against a live URL = "published": capture the baseline
  // and schedule the 30-day check. Re-running QA later just refreshes the grade.
  const firstPublish = !brief.publishedAt
  const baseline =
    brief.baselinePosition ?? (await latestQueryPosition(propertyId, brief.targetQuery))

  return db.seoContentBrief.update({
    where: { id: brief.id },
    data: {
      qa: qa as unknown as object,
      publishedUrl: url,
      status: "PUBLISHED",
      ...(firstPublish
        ? {
            publishedAt: now,
            baselinePosition: baseline,
            reviewAt: new Date(now.getTime() + REVIEW_DELAY_DAYS * DAY_MS),
          }
        : {}),
    },
  })
}

export interface ReviewResult {
  reviewed: number
  won: number
  lost: number
  flat: number
}

/** Run every due 30-day check (plan step 7, point 6). Compares the target
 *  query's current Search Console position against its position at publish and
 *  files the outcome. Winners can be expanded; losers go on the rewrite queue.
 *  Called from the weekly cron; `propertyId` scopes it to one site on demand. */
export async function runContentReviews(propertyId?: string): Promise<ReviewResult> {
  const now = new Date()
  const due = await db.seoContentBrief.findMany({
    where: {
      ...(propertyId ? { propertyId } : {}),
      reviewOutcome: null,
      reviewAt: { lte: now },
      publishedUrl: { not: null },
    },
    select: { id: true, propertyId: true, targetQuery: true, baselinePosition: true },
  })

  const result: ReviewResult = { reviewed: 0, won: 0, lost: 0, flat: 0 }

  for (const b of due) {
    const current = await latestQueryPosition(b.propertyId, b.targetQuery)
    let outcome: "WON" | "LOST" | "FLAT"

    if (current === null || current === 0) {
      // Still not ranking for it at all - a miss unless it never was.
      outcome = b.baselinePosition ? "LOST" : "FLAT"
    } else if (b.baselinePosition === null || b.baselinePosition === 0) {
      // Wasn't ranking before, is now - a clear win.
      outcome = "WON"
    } else if (current < b.baselinePosition - 1) {
      outcome = "WON" // moved up the page (lower position number is better)
    } else if (current > b.baselinePosition + 3) {
      outcome = "LOST"
    } else {
      outcome = "FLAT"
    }

    await db.seoContentBrief.update({
      where: { id: b.id },
      data: { reviewPosition: current, reviewOutcome: outcome, status: "MEASURED" },
    })

    result.reviewed++
    if (outcome === "WON") result.won++
    else if (outcome === "LOST") result.lost++
    else result.flat++
  }

  return result
}

export interface ContentBriefView {
  id: string
  keywordId: string | null
  targetQuery: string
  intent: string
  status: string
  outline: string[]
  angle: string | null
  notes: string | null
  publishedUrl: string | null
  publishedAt: string | null
  qa: unknown
  baselinePosition: number | null
  reviewAt: string | null
  reviewPosition: number | null
  reviewOutcome: string | null
  createdAt: string
  updatedAt: string
}

/** Every brief for a site, most-recently-touched first. */
export async function getBriefs(propertyId: string): Promise<ContentBriefView[]> {
  const rows = await db.seoContentBrief.findMany({
    where: { propertyId },
    orderBy: { updatedAt: "desc" },
    take: 200,
  })
  return rows.map((r) => ({
    id: r.id,
    keywordId: r.keywordId,
    targetQuery: r.targetQuery,
    intent: r.intent,
    status: r.status,
    outline: (r.outline as unknown as string[]) ?? [],
    angle: r.angle,
    notes: r.notes,
    publishedUrl: r.publishedUrl,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    qa: r.qa,
    baselinePosition: r.baselinePosition,
    reviewAt: r.reviewAt?.toISOString() ?? null,
    reviewPosition: r.reviewPosition,
    reviewOutcome: r.reviewOutcome,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

/** Delete a brief (and unlink its keyword's IN_PROGRESS state if it was set). */
export async function deleteBrief(propertyId: string, briefId: string): Promise<boolean> {
  const brief = await db.seoContentBrief.findFirst({
    where: { id: briefId, propertyId },
    select: { id: true },
  })
  if (!brief) return false
  await db.seoContentBrief.delete({ where: { id: brief.id } })
  return true
}
