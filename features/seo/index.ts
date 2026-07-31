// Public API for the "seo" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service, server/*.queries, lib/gsc) are
// intentionally NOT re-exported here - API routes import those directly.
export * from "./components/seo-tab"
export * from "./components/project-sites-card"
export * from "./components/scorecard-panel"
export * from "./components/technical-panel"
export * from "./components/keyword-backlog"
export * from "./components/competitor-panel"
export * from "./components/content-brief-panel"
export * from "./components/backlinks-panel"
export * from "./components/monitor-status"
export * from "./components/setup-guide"
export * from "./components/ai-suggest-dialog"
export * from "./components/seo-toolbar"
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
  TechnicalAuditView,
  TechnicalPageAudit,
  TechnicalIssue,
  KeywordView,
  CompetitorAuditView,
  CompetitorReportView,
  CompetitorGapView,
  ContentBriefView,
  BriefQa,
  BriefQaCheck,
  BacklinkSummaryView,
  ReferringDomainView,
  MonitorView,
  MonitorIssueView,
  SetupStateView,
  SetupStepView,
  SetupAction,
  KeywordSuggestionView,
  CompetitorSuggestionView,
} from "./types"
