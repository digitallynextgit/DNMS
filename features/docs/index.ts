// Public API for the "docs" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service-style, emails, IO clients) are
// intentionally NOT re-exported here - API routes import those directly.
export * from "./components/guide-content"
export * from "./components/guide-section"
export * from "./components/guides/admin-guide"
export * from "./components/guides/attendance-guide"
export * from "./components/guides/documents-guide"
export * from "./components/guides/employees-guide"
export * from "./components/guides/getting-started"
export * from "./components/guides/leave-guide"
export * from "./components/guides/payroll-guide"
export * from "./components/info-table"
export * from "./components/role-badge"
export * from "./components/step-list"
export * from "./components/tip-box"
