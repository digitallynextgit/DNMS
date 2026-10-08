import "server-only"

import { FOUNDING_TENANT_ID, FOUNDING_TENANT_SLUG, runWithTenant } from "@/server/tenant-context"
import type { TenantContext } from "@/server/tenant-context"

/**
 * The tenant behind a key-authenticated /api/public/* call (no session). There is one key per
 * API family today, so it is the founding tenant; with per-tenant keys this becomes a lookup.
 */
export function publicApiTenant(): TenantContext {
  return { tenantId: FOUNDING_TENANT_ID, slug: FOUNDING_TENANT_SLUG }
}

/** Call AFTER the key is verified - this sets scope, it does not authenticate. */
export function inPublicApiTenant<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(publicApiTenant(), fn)
}

/**
 * The company whose marketing site this is. Kept separate from publicApiTenant(): it stays the
 * founding tenant however many customers sign up, while the key lookup will not.
 */
export function marketingTenant(): TenantContext {
  return { tenantId: FOUNDING_TENANT_ID, slug: FOUNDING_TENANT_SLUG }
}

export function inMarketingTenant<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(marketingTenant(), fn)
}
