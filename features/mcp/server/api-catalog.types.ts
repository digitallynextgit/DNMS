// Types for the generated API catalogue (api-routes.generated.ts).

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface ApiMethodInfo {
  /** The route's own doc comment, e.g. "?status=&employeeId= - list leave requests". */
  doc?: string
  /** Query parameters the handler reads. */
  query?: string[]
  /** Body fields, from an inline type or the zod schema the service validates with. */
  body?: string
  /** DNMS permission scopes the route requires (withAuth). */
  permissions?: string[]
  /** The wrapper guarding it (withAuth, withSession, withProjectManager, ...). */
  guard?: string
  /** Expects multipart/form-data (a file upload) - not callable through MCP. */
  upload?: true
}

export interface ApiRouteEntry {
  /** e.g. "/api/projects/[id]/tasks" */
  path: string
  methods: Partial<Record<HttpMethod, ApiMethodInfo>>
  load: () => Promise<unknown>
}
