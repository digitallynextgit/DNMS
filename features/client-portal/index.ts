// Public API for the "client-portal" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
//
// NOTE: server-only modules (server/*.service, server/*.queries, emails) are
// intentionally NOT re-exported here - API routes and server components import
// those directly. The Clients tab is rendered from a CLIENT component
// (app/(dashboard)/projects/[id]/page.tsx), so anything reachable through this
// barrel is pulled into the browser bundle; re-exporting a service would drag
// `import "server-only"` in with it and fail the build. Same rule as
// features/projects/index.ts.

// Module registry - client-safe, no server imports.
export {
  CLIENT_MODULES,
  resolveModules,
  isClientModule,
  moduleByKey,
  type ClientModule,
  type ClientModuleKey,
} from "./modules"

// Schemas (zod only - safe on both sides).
export {
  projectClientCreateSchema,
  projectClientUpdateSchema,
  projectClientResetSchema,
  clientPasswordSchema,
  productListQuerySchema,
  type ProjectClientCreateInput,
  type ProjectClientUpdateInput,
  type ProjectClientResetInput,
  type ClientPasswordInput,
  type ProductListQuery,
} from "./schemas/client-portal.schema"

// Components
export { ClientLoginForm } from "./components/client-login-form"
export { ClientSetPasswordForm } from "./components/client-set-password-form"
export { PortalSidebar, type PortalProject } from "./components/portal-sidebar"
export { PortalTopbar } from "./components/portal-topbar"
export { PortalMobileTabbar } from "./components/portal-mobile-tabbar"
export { PortalProductGrid } from "./components/portal-product-grid"
export { PortalActivityLog } from "./components/portal-activity-log"
export { ProjectClientsTab } from "./components/project-clients-tab"
