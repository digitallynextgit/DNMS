import "server-only"

import { db } from "@/server/db"

// =============================================================================
// The keyword backlog (plan step 4). Turns stored Search Console queries into a
// prioritized work-queue, scored by demand x winnability x business value.
//
// The score is deliberately transparent, not a black box:
//   score = demand(impressions) x positionOpportunity x winnability x value
// so a human can see WHY one keyword outranks another and adjust the two human
// inputs (winnable?, businessValue) to re-rank.
// =============================================================================

export type KeywordIntent = "commercial" | "informational" | "branded" | "navigational" | "other"

/** Cheap, transparent intent guess from the query words. A human can override it. */
export function classifyIntent(query: string, brandTerms: string[]): KeywordIntent {
  const q = query.toLowerCase()
  // Branded first - a brand term anywhere makes it a brand query.
  if (brandTerms.some((b) => b && q.includes(b.toLowerCase()))) return "branded"

  // Commercial / transactional signals.
  if (
    /\b(buy|price|cost|cheap|deal|discount|coupon|for sale|near me|best|top|vs|versus|review|reviews|agency|agencies|company|companies|service|services|provider|hire|quote|pricing|plans?)\b/.test(
      q,
    )
  )
    return "commercial"

  // Informational signals.
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

/**
 * Position opportunity: the plan's "fastest available wins" are positions 5-20
 * (striking distance) - already relevant to Google, close enough that on-page
 * work moves them onto page one. Page-one-but-not-top has some headroom;
 * anything past 30 is a long haul.
 */
function positionOpportunity(position: number): number {
  if (position === 0) return 0.3 // unknown / not ranking
  if (position >= 5 && position <= 20) return 1.0 // striking distance
  if (position > 20 && position <= 30) return 0.7
  if (position < 5) return 0.4 // already near the top - less to gain
  return 0.3 // 30+
}

/**
 * The priority score. Winnable=null (unassessed) uses a neutral 0.6 so a fresh
 * backlog is still ranked sensibly by demand + opportunity; a human decision
 * then pushes it up (winnable) or nearly out (not winnable).
 */
export function scoreKeyword(k: {
  impressions: number
  position: number
  winnable: boolean | null
  businessValue: number
  /**
   * True when we have no impression data for this phrase, which is the normal
   * case for a keyword mined from a competitor's pages. Without a floor those
   * rows score log10(1) = 0 and sink out of sight, so a competitor's entire
   * keyword map would be invisible. The floor is deliberately low (worth about
   * 10 impressions) so anything with proven demand still outranks it.
   */
  demandUnknown?: boolean
}): number {
  // Log-scale demand so a 10,000-impression query doesn't drown everything else.
  const demand = k.demandUnknown && k.impressions === 0 ? 1 : Math.log10(k.impressions + 1) // 0 .. ~5
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
 * (Re)generate the backlog from the latest snapshot's queries. Existing rows keep
 * their human fields (winnable, businessValue, status, notes) and only refresh
 * their Search Console signals + recomputed score. New queries are inserted.
 * Nothing is deleted - a query that drops out of the latest window stays as
 * history until a human parks it.
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

  // Brand terms for intent classification: the money keywords plus the domain's
  // second-level label (e.g. "knowyourgenes").
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

// =============================================================================
// Mining keywords from competitors (plan step 5, point 3: "their titles/H1s ARE
// their keyword map").
//
// What this can honestly do: read the page titles and headings we already
// crawled from each competitor and treat them as the phrases that competitor is
// targeting. Where the same phrase also appears in OUR Search Console queries we
// attach the real impressions and position, because that is measured fact.
//
// What it deliberately does NOT do: invent search volume, or claim a competitor's
// ranking position. Neither is available for free, and a fabricated number in a
// client report is worse than an absent one. Rows with no demand data are stored
// with impressions 0 and flagged in the UI as unverified so a human checks them.
// =============================================================================

/** Phrases that are page furniture rather than a keyword anyone searches. */
const NOT_A_KEYWORD =
  /^(home|about( us)?|contact( us)?|blog|news|careers|privacy|terms|login|sign in|sign up|menu|search|faqs?|cookie|newsletter|subscribe|follow us|share|read more|back to top|all rights reserved)$/i

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

/**
 * Turn the latest competitor crawl into backlog candidates. Requires a
 * competitor analysis to have been run first (that is what does the crawling).
 */
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

  // Best phrase per competitor, deduped across competitors (first one wins, so
  // the earliest configured competitor is credited).
  const candidates = new Map<string, string>() // phrase -> competitor domain
  for (const report of reports) {
    for (const t of report.topics ?? []) {
      const phrase = toKeywordPhrase(t.topic ?? "")
      if (phrase && !candidates.has(phrase)) candidates.set(phrase, report.domain)
    }
  }
  if (candidates.size === 0)
    return { ...empty, competitors: reports.length, error: "No usable phrases found in the crawl." }

  // Our own Search Console queries, so a mined phrase we already get impressions
  // for carries its real numbers instead of a blank.
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
    // A row that already came from Search Console keeps that provenance: it is
    // backed by real data, and downgrading it to "mined" would lose that.
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
    // Keep the mined-keyword floor. Without this a competitor keyword with no
    // impressions would drop to score 0 the moment someone marked it winnable,
    // which is the opposite of what they meant.
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
