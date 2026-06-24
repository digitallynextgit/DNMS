// Public API for the "auth" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service-style, emails, IO clients) are
// intentionally NOT re-exported here — API routes import those directly.
export * from "./components/account-deactivated"
export * from "./components/auth-shell"
export * from "./components/change-password-form"
export * from "./components/login-form"
export * from "./schemas/auth.schema"
export * from "./server/auth.actions"
