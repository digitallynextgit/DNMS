import "server-only"

import { FOUNDING_TENANT_ID, FOUNDING_TENANT_SLUG, runWithTenant } from "@/server/tenant-context"
import type { TenantContext } from "@/server/tenant-context"

// =============================================================================
// The tenant behind a PUBLIC, key-authenticated API call.
//
// /api/public/* has no session - the marketing site and the mailer's <img> tags
// are not signed in - so the tenant cannot come from a cookie or a URL prefix.
// It comes from the API KEY, which is exactly the design: pages are path-scoped,
// APIs are token-scoped.
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
// Because it was missing, and production found out. These routes queried
// tenant-scoped models with no tenant context; under TENANT_ENFORCEMENT=strict
// the guard refused, and because none of them had an error funnel the throw
// escaped the handler:
//
//   ⨯ Error: [TENANT] refusing CareerGroup.findMany with no tenant context.
//
// The health sweep never caught it: /api/public/* needs an API key, so every
// probe stopped at 401 before reaching a query.
//
// ── TODAY vs LATER ───────────────────────────────────────────────────────────
// There is ONE key per API family, in the environment, so every keyed call
// belongs to the founding tenant. That is correct while Digitally Next is the
// only customer with a careers site or a project mailer.
//
// When a second customer needs one, the key has to carry the tenant: an
// `api_keys` table (tenantId, hash, scope), and this function becomes a lookup.
// The routes below do not change - they already ask this question rather than
// assuming the answer, which is the whole point of routing it through here.
// =============================================================================

/** The tenant a valid public API key currently resolves to. */
export function publicApiTenant(): TenantContext {
  return { tenantId: FOUNDING_TENANT_ID, slug: FOUNDING_TENANT_SLUG }
}

/**
 * Run a public API handler's work inside its tenant.
 *
 * Call it AFTER the key has been verified - this establishes scope, it does not
 * authenticate.
 */
export function inPublicApiTenant<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(publicApiTenant(), fn)
}
