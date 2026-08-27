// =============================================================================
// The tenant URL space (M3).
//
//   dnms.digitallynext.com/{tenant}/dashboard
//   dnms.digitallynext.com/{tenant}/projects/abc
//   dnms.digitallynext.com/{tenant}/portal/xyz
//
// Pages are PATH-scoped; APIs are TOKEN-scoped and stay at /api/... with no
// prefix, because an API caller (the mobile app, a webhook) proves its tenant
// with its credential, not with a URL segment.
//
// NO framework or server imports: proxy.ts runs this on the EDGE, client
// components run it in the browser, and server components run it in Node. It is
// pure string handling on purpose - anything needing the database belongs in
// server/tenants.ts, which builds on this file.
//
// SECURITY: nothing here authenticates anything. A slug in a URL is a claim.
// proxy.ts is what checks that claim against the session before letting the
// request through, and it is the only place allowed to conclude anything from it.
// =============================================================================

/**
 * The first path segments that belong to the authenticated app and therefore
 * live under a tenant. Mirrors the folders in `app/(dashboard)/` plus the client
 * portal.
 *
 * An ALLOW-list, not a deny-list: a new public or platform route added later is
 * left alone by default. The failure mode of a miss here is an un-prefixed URL
 * (cosmetic, and proxy.ts redirects it to the canonical form anyway), whereas
 * the failure mode of a deny-list miss would be a broken public link.
 */
export const TENANT_SCOPED_SEGMENTS: ReadonlySet<string> = new Set([
  "admin",
  "analytics",
  "announcements",
  "attendance",
  "chat",
  "dashboard",
  "docs",
  "documents",
  "employees",
  "gallery",
  "holiday-calendar",
  "holidays",
  "leave",
  "more",
  "notifications",
  "payroll",
  "performance",
  "profile",
  "projects",
  "recruitment",
  "referrals",
  "resignations",
  "wfh",
  // The external client portal. A client belongs to a company too, so their
  // URLs carry the same prefix.
  "portal",
])

/**
 * Segments that are NEVER tenant-scoped, and can therefore never be a slug.
 *
 * Sign-in happens before a tenant is known, APIs carry their tenant in the
 * token, and the marketing site has no tenant at all.
 */
export const GLOBAL_SEGMENTS: ReadonlySet<string> = new Set([
  "api",
  "login",
  "client-login",
  "signup",
  "forgot-password",
  "change-password",
  "select-workspace",
  "platform",
  // Public marketing pages. A company is never called "about" or "contact", and
  // these must resolve to the marketing route rather than being read as a tenant
  // slug and stripped. Mirrored in PUBLIC_PREFIXES in proxy.ts.
  "about",
  "contact",
  "pricing",
  "faq",
  "legal",
  "_next",
  "public",
  // Top-level DIRECTORIES in public/. These matter more than they look: a
  // directory name has no dot, so without listing it here `looksLikeSlug` reads
  // it as a company and the proxy strips it - /avatars/av-web-01.webp becomes a
  // redirect to /av-web-01.webp and every preset avatar 404s. Files in public/
  // are safe on their own because an extension contains a dot, which the slug
  // pattern rejects. scripts/verify-tenant-urls.ts asserts this list stays in
  // step with the directory.
  "avatars",
  "email-icons",
  // Next.js metadata routes served at the root.
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "opengraph-image",
  "twitter-image",
  "icon",
  "apple-icon",
  "manifest",
])

/**
 * Digitally Next - the founding tenant.
 *
 * Declared HERE, not in server/tenant-context.ts, because that file is
 * server-only and client components need the same answer: the topbar has to
 * decide whether to offer the platform console. tenant-context.ts re-exports
 * these, so every existing `from "@/server/tenant-context"` import still works.
 *
 * Matches the DB default set in migration 20260825000000_tenant_spine.
 */
export const FOUNDING_TENANT_ID = "0197d1ab-0000-7000-8000-000000000001"
export const FOUNDING_TENANT_SLUG = "digitallynext"

/** 3-32 chars: lowercase letters, digits and hyphens, not starting or ending with one. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/

/** Could this string be a tenant slug at all? Shape only - says nothing about existence. */
export function looksLikeSlug(segment: string): boolean {
  return (
    SLUG_PATTERN.test(segment) &&
    !GLOBAL_SEGMENTS.has(segment) &&
    !TENANT_SCOPED_SEGMENTS.has(segment)
  )
}

export interface SplitPath {
  /** The claimed tenant slug, or null when the path carries none. */
  slug: string | null
  /** The path with the slug removed - always starts with "/". */
  rest: string
}

/**
 * Split a leading tenant slug off a pathname.
 *
 *   /digitallynext/projects/7 → { slug: "digitallynext", rest: "/projects/7" }
 *   /projects/7               → { slug: null,            rest: "/projects/7" }
 *   /login                    → { slug: null,            rest: "/login" }
 *
 * `/{slug}` with nothing after it yields rest "/" - proxy.ts sends that to the
 * tenant's dashboard.
 */
export function splitTenant(pathname: string): SplitPath {
  if (!pathname.startsWith("/")) return { slug: null, rest: pathname }
  const firstSlash = pathname.indexOf("/", 1)
  const head = firstSlash === -1 ? pathname.slice(1) : pathname.slice(1, firstSlash)
  if (!looksLikeSlug(head)) return { slug: null, rest: pathname }
  const rest = firstSlash === -1 ? "/" : pathname.slice(firstSlash)
  return { slug: head, rest: rest === "" ? "/" : rest }
}

/** Does this un-prefixed path belong under a tenant? */
export function isTenantScoped(path: string): boolean {
  if (!path.startsWith("/")) return false
  const firstSlash = path.indexOf("/", 1)
  const head = firstSlash === -1 ? path.slice(1) : path.slice(1, firstSlash)
  return TENANT_SCOPED_SEGMENTS.has(head)
}

/**
 * Put `slug` in front of an app path. The one function that builds a tenant URL.
 *
 * Left ALONE, deliberately:
 *   - a path that is not tenant-scoped (/login, /api/..., /)
 *   - a path that already carries a slug (idempotent, so double-wrapping is safe)
 *   - anything not starting with "/" (relative, external, "#anchor", "mailto:")
 *   - a null/empty slug (nothing sensible to add)
 *
 * Query strings and fragments survive: the prefix goes on the pathname only.
 */
export function withTenant(path: string, slug: string | null | undefined): string {
  if (!slug || !path.startsWith("/")) return path

  const queryAt = path.search(/[?#]/)
  const pathname = queryAt === -1 ? path : path.slice(0, queryAt)
  const suffix = queryAt === -1 ? "" : path.slice(queryAt)

  if (splitTenant(pathname).slug) return path
  if (!isTenantScoped(pathname)) return path

  return `/${slug}${pathname}${suffix}`
}
