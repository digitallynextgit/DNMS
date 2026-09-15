// Public API for the "hr-checklists" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// NOTE: server-only modules (server/*.service.ts, server/*.queries.ts) are
// intentionally NOT re-exported here - API routes import those directly.
export * from "./components/checklist-view"
export * from "./components/checklist-item-row"
export * from "./components/checklist-progress-bar"
export * from "./components/sign-clearance-dialog"
export * from "./hooks/use-checklists"
export * from "./types"
// Pure rules + the seed data, safe on both sides of the wire.
export * from "./lib/checklist-rules"
export {
  DEFAULT_CHECKLIST_TEMPLATES,
  DEFAULT_ONBOARDING_TEMPLATE,
  DEFAULT_EXIT_TEMPLATE,
} from "./lib/default-templates"
export * from "./schemas/checklist.schema"
