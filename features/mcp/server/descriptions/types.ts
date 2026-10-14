// What the AI connector tells Claude / ChatGPT about each DNMS endpoint.
//
// Kept HERE, not in route comments: a comment cleanup once stripped the comments
// from 321 route files and the AI lost the ability to find most endpoints by
// meaning ("change the account manager" matched the mailer's SMTP accounts).
// descriptions.test.ts fails when a route has no entry, so a new route cannot
// ship without the AI being told what it does.
//
// Pure data - no imports - because scripts/generate-mcp-api-map.ts reads it too.

export interface EndpointDescription {
  /**
   * One or two plain sentences: what it does and whose data it covers. Use the
   * words people actually say ("account manager", "approve leave", "payslip"),
   * not just code names.
   */
  summary: string
  /** Query parameters with meaning and format, e.g. "status: PENDING|APPROVED; from, to: YYYY-MM-DD; page, limit (max 100)". */
  query?: string
  /** Body fields with type and required/optional, e.g. "{ accountManagerId?: employee id, status?: ACTIVE|ON_HOLD }". */
  body?: string
  /** Extra search words people might use for this (synonyms, old names). */
  keywords?: string[]
  /** Side effects and cautions: sends email, notifies people, irreversible, returns a file (use dnms_download), etc. */
  notes?: string
}

/** Keyed by "METHOD /api/path/[param]", exactly as in the route catalogue. */
export type DescriptionMap = Record<string, EndpointDescription>
