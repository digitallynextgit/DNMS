// Public API for the "settings" feature (CLAUDE.md §1, rule #2).
// Server resolver (server/app-config.ts) is imported directly by server code;
// it is intentionally NOT re-exported here.
export * from "./components/integrations-form"
export * from "./hooks/use-settings"
export * from "./settings.registry"
