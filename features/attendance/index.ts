// Public API for the "attendance" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service-style, emails, IO clients) are
// intentionally NOT re-exported here - API routes import those directly.
export * from "./components/attendance-filters"
export * from "./components/attendance-table"
export * from "./components/device-form-dialog"
export * from "./components/manual-attendance-dialog"
export * from "./components/floating-requests-inbox"
export * from "./hooks/use-attendance"
export * from "./attendance"

// Disambiguate export* clash (component wins over hook-exported filter type)
export { AttendanceFilters } from "./components/attendance-filters"
