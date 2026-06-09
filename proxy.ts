/**
 * Next.js Edge Proxy – authentication guard for the DNMS.
 *
 * Renamed from `middleware.ts` to `proxy.ts` (Next.js 16 convention).
 *
 * Uses the Auth.js v5 `auth` helper (which runs on the Edge runtime) to
 * inspect the JWT session cookie.  Public paths are allowed through
 * unconditionally; all other routes require an authenticated session.
 *
 * Public paths:
 *   /login                – sign-in page
 *   /forgot-password      – request OTP, verify, and set a new password
 *   /api/auth/*           – NextAuth internal endpoints
 *   /api/cron/*           – cron jobs (self-protected by CRON_SECRET bearer token)
 *   /api/public/*         – headless public APIs (self-protected by X-API-Key)
 *   /_next/*              – Next.js static/image assets
 *   /favicon.ico          – browser favicon
 *   /public/*             – static public assets served from /public
 */
import { auth } from "@/lib/auth-options"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Paths that are accessible without a session. The /api/cron and /api/public
// endpoints do their own token-based auth, so the session guard must let them
// through (otherwise cron-job.org / the careers site get 401 before the handler).
const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/api/auth",
  "/api/cron",
  "/api/public",
  "/_next",
  "/favicon.ico",
  "/public",
]

// Static assets in /public are served at the root (e.g. /logo_dark_bg.webp), so
// any request for a file with an asset extension must be allowed through - these
// are needed on public pages (the login page logo, the render-blocking
// /theme-boot.js that prevents the theme flash) and by the image optimiser.
const PUBLIC_FILE =
  /\.(?:webp|png|jpe?g|gif|svg|ico|bmp|avif|webmanifest|woff2?|ttf|otf|mp4|webm|js|mjs)$/i

function isPublic(pathname: string): boolean {
  if (!pathname.startsWith("/api/") && PUBLIC_FILE.test(pathname)) return true
  return PUBLIC_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?"),
  )
}

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl

  // Always allow public paths through.
  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  // For protected paths, check the session embedded by the auth() wrapper.
  const session = (req as NextRequest & { auth: { user?: unknown } | null }).auth

  if (!session?.user) {
    // API routes: return 401 JSON instead of a redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Page routes: redirect to the login page, preserving the original URL as
    // a `callbackUrl` query parameter so the user is sent back after login.
    const loginUrl = new URL("/login", req.url)
    // Assign `.search` directly so the callback stays human-readable
    // (?callbackUrl=/dashboard) instead of percent-encoding the slash the way
    // searchParams.set would (?callbackUrl=%2Fdashboard). pathname is already a
    // safe, server-derived relative path, so it needs no extra encoding.
    loginUrl.search = `callbackUrl=${req.nextUrl.pathname}`
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  /*
   * Match every path EXCEPT:
   *   - _next/static  (static files)
   *   - _next/image   (image optimisation)
   *   - favicon.ico
   *   - public/*      (public directory assets)
   *
   * Note: /api/auth/* is matched but handled as a public path inside the
   * middleware function above.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
}
