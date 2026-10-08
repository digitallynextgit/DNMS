import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { withTenant } from "@/lib/tenant-url"
import { auth } from "@/server/auth"
import { enterTenant, FOUNDING_TENANT_SLUG } from "@/server/tenant-context"
import type { Session } from "next-auth"

// `x-tenant-slug` is written only by proxy.ts. Use it to build URLs and show the company -
// NEVER to decide what data someone may see; that comes from the session's tenant.

/** Null wherever there is no session (marketing site, sign-in pages). */
export const currentTenantSlug = cache(async (): Promise<string | null> => {
  const h = await headers()
  return h.get("x-tenant-slug")
})

/** TRANSITIONAL, for URL-building only: falls back to the founding tenant. */
export async function currentTenantSlugOrFounding(): Promise<string> {
  return (await currentTenantSlug()) ?? FOUNDING_TENANT_SLUG
}

/** Server-side counterpart of components/tenant-link.tsx; non-app paths are returned untouched. */
export async function tenantPath(path: string): Promise<string> {
  return withTenant(path, await currentTenantSlugOrFounding())
}

/**
 * For SERVER COMPONENTS, which never pass through getSession(): the session with the tenant
 * context entered. A page that reads the DB must call this instead of auth().
 */
export const tenantScopedSession = cache(async (): Promise<Session | null> => {
  const session = (await auth()) as Session | null
  if (session?.user?.tenantId && session.user.tenantSlug) {
    enterTenant({ tenantId: session.user.tenantId, slug: session.user.tenantSlug })
  }
  return session
})
