import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"

// The request's tenant, entered once per request so no service takes a tenantId parameter.

// Defined in lib/tenant-url.ts (client-safe); re-exported for server imports.
import { FOUNDING_TENANT_ID, FOUNDING_TENANT_SLUG } from "@/lib/tenant-url"
export { FOUNDING_TENANT_ID, FOUNDING_TENANT_SLUG }

export interface TenantContext {
  tenantId: string
  slug: string
}

// Pinned to globalThis on purpose: the bundler can load this module twice (auth chunk vs
// Prisma chunk), and with two stores runUnscoped() writes one while the guard reads the other.
const globalForTenant = globalThis as unknown as {
  dnmsTenantStorage?: AsyncLocalStorage<TenantContext>
  dnmsUnscopedStorage?: AsyncLocalStorage<string>
}

const storage: AsyncLocalStorage<TenantContext> = (globalForTenant.dnmsTenantStorage ??=
  new AsyncLocalStorage<TenantContext>())

/**
 * The inner `await` matters: Prisma calls are lazy, so a returned promise would run after the
 * store is gone, silently unscoped.
 */
export function runWithTenant<T>(tenant: TenantContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(tenant, async () => await fn())
}

/**
 * Set the tenant for the rest of the current execution, for callers like getSession() that
 * can't wrap a callback. Safe per request; NEVER call it at module scope.
 */
export function enterTenant(tenant: TenantContext): void {
  storage.enterWith(tenant)
}

// Deliberately cross-tenant work (sign-in, platform console, cron tenant loops) declares itself,
// so a correct unscoped query never looks like a bug.
const unscoped: AsyncLocalStorage<string> = (globalForTenant.dnmsUnscopedStorage ??=
  new AsyncLocalStorage<string>())

/** Tenant scoping deliberately OFF; `reason` shows up in logs. Awaits inside, as above. */
export function runUnscoped<T>(reason: string, fn: () => Promise<T>): Promise<T> {
  return unscoped.run(reason, async () => await fn())
}

export function unscopedReason(): string | null {
  return unscoped.getStore() ?? null
}

export function currentTenant(): TenantContext | null {
  return storage.getStore() ?? null
}

/** Throws without a context - a missing tenant must never mean "all tenants". */
export function requireTenantId(): string {
  const store = storage.getStore()
  if (!store) {
    throw new Error("No tenant context. Wrap the call in runWithTenant().")
  }
  return store.tenantId
}
