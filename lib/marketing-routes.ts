// =============================================================================
// Which paths are the PUBLIC MARKETING SITE.
//
// The marketing pages are dark-only and deliberately ignore the dashboard's
// custom palettes. There are eight of those (Royal Purple, Tokyo Night, Aurora,
// and so on), each writing a full set of CSS variables onto <html> - and <html>
// is shared by the whole app, so a palette chosen inside the dashboard followed
// the user out onto the marketing site. The brand red is hardcoded in those
// sections, so a purple or teal palette underneath it looked broken rather than
// themed.
//
// No framework imports: this is read by client components AND mirrored by
// public/theme-boot.js, which is a plain static script that cannot import.
// scripts/verify-tenant-urls.ts asserts the two lists stay in step.
// =============================================================================

/** Exact paths that are marketing pages. */
export const MARKETING_EXACT: readonly string[] = ["/"]

/** Prefixes whose whole subtree is marketing. */
export const MARKETING_PREFIXES: readonly string[] = [
  "/about",
  "/contact",
  "/pricing",
  "/faq",
  "/legal",
]

/** Is this pathname part of the public marketing site? */
export function isMarketingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (MARKETING_EXACT.includes(pathname)) return true
  return MARKETING_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
}
