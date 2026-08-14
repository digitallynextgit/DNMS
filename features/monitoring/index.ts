// Public API for the "monitoring" feature (CLAUDE.md §1, rule #2).
// Server-only modules (server/*.service) are intentionally NOT re-exported -
// API routes import those directly, so nothing drags `server-only` into a
// client bundle. Same rule as features/projects.

export {
  ASSET_KINDS,
  ASSET_KIND_LABELS,
  assetSchema,
  monitorSchema,
  type AssetInput,
  type MonitorInput,
} from "./schemas/monitoring.schema"

export { ProjectMonitoringTab } from "./components/project-monitoring-tab"
