// Tenant URLs: pages live at /{tenant}/..., APIs stay at /api (the token carries the tenant).
// Pure string code (runs on the edge, browser and Node). Not a security check - proxy.ts verifies the slug.

/**
 * First path segments that live under a tenant (app/(dashboard)/ folders + portal). Allow-list on
 * purpose. Every dashboard route MUST be here, or looksLikeSlug reads it as a company and the proxy
 * bounces it to /select-workspace.
 */
export const TENANT_SCOPED_SEGMENTS: ReadonlySet<string> = new Set([
  "admin",
  "ai-connections",
  "analytics",
  "announcements",
  "attendance",
  "chat",
  "dashboard",
  "documents",
  "employees",
  "gallery",
  "holiday-calendar",
  "calendar",
  "holidays",
  "help",
  "leave",
  "more",
  "notifications",
  "onboarding",
  "clearances",
  "exit-clearance",
  "payroll",
  "performance",
  "profile",
  "projects",
  "recruitment",
  "referrals",
  "resignations",
  "stock",
  "tools",
  "wfh",
  "work-reports",
  "portal",
])

/** Never tenant-scoped, so never a slug: sign-in, token-scoped APIs, the marketing site. */
export const GLOBAL_SEGMENTS: ReadonlySet<string> = new Set([
  "api",
  "login",
  "client-login",
  "signup",
  "forgot-password",
  "change-password",
  "select-workspace",
  "platform",
  // AI-connector consent screen, reached before any tenant is in the URL.
  "oauth",
  // Public marketing pages. Mirrored in PUBLIC_PREFIXES in proxy.ts.
  "about",
  "contact",
  "pricing",
  "faq",
  "legal",
  "_next",
  "public",
  // Top-level public/ folders. They have no dot, so without these looksLikeSlug reads them as a
  // company and the proxy strips them (/avatars/x.webp would 404).
  "avatars",
  "brand-masters",
  "email-icons",
  "help-shots",
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

/** Digitally Next, the founding tenant. Here (not server/tenant-context.ts) so client code can use it. */
export const FOUNDING_TENANT_ID = "0197d1ab-0000-7000-8000-000000000001"
export const FOUNDING_TENANT_SLUG = "digitallynext"

/** 3-32 chars: lowercase letters, digits and hyphens, not starting or ending with one. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/

/** Shape only - says nothing about whether the tenant exists. */
export function looksLikeSlug(segment: string): boolean {
  return (
    SLUG_PATTERN.test(segment) &&
    !GLOBAL_SEGMENTS.has(segment) &&
    !TENANT_SCOPED_SEGMENTS.has(segment)
  )
}

export interface SplitPath {
  slug: string | null
  /** Always starts with "/". */
  rest: string
}

/** "/acme/projects/7" -> { slug: "acme", rest: "/projects/7" }; "/acme" -> rest "/". */
export function splitTenant(pathname: string): SplitPath {
  if (!pathname.startsWith("/")) return { slug: null, rest: pathname }
  const firstSlash = pathname.indexOf("/", 1)
  const head = firstSlash === -1 ? pathname.slice(1) : pathname.slice(1, firstSlash)
  if (!looksLikeSlug(head)) return { slug: null, rest: pathname }
  const rest = firstSlash === -1 ? "/" : pathname.slice(firstSlash)
  return { slug: head, rest: rest === "" ? "/" : rest }
}

export function isTenantScoped(path: string): boolean {
  if (!path.startsWith("/")) return false
  const firstSlash = path.indexOf("/", 1)
  const head = firstSlash === -1 ? path.slice(1) : path.slice(1, firstSlash)
  return TENANT_SCOPED_SEGMENTS.has(head)
}

/**
 * Prefix an app path with the tenant slug. Leaves alone: non-tenant paths, already-prefixed paths,
 * anything not starting with "/", and an empty slug. Query strings and hashes survive.
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
