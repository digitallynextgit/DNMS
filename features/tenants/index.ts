// Public API for the "tenants" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: provision.service.ts is server-only and deliberately NOT re-exported -
// the platform console and the scripts import it directly.
export * from "./components/signup-form"
export * from "./schemas/signup.schema"
export * from "./plans"
