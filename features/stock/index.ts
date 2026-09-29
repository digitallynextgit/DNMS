// Public API for the "stock" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
// Server modules (server/stock.service.ts) are NOT re-exported - API routes
// import those directly, same as every other feature.
export { StockClient } from "./components/stock-client"
