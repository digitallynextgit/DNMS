// Public API for the "work-reports" feature (CLAUDE.md §1, rule #2).
// Server modules are not re-exported; API routes import them directly.
export { WorkReportClient } from "./components/work-report-client"
export { useWorkReportScope } from "./hooks/use-work-report-scope"
export type { WorkReportFormat, WorkReportScopeData } from "./types"
