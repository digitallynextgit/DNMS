import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { withTenant } from "@/lib/tenant-url"
import { auth } from "@/server/auth"
import { enterTenant, FOUNDING_TENANT_SLUG } from "@/server/tenant-context"
import type { Session } from "next-auth"

// =============================================================================
// Which tenant is this request for? (M3)
//
// proxy.ts resolves the tenant once per request - checking the URL prefix
// against the session - and writes the answer to `x-tenant-slug`. It also
// DELETES any inbound value of that header on every request, so what arrives
// here was written by the proxy or is absent. Nothing else may set it.
//
// ── WHAT THIS IS AND IS NOT FOR ──────────────────────────────────────────────
// FOR: building URLs, and showing the reader which company they are in.
//
// NOT FOR: deciding what data someone may see. That comes from the session's
// membership - `session.user.tenantId` - and in M4 from the tenant context the
// data layer enforces. A header is the right shape for "what should this link
// look like" and the wrong shape for "whose payroll is this".
// =============================================================================

/**
 * The current request's tenant slug, or null.
 *
 * Null on the marketing site, on the sign-in pages, and anywhere there is no
 * session - all of which are legitimately tenant-less, which is why this
 * returns null rather than throwing.
 *
 * `cache()` keeps it to one `headers()` read per request no matter how many
 * components ask.
 */
export const currentTenantSlug = cache(async (): Promise<string | null> => {
  const h = await headers()
  return h.get("x-tenant-slug")
})

/**
 * The slug, falling back to Digitally Next.
 *
 * TRANSITIONAL, and for URL-building only. Until every internal link is
 * prefixed, a server component can render before the proxy has had reason to
 * set the header (an un-prefixed legacy path is redirected, but the redirect
 * costs a round trip). Falling back keeps the link correct today, because there
 * is exactly one tenant. Delete in M4 alongside `currentTenantIdOrFounding()`.
 */
export async function currentTenantSlugOrFounding(): Promise<string> {
  return (await currentTenantSlug()) ?? FOUNDING_TENANT_SLUG
}

/**
 * Prefix an app path with the current tenant - the server-side counterpart of
 * the `<Link>` wrapper in components/tenant-link.tsx.
 *
 * Use it for `redirect()` targets and for any href built in a server component.
 * Non-app paths (/login, /api/..., "/") are returned untouched.
 */
export async function tenantPath(path: string): Promise<string> {
  return withTenant(path, await currentTenantSlugOrFounding())
}

/**
 * The session, with the tenant context established - for SERVER COMPONENTS (M4).
 *
 * Pages and layouts render outside every route wrapper, so they never reach
 * `getSession()` in server/api-handler.ts and would otherwise query with no
 * tenant. A page that reads the database directly must call THIS instead of
 * `auth()`.
 *
 * The tenant comes from the SESSION, not from the `x-tenant-slug` header: the
 * header is right for building a URL and wrong for deciding what data someone
 * may see. proxy.ts has already proven the two agree.
 *
 * `cache()` means the session is decoded once per request however many
 * components ask; entering the context repeatedly with the same value is a
 * no-op anyway.
 */
export const tenantScopedSession = cache(async (): Promise<Session | null> => {
  const session = (await auth()) as Session | null
  if (session?.user?.tenantId && session.user.tenantSlug) {
    enterTenant({ tenantId: session.user.tenantId, slug: session.user.tenantSlug })
  }
  return session
})
