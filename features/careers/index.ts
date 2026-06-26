// Public API for the "careers" feature. The server service (server/careers.service.ts)
// is imported directly by route handlers and is intentionally NOT re-exported here.
export { CareersManager } from "./components/careers-manager"
export * from "./hooks/use-careers"
export * from "./careers.types"
