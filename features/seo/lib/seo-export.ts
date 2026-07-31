"use client"

import { downloadCsv, toCsv } from "@/lib/export-csv"
import type {
  BacklinkSummaryView,
  CompetitorAuditView,
  ContentBriefView,
  KeywordView,
  ScorecardView,
  SeoOverview,
  SeoRollup,
  TechnicalAuditView,
} from "../types"

// =============================================================================
// Report exports. Every SEO tab can hand its data to a client and this is where
// the shape of each file is defined - one builder per tab, all going through the
// shared toCsv/downloadCsv helpers so escaping stays consistent.
//
// CSV rather than PDF on purpose: these are working files an account manager
// pastes into a client deck or a spreadsheet, not a finished document.
// =============================================================================

const stamp = () => new Date().toISOString().slice(0, 10)

/** Safe filename fragment from a site label/domain. */
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "site"

const pct = (v: number) => `${(v * 100).toFixed(2)}%`

function save(name: string, header: string[], rows: (string | number | null)[][]) {
  downloadCsv(toCsv(rows, header), `${name}-${stamp()}.csv`)
}

export function exportOverview(o: SeoOverview) {
  const site = slug(o.config.label || o.config.domain)
  const rows: (string | number | null)[][] = [
    ["Period", o.period ? `${o.period.start} to ${o.period.end}` : "no data", "", "", ""],
    [
      "Clicks",
      o.clicks.current,
      o.clicks.comparable ? o.clicks.previous : "",
      o.clicks.comparable ? o.clicks.change : "",
      "",
    ],
    [
      "Impressions",
      o.impressions.current,
      o.impressions.comparable ? o.impressions.previous : "",
      o.impressions.comparable ? o.impressions.change : "",
      "",
    ],
    ["CTR", pct(o.ctr.current), "", "", ""],
    [
      "Avg position",
      o.position.current.toFixed(1),
      o.position.comparable ? o.position.previous.toFixed(1) : "",
      "",
      "",
    ],
    [],
    ["TOP QUERIES", "Clicks", "Impressions", "CTR", "Position"],
    ...o.topQueries.map((q) => [q.key, q.clicks, q.impressions, pct(q.ctr), q.position.toFixed(1)]),
    [],
    ["STRIKING DISTANCE", "Clicks", "Impressions", "CTR", "Position"],
    ...o.strikingDistance.map((q) => [
      q.key,
      q.clicks,
      q.impressions,
      pct(q.ctr),
      q.position.toFixed(1),
    ]),
    [],
    ["TOP PAGES", "Clicks", "Impressions", "CTR", "Position"],
    ...o.topPages.map((p) => [p.key, p.clicks, p.impressions, pct(p.ctr), p.position.toFixed(1)]),
  ]
  save(`seo-overview-${site}`, ["Metric", "Value", "Previous", "Change", "Extra"], rows)
}

export function exportKeywords(rows: KeywordView[], siteLabel: string) {
  save(
    `seo-backlog-${slug(siteLabel)}`,
    [
      "Keyword",
      "Intent",
      "Impressions",
      "Clicks",
      "Position",
      "CTR",
      "Winnable",
      "Business value",
      "Score",
      "Status",
      "Notes",
    ],
    rows.map((k) => [
      k.query,
      k.source === "COMPETITOR" ? "Competitor" : "Search Console",
      k.sourceDomain ?? "",
      k.intent,
      k.source === "COMPETITOR" && k.impressions === 0 ? "no data" : k.impressions,
      k.clicks,
      k.position.toFixed(1),
      pct(k.ctr),
      k.winnable === null ? "not assessed" : k.winnable ? "yes" : "no",
      k.businessValue,
      k.score.toFixed(2),
      k.status,
      k.notes ?? "",
    ]),
  )
}

export function exportTechnical(audit: TechnicalAuditView, siteLabel: string) {
  const rows: (string | number | null)[][] = [
    ["SUMMARY", "", "", ""],
    ["Pages checked", audit.pagesChecked, "", ""],
    ["Critical issues", audit.criticalCount, "", ""],
    ["Warnings", audit.warningCount, "", ""],
    ["sitemap.xml", audit.sitemapOk ? "OK" : "ISSUE", `${audit.sitemapUrls} URLs`, ""],
    ["robots.txt", audit.robotsOk ? "OK" : "ISSUE", "", ""],
    [],
    ["SITE ISSUES", "Level", "Code", "Detail"],
    ...audit.siteIssues.map((i) => ["", i.level, i.code, i.detail]),
    [],
    ["PAGE", "HTTP", "Title", "Issues"],
    ...audit.pages.map((p) => [
      p.url,
      p.status,
      p.title ?? "",
      p.issues.map((i) => `${i.level}: ${i.detail}`).join(" | "),
    ]),
  ]
  save(`seo-technical-${slug(siteLabel)}`, ["Item", "A", "B", "C"], rows)
}

export function exportCompetitors(audit: CompetitorAuditView, siteLabel: string) {
  save(
    `seo-content-gaps-${slug(siteLabel)}`,
    ["Gap topic", "Competitor", "Their page", "Their title"],
    audit.gaps.map((g) => [g.topic, g.competitor, g.sourceUrl, g.sampleTitle ?? ""]),
  )
}

export function exportBriefs(briefs: ContentBriefView[], siteLabel: string) {
  save(
    `seo-content-${slug(siteLabel)}`,
    [
      "Target query",
      "Intent",
      "Status",
      "Published URL",
      "Published",
      "QA score",
      "Position at publish",
      "Position after 30d",
      "Outcome",
      "Outline",
    ],
    briefs.map((b) => [
      b.targetQuery,
      b.intent,
      b.status,
      b.publishedUrl ?? "",
      b.publishedAt ? b.publishedAt.slice(0, 10) : "",
      b.qa?.score ?? "",
      b.baselinePosition?.toFixed(1) ?? "",
      b.reviewPosition?.toFixed(1) ?? "",
      b.reviewOutcome ?? "",
      b.outline.join(" | "),
    ]),
  )
}

export function exportBacklinks(data: BacklinkSummaryView, siteLabel: string) {
  const rows: (string | number | null)[][] = [
    ["SUMMARY", "", "", ""],
    ["Referring domains", data.referringDomains, "", ""],
    ["Active links", data.totalActive, "", ""],
    ["New domains (28d)", data.newDomains28d, "", ""],
    ["Lost links", data.totalLost, "", ""],
    [],
    ["REFERRING DOMAIN", "Links", "Domain rating", "First seen"],
    ...data.domains.map((d) => [d.domain, d.links, d.domainRating ?? "", d.firstSeen.slice(0, 10)]),
  ]
  save(`seo-backlinks-${slug(siteLabel)}`, ["Item", "A", "B", "C"], rows)
}

export function exportScorecard(card: ScorecardView, siteLabel: string) {
  const rows: (string | number | null)[][] = [
    ["Score", card.score, "", "", ""],
    ["Band", card.band, "", "", ""],
    ["Coverage", `${card.coverage} of 100`, "", "", ""],
    ["Period", `${card.periodStart} to ${card.periodEnd}`, "", "", ""],
    [],
    ["METRIC", "Weight", "Points", "Measured", "Detail"],
    ...card.metrics.map((m) => [
      m.label,
      m.weight,
      m.available ? m.points : "",
      m.available ? "yes" : "NO DATA",
      m.note,
    ]),
  ]
  save(`seo-scorecard-${slug(siteLabel)}`, ["Item", "A", "B", "C", "D"], rows)
}

export function exportRollup(r: SeoRollup) {
  const rows: (string | number | null)[][] = [
    ["TOTALS", "", "", "", ""],
    ["Clicks", r.totals.clicks.current, r.totals.clicks.previous, "", ""],
    ["Impressions", r.totals.impressions.current, r.totals.impressions.previous, "", ""],
    ["CTR", pct(r.totals.ctr), "", "", ""],
    ["Avg position", r.totals.position.current.toFixed(1), "", "", ""],
    [],
    ["SITE", "Domain", "Clicks", "Impressions", "CTR", "Avg position", "Open tasks", "Last synced"],
    ...r.properties.map((p) => [
      p.label,
      p.domain,
      p.period ? p.clicks.current : "",
      p.period ? p.impressions.current : "",
      p.period ? pct(p.ctr) : "",
      p.period ? p.position.current.toFixed(1) : "",
      p.openTasks,
      p.lastSyncedAt ? p.lastSyncedAt.slice(0, 10) : "never",
    ]),
    [],
    ["ALERTS", "Site", "Level", "Detail", ""],
    ...r.alerts.map((a) => [a.title, a.property, a.level, a.detail, ""]),
  ]
  save("seo-rollup-all-sites", ["Item", "A", "B", "C", "D", "E", "F", "G"], rows)
}
