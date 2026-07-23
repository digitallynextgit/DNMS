export interface SeoConfig {
  id: string
  projectId: string
  label: string
  isPrimary: boolean
  domain: string
  siteUrl: string | null
  gaPropertyId: string | null
  moneyKeywords: string[]
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
