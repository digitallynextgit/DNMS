import "server-only"

import { db } from "@/server/db"
import { aiComplete, AI_MODEL_SMART } from "@/lib/ai"

// =============================================================================
// AI assistance for SEO configuration (the "ask AI for help" affordances).
//
// Every prompt is GROUNDED in data we actually hold - the site's real Search
// Console queries and page titles - rather than asking the model to invent a
// business from a domain name. That keeps suggestions checkable: each returned
// keyword either echoes a query the site already gets impressions for, or is a
// close variant a human can verify in one incognito search.
//
// Nothing here writes to the database. The model proposes; a human picks what to
// keep in the UI and saves it through the normal site-settings route. That
// matters - auto-applying AI guesses to a client's tracked keywords would put
// unreviewed machine output straight into client reporting.
// =============================================================================

/** Grounding facts pulled from what we already know about the site. */
async function siteContext(propertyId: string) {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      domain: true,
      label: true,
      moneyKeywords: true,
      competitors: true,
      project: { select: { name: true, description: true } },
    },
  })
  if (!property) return null

  const latest = await db.seoSnapshot.findFirst({
    where: { propertyId },
    orderBy: { periodEnd: "desc" },
    select: { id: true },
  })

  let queries: { query: string; impressions: number; position: number }[] = []
  let pages: string[] = []
  if (latest) {
    const [q, p] = await Promise.all([
      db.seoQueryStat.findMany({
        where: { snapshotId: latest.id },
        orderBy: { impressions: "desc" },
        take: 40,
        select: { query: true, impressions: true, position: true },
      }),
      db.seoPageStat.findMany({
        where: { snapshotId: latest.id },
        orderBy: { clicks: "desc" },
        take: 15,
        select: { page: true },
      }),
    ])
    queries = q
    pages = p.map((x) => x.page)
  }

  // What our competitors publish. Their titles and headings are the phrases they
  // target, which is a real signal about the market even though it says nothing
  // about how well they rank.
  const audit = await db.seoCompetitorAudit.findFirst({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
    select: { competitors: true },
  })
  const competitorTopics: string[] = []
  for (const report of (audit?.competitors ?? []) as unknown as {
    domain: string
    topics?: { topic: string }[]
  }[]) {
    for (const t of (report.topics ?? []).slice(0, 15)) {
      if (t?.topic) competitorTopics.push(`${t.topic} (${report.domain})`)
    }
  }

  return { property, queries, pages, competitorTopics }
}

export interface KeywordSuggestion {
  keyword: string
  /** commercial | informational | branded | navigational */
  intent: string
  /** Why this one - the model's justification, shown to the human. */
  reason: string
  /** True when the site already gets impressions for it (safest picks). */
  fromSearchConsole: boolean
}

/**
 * Propose money keywords for a site. Real Search Console queries are offered
 * first (they are facts, not guesses); the model adds close commercial variants
 * and explains each. Returns [] rather than throwing when there is nothing to
 * ground on, so the caller can show a "sync first" hint.
 */
export async function suggestKeywords(propertyId: string): Promise<KeywordSuggestion[]> {
  const ctx = await siteContext(propertyId)
  if (!ctx) return []

  const { property, queries, pages, competitorTopics } = ctx
  const knownQueries = queries.map((q) => q.query).filter(Boolean)

  const system = [
    "You are an SEO strategist choosing a site's MONEY KEYWORDS: the small set of",
    "commercial-intent terms the business should be judged on.",
    "Rules:",
    "- Prefer terms the site already gets impressions for (these are provided).",
    "- Competitor page titles are also provided. They show what the market targets, so a",
    "  recurring competitor theme is good evidence, but say so in the reason.",
    "- Money keywords are commercial/transactional, not brand names and not generic one-word heads.",
    "- Never invent services the evidence does not support.",
    "- Return 6-10 keywords maximum.",
    'Respond ONLY as JSON: {"keywords":[{"keyword":"...","intent":"commercial|informational|branded|navigational","reason":"one short sentence","fromSearchConsole":true|false}]}',
  ].join("\n")

  const user = [
    `Site: ${property.domain} (${property.label})`,
    property.project?.name ? `Client/project: ${property.project.name}` : "",
    property.project?.description ? `About: ${property.project.description}` : "",
    knownQueries.length
      ? `Real Search Console queries (highest impressions first):\n${knownQueries.slice(0, 40).join("\n")}`
      : "No Search Console queries are available yet - infer cautiously from the domain and pages.",
    pages.length ? `Top pages:\n${pages.slice(0, 12).join("\n")}` : "",
    property.moneyKeywords.length
      ? `Already tracked (do not repeat): ${property.moneyKeywords.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  const out = await aiComplete<{ keywords?: KeywordSuggestion[] }>({
    system,
    user,
    model: AI_MODEL_SMART,
    json: true,
    maxTokens: 900,
    temperature: 0.2,
  })

  const known = new Set(knownQueries.map((q) => q.toLowerCase()))
  const existing = new Set(property.moneyKeywords.map((k) => k.toLowerCase()))

  return (out.keywords ?? [])
    .filter((k) => k?.keyword && !existing.has(k.keyword.toLowerCase()))
    .slice(0, 10)
    .map((k) => ({
      keyword: String(k.keyword).trim(),
      intent: String(k.intent ?? "commercial"),
      reason: String(k.reason ?? ""),
      // Trust our own data over the model's self-report.
      fromSearchConsole: known.has(String(k.keyword).trim().toLowerCase()),
    }))
}

export interface CompetitorSuggestion {
  domain: string
  reason: string
}

/**
 * Propose competitor domains. The model is explicitly told to return only real,
 * well-known sites and to skip marketplaces/directories (Amazon, Justdial…),
 * which rank for everything and make a useless comparison. A human still
 * confirms each by incognito-searching the money keywords - that's plan step 5.
 */
export async function suggestCompetitors(propertyId: string): Promise<CompetitorSuggestion[]> {
  const ctx = await siteContext(propertyId)
  if (!ctx) return []

  const { property, queries } = ctx

  const system = [
    "You are an SEO analyst identifying a website's ORGANIC SEARCH COMPETITORS:",
    "sites competing for the same commercial queries.",
    "Rules:",
    "- Return only real, existing websites you are confident about. Bare domains only (no https://, no paths).",
    "- Exclude marketplaces, aggregators and directories (Amazon, Flipkart, IndiaMART, Justdial, Yelp, Wikipedia).",
    "- Exclude the site itself and its own subdomains.",
    "- Prefer direct business competitors in the same country/market.",
    "- Return 3-5 domains maximum. If unsure, return fewer.",
    'Respond ONLY as JSON: {"competitors":[{"domain":"example.com","reason":"one short sentence"}]}',
  ].join("\n")

  const user = [
    `Site: ${property.domain} (${property.label})`,
    property.project?.name ? `Client/project: ${property.project.name}` : "",
    property.project?.description ? `About: ${property.project.description}` : "",
    property.moneyKeywords.length ? `Money keywords: ${property.moneyKeywords.join(", ")}` : "",
    queries.length
      ? `Queries this site ranks for:\n${queries
          .slice(0, 25)
          .map((q) => q.query)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  const out = await aiComplete<{ competitors?: CompetitorSuggestion[] }>({
    system,
    user,
    model: AI_MODEL_SMART,
    json: true,
    maxTokens: 600,
    temperature: 0.2,
  })

  const self = property.domain.replace(/^www\./, "").toLowerCase()
  const existing = new Set(property.competitors.map((c) => c.toLowerCase()))

  return (out.competitors ?? [])
    .map((c) => ({
      domain: String(c?.domain ?? "")
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
        .toLowerCase(),
      reason: String(c?.reason ?? ""),
    }))
    .filter(
      (c) =>
        c.domain && c.domain.includes(".") && !c.domain.endsWith(self) && !existing.has(c.domain),
    )
    .slice(0, 5)
}

/**
 * Explain a site's current SEO position in plain language: what the numbers say,
 * what to do first, and why. Grounded in the stored scorecard + latest snapshot
 * so it describes THIS site rather than generic advice.
 */
export async function explainSeo(propertyId: string): Promise<string> {
  const ctx = await siteContext(propertyId)
  if (!ctx) return ""

  const { property, queries } = ctx
  const card = await db.seoScorecard.findFirst({
    where: { propertyId },
    orderBy: { periodEnd: "desc" },
    select: { score: true, coverage: true, band: true, metrics: true },
  })
  const audit = await db.seoTechnicalAudit.findFirst({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
    select: { criticalCount: true, warningCount: true, pagesChecked: true },
  })

  const metrics =
    (card?.metrics as unknown as {
      label: string
      points: number
      weight: number
      available: boolean
      note: string
    }[]) ?? []

  const system = [
    "You are a senior SEO consultant briefing a busy account manager.",
    "Explain what the data says, then give 3 concrete next actions in priority order.",
    "Be specific and honest: if coverage is low, say the score is provisional and what to connect.",
    "No preamble, no markdown headers. Under 200 words. Plain sentences and short bullets.",
  ].join("\n")

  const user = [
    `Site: ${property.domain}`,
    card
      ? `Scorecard: ${card.score}/100 (${card.band}), measured on ${card.coverage} of 100 points of weight.`
      : "No scorecard has been generated yet.",
    metrics.length
      ? `Metrics:\n${metrics.map((m) => `- ${m.label}: ${m.available ? `${m.points}/${m.weight}` : "NO DATA"} - ${m.note}`).join("\n")}`
      : "",
    audit
      ? `Technical audit: ${audit.criticalCount} critical, ${audit.warningCount} warnings across ${audit.pagesChecked} pages.`
      : "No technical audit yet.",
    queries.length
      ? `Top queries: ${queries
          .slice(0, 10)
          .map((q) => `${q.query} (pos ${q.position.toFixed(1)})`)
          .join("; ")}`
      : "No Search Console queries yet.",
  ]
    .filter(Boolean)
    .join("\n\n")

  return aiComplete<string>({
    system,
    user,
    model: AI_MODEL_SMART,
    maxTokens: 500,
    temperature: 0.3,
  })
}
