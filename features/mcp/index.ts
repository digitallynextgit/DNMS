// Public API for the "mcp" feature - the AI connector (CLAUDE.md §1, rule #2).
// Server modules (features/mcp/server/*) are NOT re-exported here - routes
// import those directly, same as every other feature.
export { AiConnectionsClient } from "./components/ai-connections-client"
export { ConsentCard } from "./components/consent-card"
export * from "./constants"
