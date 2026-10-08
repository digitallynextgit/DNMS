// Public API for the clients feature. Server-only modules are not re-exported: the pages are
// client components, and a service here would pull server-only code into the browser bundle.

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
