// Public API for the "seo" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service, server/*.queries, lib/gsc) are
// intentionally NOT re-exported here - API routes import those directly.
export * from "./components/seo-tab"
export * from "./components/project-sites-card"
export * from "./components/scorecard-panel"
export * from "./components/site-form-dialog"
export * from "./hooks/use-seo"
export type {
  SeoAlert,
  SeoConfig,
  SeoDelta,
  SeoMetrics,
  SeoOverview,
  SeoPropertySummary,
  SeoRollup,
  SeoRowStat,
  SeoSiteTask,
  ScorecardView,
  ScorecardMetricView,
  VitalsView,
} from "./types"
