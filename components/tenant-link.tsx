"use client"

import NextLink from "next/link"
import { usePathname } from "next/navigation"
import { createContext, forwardRef, useContext, useMemo } from "react"
import { splitTenant, withTenant } from "@/lib/tenant-url"
import type { ComponentProps, ReactNode } from "react"

// Drop-in next/link that prefixes hrefs with the tenant slug at render time.
// The slug comes from a provider, not usePathname(): proxy.ts rewrites /{tenant}/x to /x, so
// usePathname() differs between server and client and would cause hydration mismatches.

const TenantContext = createContext<string | null>(null)

export function TenantProvider({ slug, children }: { slug: string | null; children: ReactNode }) {
  return <TenantContext.Provider value={slug}>{children}</TenantContext.Provider>
}

export function useTenantSlug(): string | null {
  return useContext(TenantContext)
}

/** For places that need a string, not a link: router.push(), window.open(), formAction. */
export function useTenantPath(): (path: string) => string {
  const slug = useContext(TenantContext)
  return useMemo(() => (path: string) => withTenant(path, slug), [slug])
}

/**
 * The pathname without the tenant prefix. Use this, not usePathname(), for active-nav checks:
 * usePathname() changes between server render and hydration because of the proxy rewrite.
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
