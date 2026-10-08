// Public API. Client-safe only: the Contacts tab renders from a client component, so server
// modules (services, queries, emails) are imported directly, never re-exported here.

export {
  CLIENT_MODULES,
  resolveModules,
  isClientModule,
  moduleByKey,
  type ClientModule,
  type ClientModuleKey,
} from "./modules"

export {
  clientPasswordSchema,
  productListQuerySchema,
  clientContactCreateSchema,
  clientContactUpdateSchema,
  clientContactResetSchema,
  clientGrantCreateSchema,
  clientGrantUpdateSchema,
  type ClientPasswordInput,
  type ProductListQuery,
  type ClientContactCreateInput,
  type ClientContactUpdateInput,
  type ClientContactResetInput,
  type ClientGrantCreateInput,
  type ClientGrantUpdateInput,
} from "./schemas/client-portal.schema"

export {
  clientPlanCreateSchema,
  clientPlanLinkSchema,
  clientPlanStatusSchema,
  type ClientPlanCreateInput,
  type ClientPlanLinkInput,
  type ClientPlanStatusInput,
} from "./schemas/plan.schema"

export { ClientSetPasswordForm } from "./components/client-set-password-form"
export { PortalSidebar, type PortalProject } from "./components/portal-sidebar"
export { PortalTopbar } from "./components/portal-topbar"
export { PortalMobileTabbar } from "./components/portal-mobile-tabbar"
export { PortalProductGrid } from "./components/portal-product-grid"
export { PortalDocuments } from "./components/portal-documents"
export { PortalPlan } from "./components/portal-plan"
export { PortalCalendars } from "./components/portal-calendars"
export { PortalActivityLog } from "./components/portal-activity-log"
export {
  ClientContactsTab,
  type ContactRow,
  type ContactGrant,
  type ContactProjectOption,
} from "./components/client-contacts-tab"
