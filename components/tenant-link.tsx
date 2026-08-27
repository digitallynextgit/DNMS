"use client"

import NextLink from "next/link"
import { usePathname } from "next/navigation"
import { createContext, forwardRef, useContext, useMemo } from "react"
import { splitTenant, withTenant } from "@/lib/tenant-url"
import type { ComponentProps, ReactNode } from "react"

// =============================================================================
// <Link> that keeps you inside your tenant (M3).
//
// A drop-in replacement for next/link. Change the import and every href in the
// file - static, template literal, or computed at runtime - starts emitting
// /{tenant}/... :
//
//   -import Link from "next/link"
//   +import { Link } from "@/components/tenant-link"
//
// That is why this is a wrapper rather than a `tenantPath()` call at each href:
// there are ~120 hrefs across ~40 files, many built at runtime, so prefixing at
// RENDER time is both far less code and impossible to forget in a branch nobody
// reviewed.
//
// ── WHY THE SLUG COMES FROM A PROVIDER, NOT usePathname() ────────────────────
// proxy.ts serves /{tenant}/projects by REWRITING it to /projects. So the two
// halves of a render disagree about the URL: the server renders the rewritten
// path, the browser's address bar still shows the prefix. Deriving the slug from
// `usePathname()` would therefore produce href="/projects" on the server and
// href="/digitallynext/projects" after hydration - a mismatch on every link in
// the app.
//
// The layout reads the tenant from the request (server/tenant-request.ts) and
// passes it down, so both halves render the same string. Outside a provider the
// slug is null and every href is left exactly as written, which is what the
// marketing site and the sign-in pages want.
//
// Nothing here is a security boundary. It shapes URLs; proxy.ts decides who may
// load them.
// =============================================================================

const TenantContext = createContext<string | null>(null)

/** Supplies the current tenant to every link below it. Set once, in a layout. */
export function TenantProvider({ slug, children }: { slug: string | null; children: ReactNode }) {
  return <TenantContext.Provider value={slug}>{children}</TenantContext.Provider>
}

/** The tenant this subtree belongs to, or null outside a provider. */
export function useTenantSlug(): string | null {
  return useContext(TenantContext)
}

/**
 * The tenant-aware path, for the places that need a string rather than a link:
 * `router.push()`, `window.open()`, a `formAction`.
 *
 * ```ts
 * const tp = useTenantPath()
 * router.push(tp(`/projects/${id}`))
 * ```
 */
export function useTenantPath(): (path: string) => string {
  const slug = useContext(TenantContext)
  return useMemo(() => (path: string) => withTenant(path, slug), [slug])
}

/**
 * The pathname WITHOUT the tenant prefix - the inverse of useTenantPath().
 *
 * Use this, never bare usePathname(), to decide which nav item is active.
 *
 * ── THE BUG THIS EXISTS TO PREVENT ───────────────────────────────────────────
 * The same rewrite described above cuts the other way. `usePathname()` returns
 * the path the SERVER rendered ("/dashboard") but the browser's own URL after
 * hydration ("/digitallynext/dashboard"). Nav items are declared un-prefixed, so
 * a comparison against usePathname() matched on the server and then stopped
 * matching on the client: every sidebar item highlighted correctly in the HTML
 * and went dark the instant React took over. It looked like the highlight had
 * never worked at all.
 *
 * Stripping the slug gives "/dashboard" on both halves - stable across
 * hydration, and comparable with the hrefs as written.
 *
 * Safe outside a tenant: splitTenant() only removes a leading segment that could
 * be a slug, so /login and / are returned unchanged.
 */
export function useAppPathname(): string {
  const pathname = usePathname()
  return useMemo(() => splitTenant(pathname ?? "/").rest, [pathname])
}

type NextLinkProps = ComponentProps<typeof NextLink>

export const Link = forwardRef<HTMLAnchorElement, NextLinkProps>(function Link(
  { href, ...props },
  ref,
) {
  const slug = useContext(TenantContext)
  return (
    <NextLink
      ref={ref}
      href={typeof href === "string" ? withTenant(href, slug) : href}
      {...props}
    />
  )
})

export default Link
