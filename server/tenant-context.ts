import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"

// =============================================================================
// Tenant context (M1 - spine).
//
// The one place code learns which tenant a request belongs to. Entered ONCE per
// request and read everywhere below it, so no service, query or job takes a
// tenantId parameter and none can silently forget one.
//
// WHERE CONTEXT IS ENTERED (all of these arrive in M4, none is wired yet):
//   - server/api-handler.ts getSession()  - covers every wrapper family at once
//   - a React cache()-based accessor      - for server components, which render
//                                           outside any wrapper
//   - explicitly, by name: SSE routes, file routes, cron/scheduler tenant loops,
//     the device webhook and the public API (context comes from the verified
//     slug, never from an unverified URL segment)
//
// STATUS: this module is deliberately UNUSED so far. M1 only establishes the
// column and this plumbing; enforcement (the Prisma extension, RLS, the guard
// rescope) lands in M4. Adopting it early is safe - `runWithTenant` is a pure
// wrapper - but nothing may yet ASSUME a context exists, because most call
// paths do not have one.
// =============================================================================

/** Digitally Next - the founding tenant. Matches the DB default set in
 *  migration 20260825000000_tenant_spine and the schema's dbgenerated default. */
export const FOUNDING_TENANT_ID = "0197d1ab-0000-7000-8000-000000000001"
export const FOUNDING_TENANT_SLUG = "digitallynext"

export interface TenantContext {
  tenantId: string
  slug: string
}

// =============================================================================
// THE STORES ARE PINNED TO globalThis, AND THAT IS LOAD-BEARING.
//
// The bundler splits server code into chunks and can instantiate this module
// more than once - the auth callbacks land in one chunk, the Prisma extension in
// another. Two module instances means two AsyncLocalStorage objects, and then
// `runUnscoped()` writes to one while the tenant guard reads the other. The
// guard sees no context and refuses a query that was correctly declared:
//
//   [auth][cause]: Error: [TENANT] refusing Membership.findMany with no tenant
//   context.        ← thrown from inside loadActiveMemberships, which IS wrapped
//
// That broke sign-in completely: it is the one flow with no session yet, so the
// `x-tenant-id` header fallback in tenant-guard.ts is not there to paper over it.
// Every other path kept working, which is exactly why it took a real login to
// surface.
//
// server/db.ts pins the Prisma client and the pg Pool to globalThis for the same
// reason. One instance per process, whatever the bundler does.
// =============================================================================
const globalForTenant = globalThis as unknown as {
  dnmsTenantStorage?: AsyncLocalStorage<TenantContext>
  dnmsUnscopedStorage?: AsyncLocalStorage<string>
}

const storage: AsyncLocalStorage<TenantContext> = (globalForTenant.dnmsTenantStorage ??=
  new AsyncLocalStorage<TenantContext>())

/**
 * Run `fn` with `tenant` as the ambient context for everything it awaits.
 *
 * The `await fn()` matters and is not a tidy-up. A Prisma call is LAZY - it
 * returns a thenable and does no work until something awaits it. Written as
 * `storage.run(tenant, fn)`, a caller passing `() => db.x.count()` would hand
 * the promise straight back out and the query would execute after the store had
 * gone, silently unscoped. Awaiting inside keeps the work in the context.
 */
export function runWithTenant<T>(tenant: TenantContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(tenant, async () => await fn())
}

/**
 * Set the tenant for the CURRENT execution and everything after it, without
 * wrapping a callback (M4).
 *
 * `runWithTenant` needs to own the continuation, which suits a route wrapper but
 * not `getSession()` - that returns a session and the caller carries on. There
 * is one entry point for both API routes and server actions, and this is what
 * lets it be the place context is established.
 *
 * Safe here because Node gives every request its own async resource tree: the
 * store set inside one request's handler is invisible to any other. Do NOT call
 * it from module scope, where "the current execution" is the whole process.
 */
export function enterTenant(tenant: TenantContext): void {
  storage.enterWith(tenant)
}

// -----------------------------------------------------------------------------
// Deliberately cross-tenant work.
//
// A few operations MUST see every tenant, and saying so out loud is the point:
//
//   - signing in - which companies does this person belong to? The answer is
//     the thing being looked up, so it cannot be scoped by it.
//   - the platform console, which administers tenants
//   - cron jobs, which loop over tenants and enter each one in turn
//
// Without this the tenant guard would either block them (strict) or let them
// pass unremarked (warn), and the second is worse: an unscoped query that is
// correct looks exactly like one that is a bug.
// -----------------------------------------------------------------------------
// Pinned to globalThis for the same reason as `storage` above - and this is the
// one that actually broke sign-in when it was not.
const unscoped: AsyncLocalStorage<string> = (globalForTenant.dnmsUnscopedStorage ??=
  new AsyncLocalStorage<string>())

/**
 * Run `fn` with tenant scoping deliberately OFF. `reason` shows up in logs.
 *
 * Awaits inside the store for the same reason as `runWithTenant` above - a lazy
 * Prisma promise handed back out would execute with the hatch already closed,
 * which for THIS function means a sign-in query silently getting scoped and
 * finding nothing.
 */
export function runUnscoped<T>(reason: string, fn: () => Promise<T>): Promise<T> {
  return unscoped.run(reason, async () => await fn())
}

/** Why the current execution is running unscoped, or null if it is not. */
export function unscopedReason(): string | null {
  return unscoped.getStore() ?? null
}

/** The active tenant, or null outside any context. */
export function currentTenant(): TenantContext | null {
  return storage.getStore() ?? null
}

/**
 * The active tenant id, or throw.
 *
 * Use this in NEW code that must never run unscoped. Absence of a tenant is an
 * error, never "all tenants" - that distinction is the whole isolation
 * guarantee, and a silent fallback would be a cross-tenant read waiting to
 * happen.
 */
export function requireTenantId(): string {
  const store = storage.getStore()
  if (!store) {
    throw new Error(
      "No tenant context. Enter one with runWithTenant() - see server/tenant-context.ts for the list of entry points.",
    )
  }
  return store.tenantId
}

/**
 * TRANSITIONAL: the active tenant id, falling back to Digitally Next.
 *
 * The bridge between M1 and M4. Existing code paths have no context yet, and
 * every existing row belongs to the founding tenant, so the fallback is correct
 * TODAY and only today. It logs once per process so the remaining unscoped
 * paths are visible in the logs rather than invisible in the code.
 *
 * Delete this function in M4. If it still has callers then, they are the list
 * of paths that were never scoped.
 */
let warned = false
export function currentTenantIdOrFounding(): string {
  const store = storage.getStore()
  if (store) return store.tenantId
  if (!warned) {
    warned = true
    console.warn("[TENANT] running without a tenant context - falling back to the founding tenant")
  }
  return FOUNDING_TENANT_ID
}
