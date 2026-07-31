export interface SeoConfig {
  id: string
  projectId: string
  label: string
  isPrimary: boolean
  domain: string
  siteUrl: string | null
  gaPropertyId: string | null
  moneyKeywords: string[]
  /** The 5 to 10 pages that actually earn. Audits and vitals run against these. */
  moneyPages: string[]
  competitors: string[]
  targetClicks: number | null
  targetPosition: number | null
  isActive: boolean
  lastSyncedAt: string | null
  lastSyncError: string | null
}

export interface SeoMetrics {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/** A metric with its previous-period comparison. `changePct` is null when the
 *  previous period is zero (growth from nothing is not a percentage).
 *
 * `comparable` is false when there IS no previous snapshot - a site synced for
 * the first time has nothing to compare against, and rendering `change` then
 * would show a made-up swing (e.g. avg position "dropping" from 0 to 14.2). */
export interface SeoDelta {
  current: number
  previous: number
  change: number
  changePct: number | null
  comparable: boolean
}

export interface SeoRowStat extends SeoMetrics {
  key: string
  /** Previous-period clicks/position for the same key, when we have them. */
  prevClicks: number | null
  prevPosition: number | null
}

export interface SeoOverview {
  config: SeoConfig
  /** Latest snapshot window, or null if nothing has been synced yet. */
  period: { start: string; end: string } | null
  previousPeriod: { start: string; end: string } | null
  clicks: SeoDelta
  impressions: SeoDelta
  ctr: SeoDelta
  position: SeoDelta
  topQueries: SeoRowStat[]
  topPages: SeoRowStat[]
  /** Money keywords from the config, matched against the latest snapshot. */
  moneyKeywords: (SeoRowStat & { tracked: boolean })[]
  /** Queries ranking 8-30: the fastest wins, per the SEO plan. */
  strikingDistance: SeoRowStat[]
  /** Chronological clicks/impressions per snapshot, for the trend chart. */
  trend: { periodEnd: string; clicks: number; impressions: number; position: number }[]
  alerts: SeoAlert[]
  snapshotCount: number
  /** Open work tagged to this site, so the report answers "what are we actually
   *  doing about it?" alongside the numbers. */
  tasks: SeoSiteTask[]
  /** Every stored week, newest first, so the UI can offer a period picker. */
  availablePeriods: { start: string; end: string }[]
  /** How many weeks the numbers above cover. */
  weeks: number
}

export interface SeoAlert {
  level: "critical" | "warning" | "info"
  title: string
  detail: string
}

/** An open task scoped to one tracked site. */
export interface SeoSiteTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  assigneeName: string | null
}

/** One tracked site inside the roll-up. Totals only - the per-keyword detail
 *  lives in that site's own overview, so the roll-up stays cheap with 13 sites. */
export interface SeoPropertySummary {
  id: string
  label: string
  domain: string
  isPrimary: boolean
  isActive: boolean
  lastSyncedAt: string | null
  lastSyncError: string | null
  period: { start: string; end: string } | null
  clicks: SeoDelta
  impressions: SeoDelta
  position: SeoDelta
  ctr: number
  alerts: SeoAlert[]
  /** Work currently open against this site (not Completed/Discarded). */
  openTasks: number
  overdueTasks: number
}

/** Every site on a project, plus the combined numbers across them. */
export interface SeoRollup {
  projectId: string
  properties: SeoPropertySummary[]
  totals: {
    clicks: SeoDelta
    impressions: SeoDelta
    /** Impression-weighted across sites - a plain average would let a tiny
     *  subdomain swing the whole account's number. */
    position: SeoDelta
    ctr: number
  }
  /** Actionable alerts across all sites, each tagged with the site it came from. */
  alerts: (SeoAlert & { property: string; propertyId: string })[]
  /** Latest window that has data on any site. */
  period: { start: string; end: string } | null
}

export interface ScorecardMetricView {
  key: string
  label: string
  weight: number
  available: boolean
  value: number | null
  previous: number | null
  ratio: number | null
  points: number
  note: string
}

export interface ScorecardView {
  id: string
  periodStart: string
  periodEnd: string
  score: number
  /** Share of the 100 points that could actually be measured. */
  coverage: number
  band: "HEALTHY" | "WATCH" | "INTERVENE" | "ESCALATE"
  metrics: ScorecardMetricView[]
}

export interface VitalsView {
  id: string
  url: string
  formFactor: string
  /** CRUX_FIELD = real users (the ranking signal); PSI_LAB = a simulation. */
  source: string
  lcpMs: number | null
  inpMs: number | null
  cls: number | null
  performanceScore: number | null
  verdict: "GOOD" | "NEEDS_IMPROVEMENT" | "POOR" | null
  checkedAt: string
}

export interface TechnicalIssue {
  level: "critical" | "warning" | "info"
  code: string
  detail: string
}

export interface TechnicalPageAudit {
  url: string
  status: number
  ok: boolean
  title: string | null
  titleLength: number
  h1Count: number
  metaDescription: string | null
  canonical: string | null
  noindex: boolean
  schemaTypes: string[]
  imagesMissingAlt: number
  internalLinks: number
  issues: TechnicalIssue[]
}

export interface TechnicalAuditView {
  id: string
  pagesChecked: number
  criticalCount: number
  warningCount: number
  sitemapOk: boolean
  robotsOk: boolean
  sitemapUrls: number
  pages: TechnicalPageAudit[]
  siteIssues: TechnicalIssue[]
  createdAt: string
}

export interface KeywordView {
  id: string
  query: string
  impressions: number
  clicks: number
  position: number
  ctr: number
  intent: string
  /** null = not yet assessed by a human. */
  winnable: boolean | null
  businessValue: number
  score: number
  status: string
  taskId: string | null
  notes: string | null
  /** GSC means real Search Console data. COMPETITOR means mined from a rival's
   *  pages, so there is no demand figure behind it unless we rank for it too. */
  source: string
  sourceDomain: string | null
}

// --- phase 4: competitor gap analysis ---------------------------------------

export interface CompetitorReportView {
  domain: string
  ok: boolean
  pagesCrawled: number
  topics: { topic: string; url: string; title: string | null }[]
}

export interface CompetitorGapView {
  topic: string
  sampleTitle: string | null
  competitor: string
  sourceUrl: string
}

export interface CompetitorAuditView {
  id: string
  competitorsChecked: number
  ourPagesChecked: number
  gapCount: number
  competitors: CompetitorReportView[]
  gaps: CompetitorGapView[]
  createdAt: string
}

// --- phase 5: content brief + QA loop ---------------------------------------

export interface BriefQaCheck {
  id: string
  label: string
  ok: boolean
  detail: string
}

export interface BriefQa {
  checkedAt: string
  url: string
  pass: boolean
  score: number
  checks: BriefQaCheck[]
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
  qa: BriefQa | null
  baselinePosition: number | null
  reviewAt: string | null
  reviewPosition: number | null
  reviewOutcome: string | null
  createdAt: string
  updatedAt: string
}

// --- step 8: off-page / backlinks -------------------------------------------

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
  newDomains28d: number
  domains: ReferringDomainView[]
  lastImportAt: string | null
}

// --- step 9: daily accident monitor -----------------------------------------

export interface MonitorIssueView {
  url: string
  level: "critical"
  code: string
  detail: string
}

export interface MonitorView {
  status: "OK" | "ISSUES"
  pagesOk: number
  pagesTotal: number
  issues: MonitorIssueView[]
  checkedAt: string
}

// --- guided setup + AI assistance --------------------------------------------

export type SetupAction =
  | "EDIT_SITE"
  | "SYNC"
  | "KEYWORDS"
  | "COMPETITORS"
  | "TECHNICAL"
  | "VITALS"
  | "BACKLINKS"
  | "SCORECARD"

/** The one setting an EDIT_SITE step opens. */
export type SetupField = "identity" | "gsc" | "keywords" | "pages" | "competitors" | "ga4"

export interface SetupStepView {
  id: string
  title: string
  description: string
  done: boolean
  optional: boolean
  impact: string
  action: SetupAction
  field?: SetupField
  aiAssist?: "keywords" | "competitors"
}

export interface SetupStateView {
  steps: SetupStepView[]
  completed: number
  total: number
  percent: number
  nextStepId: string | null
  /** Scorecard points currently unmeasurable because of missing configuration. */
  lockedPoints: number
}

export interface KeywordSuggestionView {
  keyword: string
  intent: string
  reason: string
  /** True when the site already gets impressions for it - the safest picks. */
  fromSearchConsole: boolean
}

export interface CompetitorSuggestionView {
  domain: string
  reason: string
}
