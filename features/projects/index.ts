// Public API for the "projects" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service-style, emails, IO clients) are
// intentionally NOT re-exported here - API routes import those directly.
export * from "./components/activity-tab"
export * from "./components/brand-tab"
export * from "./components/drive-tab"
export * from "./components/integration-tab"
export * from "./components/insights-tab"
export * from "./components/messages-tab"
export * from "./components/passwords-tab"
export * from "./components/project-form-dialog"
export * from "./components/resources-tab"
export * from "./components/task-detail-sheet"
export * from "./components/tasks-tab"
export * from "./components/teams-tab"
export * from "./hooks/use-projects"
export * from "./hooks/use-brand"
export * from "./hooks/use-project-drive"
export * from "./hooks/use-integration"
export * from "./brand"

export { formatHours } from "./lib/format-hours"
