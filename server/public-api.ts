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

// =============================================================================
// The tenant behind the PUBLIC MARKETING SITE.
//
// Separate from publicApiTenant() above even though both resolve to the same
// id today, because the JUSTIFICATION is different and they will diverge:
//
//   publicApiTenant()    - "whichever tenant this API key belongs to". Becomes a
//                          lookup the moment a second customer gets a key.
//   marketingTenant()    - "the company whose marketing site this is". The site
//                          at dnms.digitallynext.com shows Digitally Next's own
//                          holidays and its own attendance board. That stays the
//                          founding tenant however many customers sign up.
//
// Collapsing them into one helper would mean the key lookup silently changed
// what the homepage displays.
//
// WHY IT WAS NEEDED: /api/marketing/* had no session and no tenant context, so
// under TENANT_ENFORCEMENT=strict the guard refused and the throw escaped:
//
//   [UNHANDLED] Error: [TENANT] refusing Holiday.findMany with no tenant context.
//
// It went unnoticed because those routes were not in PUBLIC_PREFIXES either, so
// a signed-out visitor got 401 before reaching a query. Fixing the 401 exposed
// the missing scope underneath it.
// =============================================================================

/** The tenant whose data the public marketing site renders. */
export function marketingTenant(): TenantContext {
  return { tenantId: FOUNDING_TENANT_ID, slug: FOUNDING_TENANT_SLUG }
}

/** Run a public marketing route's work inside the marketing tenant. */
export function inMarketingTenant<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(marketingTenant(), fn)
}
