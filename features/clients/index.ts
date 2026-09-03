// Public API for the "clients" feature (CLAUDE.md §1, rule #2).
// Cross-feature & app imports use THIS barrel; internals stay private.
//
// NOTE: server-only modules (server/*.queries, *.service, client-access) are
// intentionally NOT re-exported here - API routes and layouts import those
// directly. The pages are client components, so anything reachable through this
// barrel is pulled into the browser bundle; a service would drag
// `import "server-only"` in with it and fail the build.

export { ClientsDirectory } from "./components/clients-directory"
export { ClientDetail } from "./components/client-detail"
export {
  ClientFormDialog,
  type ClientFormValues,
  type SavedClient,
} from "./components/client-form-dialog"
export { ClientCombobox } from "./components/client-combobox"
export {
  useClients,
  useClient,
  useClientActivity,
  clientKeys,
  type ClientListItem,
  type ClientRecord,
  type ClientProject,
  type ClientContact,
  type ClientGrant,
  type ClientActivityEvent,
  type ClientBookSummary,
  type ClientListParams,
} from "./hooks/use-clients"
export { clientHref } from "./lib/client-href"
export {
  clientCreateSchema,
  clientUpdateSchema,
  clientListQuerySchema,
  CLIENT_STATUSES,
  type ClientCreateInput,
  type ClientUpdateInput,
  type ClientListQuery,
  type ClientStatusValue,
} from "./schemas/client.schema"
