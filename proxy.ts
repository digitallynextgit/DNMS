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
 *   /api/password/forgot|verify-otp|reset
 *                         – the forgot-password flow (self-protected by the
 *                           emailed OTP + the short-lived reset token). These
 *                           MUST be reachable while signed out.
 *   /api/auth/*           – NextAuth internal endpoints
 *   /api/cron/*           – cron jobs (self-protected by CRON_SECRET bearer token)
 *   /api/public/*         – headless public APIs (self-protected by X-API-Key)
 *   /_next/*              – Next.js static/image assets
 *   /favicon.ico          – browser favicon
 *   /public/*             – static public assets served from /public
 */
import { auth } from "@/server/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Paths that are accessible without a session. The /api/cron and /api/public
// endpoints do their own token-based auth, so the session guard must let them
// through (otherwise cron-job.org / the careers site get 401 before the handler).
const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  // The forgot-password flow is used while signed OUT, so its three endpoints
  // must bypass the session guard. Each is self-protected: `forgot` only emails
  // a code, `verify-otp` needs that code, and `reset` needs the short-lived
  // token `verify-otp` hands back. NOTE: the signed-in change-password endpoint
  // (/api/password itself) is deliberately NOT listed - it stays guarded.
  "/api/password/forgot",
  "/api/password/verify-otp",
  "/api/password/reset",
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

// ---------------------------------------------------------------------------
// Route-level RBAC.
//
// The sidebar hides menu items a user lacks permission for, but that is purely
// cosmetic - a signed-in employee could still navigate directly to an HR/admin
// URL and the page shell would render. These ordered rules are the server-side
// enforcement: the FIRST regex that matches `pathname` decides what is required
// to load that page.
//
//   null        -> open to any authenticated user (self-service / company-wide)
//   "scope"     -> that scope is required
//   ["a","b"]   -> ANY one of the scopes is enough
//
// admin_ always passes; admin holds every scope so it passes naturally.
//
// IMPORTANT: the regular `employee` role holds several read scopes
// (attendance:read, payroll:read, performance:read, document:read, project:read),
// so HR management pages are deliberately gated on MANAGE-level scopes
// (write / approve / review) - matching how the sidebar gates these menus - not
// on :read, otherwise every employee would pass the check.
//
// API routes are NOT guarded here: each enforces its own permission via the
// withAuth() wrapper in lib/permissions.ts. This map only protects page routes.
// ---------------------------------------------------------------------------
type RoutePerm = string | string[] | null

const ROUTE_RULES: ReadonlyArray<readonly [RegExp, RoutePerm]> = [
  // --- Employee self-service & company-wide: always allowed --------------
  [/^\/attendance\/me(\/|$)/, null],
  [/^\/payroll\/me(\/|$)/, null],
  [/^\/performance\/me(\/|$)/, null],
  [/^\/leave\/apply(\/|$)/, null],
  [/^\/wfh\/apply(\/|$)/, null],
  [/^\/employees\/org-chart(\/|$)/, null],
  [/^\/holiday-calendar(\/|$)/, null],
  [/^\/leave$/, null],
  [/^\/wfh$/, null],

  // --- Employees (HR) ----------------------------------------------------
  [/^\/employees\/new(\/|$)/, "employee:write"],
  [/^\/employees\/import(\/|$)/, "employee:write"],
  [/^\/employees\/[^/]+\/edit(\/|$)/, "employee:write"],
  [/^\/employees(\/|$)/, "employee:read"],

  // --- Attendance (HR) ---------------------------------------------------
  [/^\/attendance(\/|$)/, "attendance:write"],

  // --- Holidays (HR management; employees use /holiday-calendar) ---------
  [/^\/holidays(\/|$)/, "attendance:write"],

  // --- Leave (HR) --------------------------------------------------------
  [/^\/leave\/(team|types|leave-directory)(\/|$)/, "leave:approve"],

  // --- Work From Home (HR) ----------------------------------------------
  [/^\/wfh\/requests(\/|$)/, "wfh:approve"],

  // --- Payroll (HR) ------------------------------------------------------
  [/^\/payroll(\/|$)/, "payroll:write"],

  // --- Performance (HR) --------------------------------------------------
  [/^\/performance(\/|$)/, "performance:review"],

  // --- Recruitment (HR) --------------------------------------------------
  [/^\/recruitment(\/|$)/, "recruitment:read"],

  // --- Analytics (HR) ----------------------------------------------------
  [/^\/analytics(\/|$)/, "analytics:read"],

  // --- Projects ----------------------------------------------------------
  [/^\/projects(\/|$)/, "project:read"],

  // --- Per-employee documents (HR view of another employee's documents) --
  [/^\/documents\/employee(\/|$)/, "employee:read"],

  // --- Admin -------------------------------------------------------------
  [/^\/admin\/roles(\/|$)/, "role:read"],
  [/^\/admin\/permissions(\/|$)/, "role:read"],
  [/^\/admin\/audit-log(\/|$)/, "audit:read"],
  [/^\/admin\/email-templates(\/|$)/, "email_template:read"],
  [/^\/admin\/project-settings(\/|$)/, "project:write"],
  [/^\/admin(\/|$)/, ["role:read", "audit:read", "email_template:read", "project:write"]],
]

// First matching rule wins. `undefined` => no rule => open to any signed-in user.
function requiredPermFor(pathname: string): RoutePerm | undefined {
  for (const [re, perm] of ROUTE_RULES) {
    if (re.test(pathname)) return perm
  }
  return undefined
}

function isAuthorized(
  perm: RoutePerm | undefined,
  roles: string[],
  permissions: string[],
): boolean {
  if (perm === undefined || perm === null) return true
  if (roles.includes("admin_")) return true
  const needed = Array.isArray(perm) ? perm : [perm]
  return needed.some((p) => permissions.includes(p))
}

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl

  // Always allow public paths through.
  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  // For protected paths, check the session embedded by the auth() wrapper.
  const session = (
    req as NextRequest & {
      auth: {
        user?: { mustChangePassword?: boolean; roles?: string[]; permissions?: string[] }
      } | null
    }
  ).auth

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

  // Force-password-change gate: a flagged user is funneled to /change-password
  // until they set a new password (which clears the flag). The change endpoint
  // (POST /api/password) and /api/auth/* stay open so they can actually submit
  // the new password and then refresh their session / sign out - otherwise the
  // very request that clears the flag would be blocked by the flag.
  if (session.user.mustChangePassword) {
    const allowed =
      pathname === "/change-password" ||
      pathname === "/api/password" ||
      pathname.startsWith("/api/auth")
    if (!allowed) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Password change required" }, { status: 403 })
      }
      return NextResponse.redirect(new URL("/change-password", req.url))
    }
  }

  // Route-level RBAC for PAGE routes. API routes enforce their own permissions
  // via the withAuth() wrapper (lib/permissions.ts), so they are skipped here.
  // A user who lacks the required scope is sent back to /dashboard (a page every
  // role can access), so they never reach an HR/admin page by typing the URL.
  if (!pathname.startsWith("/api/")) {
    const perm = requiredPermFor(pathname)
    if (!isAuthorized(perm, session.user.roles ?? [], session.user.permissions ?? [])) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
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
