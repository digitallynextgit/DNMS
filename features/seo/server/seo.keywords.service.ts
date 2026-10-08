import "server-only"

import { db } from "@/server/db"

// Keyword backlog: Search Console queries scored by demand x position opportunity x winnability
// x business value - transparent, so a human can see and adjust why one outranks another.

export type KeywordIntent = "commercial" | "informational" | "branded" | "navigational" | "other"

/** Cheap, transparent intent guess from the query words. A human can override it. */
export function classifyIntent(query: string, brandTerms: string[]): KeywordIntent {
  const q = query.toLowerCase()
  // Branded first - a brand term anywhere makes it a brand query.
  if (brandTerms.some((b) => b && q.includes(b.toLowerCase()))) return "branded"

  if (
    /\b(buy|price|cost|cheap|deal|discount|coupon|for sale|near me|best|top|vs|versus|review|reviews|agency|agencies|company|companies|service|services|provider|hire|quote|pricing|plans?)\b/.test(
      q,
    )
  )
    return "commercial"

  if (
    /\b(how|what|why|when|where|who|guide|tutorial|meaning|examples?|tips|ideas|vs\.?|difference)\b/.test(
      q,
    )
  )
    return "informational"

  // A bare brand/product name (1-2 words, no modifiers) usually = navigational.
  if (q.split(/\s+/).length <= 2) return "navigational"

  return "other"
}

/** Positions 5-20 (striking distance) are the fastest wins; past 30 is a long haul. */
function positionOpportunity(position: number): number {
  if (position === 0) return 0.3 // unknown / not ranking
  if (position >= 5 && position <= 20) return 1.0 // striking distance
  if (position > 20 && position <= 30) return 0.7
  if (position < 5) return 0.4 // already near the top - less to gain
  return 0.3 // 30+
}

/** Priority score. Unassessed winnability uses a neutral 0.6 until a human decides. */
export function scoreKeyword(k: {
  impressions: number
  position: number
  winnable: boolean | null
  businessValue: number
  /**
   * No impression data (normal for competitor-mined keywords) - use a demand floor instead of 0.
   */
  demandUnknown?: boolean
}): number {
  // Log-scale demand so a huge query doesn't drown the rest. The unknown-demand floor sits just
  // below one real impression (log10(2) = 0.30), so mined guesses never outrank real queries.
  const UNKNOWN_DEMAND = 0.25
  const demand =
    k.demandUnknown && k.impressions === 0 ? UNKNOWN_DEMAND : Math.log10(k.impressions + 1)
  const opp = positionOpportunity(k.position)
  const win = k.winnable === null ? 0.6 : k.winnable ? 1 : 0.15
  const value = Math.max(1, Math.min(5, k.businessValue)) / 3 // 0.33 .. 1.67
  return Math.round(demand * opp * win * value * 100) / 100
}

export interface GenerateResult {
  added: number
  updated: number
  total: number
}

/**
 * (Re)generate the backlog from the latest snapshot. Existing rows keep their human fields and
 * only refresh signals and score; nothing is deleted.
 */
export async function generateKeywordBacklog(propertyId: string): Promise<GenerateResult> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, domain: true, moneyKeywords: true },
  })
  if (!property) return { added: 0, updated: 0, total: 0 }

  const latest = await db.seoSnapshot.findFirst({
    where: { propertyId },
    orderBy: { periodEnd: "desc" },
    select: { id: true },
  })
  if (!latest)
    return { added: 0, updated: 0, total: await db.seoKeyword.count({ where: { propertyId } }) }

  const rows = await db.seoQueryStat.findMany({
    where: { snapshotId: latest.id },
    orderBy: [{ impressions: "desc" }],
    take: 500,
    select: { query: true, impressions: true, clicks: true, position: true, ctr: true },
  })

  // Brand terms: the money keywords plus the domain's label (e.g. "knowyourgenes").
  const brandLabel = property.domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(".")[0]
  const brandTerms = [...property.moneyKeywords, brandLabel ?? ""].filter(Boolean)

  const existing = await db.seoKeyword.findMany({
    where: { propertyId },
    select: { id: true, query: true, winnable: true, businessValue: true },
  })
  const byQuery = new Map(existing.map((e) => [e.query.toLowerCase(), e]))

  let added = 0
  let updated = 0

  for (const r of rows) {
    if (!r.query) continue
    const prior = byQuery.get(r.query.toLowerCase())
    const winnable = prior?.winnable ?? null
    const businessValue = prior?.businessValue ?? 3
    const intent = classifyIntent(r.query, brandTerms)
    const score = scoreKeyword({
      impressions: r.impressions,
      position: r.position,
      winnable,
      businessValue,
    })

    if (prior) {
      await db.seoKeyword.update({
        where: { id: prior.id },
        data: {
          impressions: r.impressions,
          clicks: r.clicks,
          position: r.position,
          ctr: r.ctr,
          intent,
          score,
        },
      })
      updated++
    } else {
      await db.seoKeyword.create({
        data: {
          propertyId,
          query: r.query,
          impressions: r.impressions,
          clicks: r.clicks,
          position: r.position,
          ctr: r.ctr,
          intent,
          businessValue,
          score,
          status: "BACKLOG",
        },
      })
      added++
    }
  }

  return { added, updated, total: await db.seoKeyword.count({ where: { propertyId } }) }
}

// Mining competitor keywords: their crawled titles/headings become candidates. Real impressions
// are attached only where our own Search Console has the phrase - no invented volumes.

/** Phrases that are page furniture rather than a keyword anyone searches. */
const NOT_A_KEYWORD =
  /^(home|about( us)?|contact( us)?|blog|news|careers|privacy|terms|login|sign in|sign up|menu|search|faqs?|cookie|newsletter|subscribe|follow us|share|read more|back to top|all rights reserved)$/i

/**
 * Brand words from competitor domains ("mapmygenome.in" -> "mapmygenome") - you can't outrank a
 * company for its own name.
 */
function competitorBrandTokens(domains: string[]): string[] {
  const tokens = new Set<string>()
  for (const d of domains) {
    const host = d
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
    const name = host.split(".")[0]
    if (name && name.length >= 4) tokens.add(name)
  }
  return [...tokens]
}

/** Trim a crawled title or heading down to something keyword shaped. */
function toKeywordPhrase(raw: string): string | null {
  const cleaned = raw
    // Titles are usually "Topic | Brand" or "Topic - Brand"; keep the topic.
    .split(/\s+[|·>»]\s+|\s+[-]\s+/)[0]!
    .replace(/\s+/g, " ")
    .replace(/[?!.,:;"'()[\]]+$/, "")
    .trim()
    .toLowerCase()

  if (cleaned.length < 6 || cleaned.length > 70) return null
  if (NOT_A_KEYWORD.test(cleaned)) return null

  const words = cleaned.split(/\s+/)
  // One word is too generic to act on; more than eight is a sentence, not a query.
  if (words.length < 2 || words.length > 8) return null
  // Drop anything that is mostly numbers or symbols.
  if (!/[a-z]{3}/.test(cleaned)) return null
  return cleaned
}

export interface MineResult {
  added: number
  updated: number
  total: number
  /** How many mined phrases we could attach real Search Console data to. */
  withDemandData: number
  competitors: number
  /** Set when there is nothing to mine yet. */
  error?: string
}

/** Turn the latest competitor crawl into backlog candidates (run a competitor analysis first). */
export async function mineCompetitorKeywords(propertyId: string): Promise<MineResult> {
  const empty: MineResult = {
    added: 0,
    updated: 0,
    total: 0,
    withDemandData: 0,
    competitors: 0,
  }

  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, domain: true, moneyKeywords: true },
  })
  if (!property) return { ...empty, error: "Property not found" }

  const audit = await db.seoCompetitorAudit.findFirst({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
    select: { competitors: true },
  })
  if (!audit)
    return {
      ...empty,
      error: "Run the competitor analysis first so there are pages to mine.",
    }

  const reports = (audit.competitors ?? []) as unknown as {
    domain: string
    topics?: { topic: string }[]
  }[]

  // First competitor wins, so the earliest configured one is credited.
  const brands = competitorBrandTokens(reports.map((r) => r.domain))
  const isBranded = (phrase: string) => brands.some((b) => phrase.includes(b))

  const candidates = new Map<string, string>() // phrase -> competitor domain
  let brandedSkipped = 0
  for (const report of reports) {
    for (const t of report.topics ?? []) {
      const phrase = toKeywordPhrase(t.topic ?? "")
      if (!phrase || candidates.has(phrase)) continue
      // A rival's brand is not a keyword we can target.
      if (isBranded(phrase)) {
        brandedSkipped++
        continue
      }
      candidates.set(phrase, report.domain)
    }
  }
  if (brandedSkipped > 0) {
    console.info(`[seo] skipped ${brandedSkipped} competitor-branded phrase(s) while mining`)
  }
  if (candidates.size === 0)
    return { ...empty, competitors: reports.length, error: "No usable phrases found in the crawl." }

  // Attach real numbers where we already get impressions for a mined phrase.
  const latest = await db.seoSnapshot.findFirst({
    where: { propertyId },
    orderBy: { periodEnd: "desc" },
    select: { id: true },
  })
  const ourQueries = latest
    ? await db.seoQueryStat.findMany({
        where: { snapshotId: latest.id },
        select: { query: true, impressions: true, clicks: true, position: true, ctr: true },
      })
    : []
  const byQuery = new Map(ourQueries.map((q) => [q.query.toLowerCase(), q]))

  const brandLabel = property.domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(".")[0]
  const brandTerms = [...property.moneyKeywords, brandLabel ?? ""].filter(Boolean)

  const existing = await db.seoKeyword.findMany({
    where: { propertyId },
    select: { id: true, query: true, winnable: true, businessValue: true, source: true },
  })
  const existingByQuery = new Map(existing.map((e) => [e.query.toLowerCase(), e]))

  let added = 0
  let updated = 0
  let withDemandData = 0

  for (const [phrase, competitor] of candidates) {
    const ours = byQuery.get(phrase)
    if (ours) withDemandData++

    const prior = existingByQuery.get(phrase)
    // Rows from Search Console keep that provenance.
    if (prior && prior.source === "GSC") continue

    const impressions = ours?.impressions ?? 0
    const position = ours?.position ?? 0
    const winnable = prior?.winnable ?? null
    const businessValue = prior?.businessValue ?? 3
    const score = scoreKeyword({
      impressions,
      position,
      winnable,
      businessValue,
      demandUnknown: !ours,
    })
    const intent = classifyIntent(phrase, brandTerms)

    if (prior) {
      await db.seoKeyword.update({
        where: { id: prior.id },
        data: {
          impressions,
          clicks: ours?.clicks ?? 0,
          position,
          ctr: ours?.ctr ?? 0,
          intent,
          score,
          source: "COMPETITOR",
          sourceDomain: competitor,
        },
      })
      updated++
    } else {
      await db.seoKeyword.create({
        data: {
          propertyId,
          query: phrase,
          impressions,
          clicks: ours?.clicks ?? 0,
          position,
          ctr: ours?.ctr ?? 0,
          intent,
          businessValue,
          score,
          status: "BACKLOG",
          source: "COMPETITOR",
          sourceDomain: competitor,
        },
      })
      added++
    }
  }

  return {
    added,
    updated,
    total: await db.seoKeyword.count({ where: { propertyId } }),
    withDemandData,
    competitors: reports.length,
  }
}

/** Update a keyword's human fields and recompute its score. */
export async function updateKeyword(
  propertyId: string,
  keywordId: string,
  patch: {
    winnable?: boolean | null
    businessValue?: number
    intent?: KeywordIntent
    status?: string
    notes?: string | null
  },
): Promise<boolean> {
  const kw = await db.seoKeyword.findFirst({
    where: { id: keywordId, propertyId },
    select: {
      id: true,
      impressions: true,
      position: true,
      winnable: true,
      businessValue: true,
      source: true,
    },
  })
  if (!kw) return false

  const winnable = patch.winnable === undefined ? kw.winnable : patch.winnable
  const businessValue = patch.businessValue ?? kw.businessValue
  const score = scoreKeyword({
    impressions: kw.impressions,
    position: kw.position,
    winnable,
    businessValue,
    // Keep the mined-keyword floor, or marking it winnable would drop its score to 0.
    demandUnknown: kw.source === "COMPETITOR" && kw.impressions === 0,
  })

  await db.seoKeyword.update({
    where: { id: kw.id },
    data: {
      ...(patch.winnable === undefined ? {} : { winnable: patch.winnable }),
      ...(patch.businessValue === undefined ? {} : { businessValue: patch.businessValue }),
      ...(patch.intent === undefined ? {} : { intent: patch.intent }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      ...(patch.notes === undefined ? {} : { notes: patch.notes }),
      score,
    },
  })
  return true
}

export interface KeywordView {
  id: string
  query: string
  impressions: number
  clicks: number
  position: number
  ctr: number
  intent: string
  winnable: boolean | null
  businessValue: number
  score: number
  status: string
  taskId: string | null
  notes: string | null
  /** GSC (real query data) | COMPETITOR (mined from their pages) | MANUAL. */
  source: string
  sourceDomain: string | null
}

/** The backlog for a site, highest priority first. */
export async function getKeywordBacklog(propertyId: string): Promise<KeywordView[]> {
  const rows = await db.seoKeyword.findMany({
    where: { propertyId },
    orderBy: [{ score: "desc" }, { impressions: "desc" }],
    take: 500,
    select: {
      id: true,
      query: true,
      impressions: true,
      clicks: true,
      position: true,
      ctr: true,
      intent: true,
      winnable: true,
      businessValue: true,
      score: true,
      status: true,
      taskId: true,
      notes: true,
      source: true,
      sourceDomain: true,
    },
  })
  return rows
}
