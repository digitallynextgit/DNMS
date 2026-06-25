// Public API for the "employees" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service-style, emails, IO clients) are
// intentionally NOT re-exported here - API routes import those directly.
export * from "./components/employee-admin-actions"
export * from "./components/employee-card"
export * from "./components/employee-combobox"
export * from "./components/employee-filters"
export * from "./components/employee-form"
export * from "./components/employee-leave-tab"
export * from "./components/employee-salary-tab"
export * from "./components/manage-roles-dialog"
export * from "./components/org-chart-tree"
export * from "./components/profile-self-actions"
export * from "./components/section-edit-dialogs"
export * from "./hooks/use-employees"
export * from "./schemas/employee.schema"
export * from "./server/departments.actions"
export * from "./server/designations.actions"
export * from "./server/employees.actions"
export * from "./probation"

// Disambiguate export* clash (component wins over hook-exported filter type)
export { EmployeeFilters } from "./components/employee-filters"
