// Public API for the "admin" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service-style, emails, IO clients) are
// intentionally NOT re-exported here — API routes import those directly.
export * from "./components/email-template-form"
export * from "./components/role-form"
export * from "./hooks/use-permissions"
export * from "./schemas/email-template.schema"
