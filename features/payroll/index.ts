// Public API for the "payroll" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service-style, emails, IO clients) are
// intentionally NOT re-exported here — API routes import those directly.
export * from "./components/generate-payroll-dialog"
export * from "./components/payroll-filters"
export * from "./components/payslip-view"
export * from "./components/salary-structure-form"
export * from "./hooks/use-payroll"
export * from "./payroll"

// Disambiguate export* clash (component wins over hook-exported filter type)
export { PayrollFilters } from "./components/payroll-filters"
