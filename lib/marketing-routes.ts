// Public marketing paths. They're dark-only and ignore dashboard palettes (the brand red clashes).
// Mirrored in public/theme-boot.js (which can't import) - keep the two lists in step.

export const MARKETING_EXACT: readonly string[] = ["/"]

export const MARKETING_PREFIXES: readonly string[] = [
  "/about",
  "/contact",
  "/pricing",
  "/faq",
  "/legal",
]

export function isMarketingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (MARKETING_EXACT.includes(pathname)) return true
  return MARKETING_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
}
