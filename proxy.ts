/**
 * Next.js Edge Proxy - authentication guard for the DNMS.
 *
 * Renamed from `middleware.ts` to `proxy.ts` (Next.js 16 convention).
 *
 * Uses the Auth.js v5 `auth` helper (which runs on the Edge runtime) to
 * inspect the JWT session cookie.  Public paths are allowed through
 * unconditionally; all other routes require an authenticated session.
 *
 * Public paths:
 *   /login - sign-in page
 *   /forgot-password - request OTP, verify, and set a new password
 *   /api/password/forgot|verify-otp|reset
 * - the forgot-password flow (self-protected by the
 *                           emailed OTP + the short-lived reset token). These
 *                           MUST be reachable while signed out.
 *   /api/auth/* - NextAuth internal endpoints
 *   /api/cron/* - cron jobs (self-protected by CRON_SECRET bearer token)
 *   /api/public/* - headless public APIs (self-protected by X-API-Key)
 *   /_next/* - Next.js static/image assets
 *   /favicon.ico - browser favicon
 *   /public/* - static public assets served from /public
 */
import { auth } from "@/server/auth"
import { NextResponse } from "next/server"
import { isTenantScoped, splitTenant, withTenant } from "@/lib/tenant-url"
import type { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// The tenant URL space (M3).
//
// Pages live under /{tenant}/..., APIs stay at /api/... and carry their tenant
// in the token. This file is the ONLY place a slug in a URL turns into a fact:
// everything downstream reads `x-tenant-slug`, which is set here and only here,
// after the slug has been checked against the session.
//
// Three cases, in the order they are handled below:
//
//   /digitallynext/projects   slug matches the session  → rewrite to /projects
//                             slug is somebody else's   → /select-workspace
//                             not signed in             → /login?callbackUrl=…
//
//   /projects                 signed in                 → redirect to the
//                             (a legacy or missed link)   canonical prefixed URL
//
//   /login, /api/..., /       never touched.
//
// The legacy redirect is what makes the migration safe: an old bookmark, an
// email link, or an internal <Link> that has not been converted yet still lands
// in the right place, just one hop later.
//
// EDGE RUNTIME. No database here - the check is a string comparison against
// `tenantSlug`, which M2 put in the token for exactly this reason.
// ---------------------------------------------------------------------------

/** Set by this file after verification. Never trusted from the client. */
const TENANT_HEADER = "x-tenant-slug"

/**
 * The tenant's ID, alongside its slug.
 *
 * The slug is for building URLs; this is what the data layer scopes on. Server
 * COMPONENTS render outside every route wrapper - and, as it turns out, outside
 * their own layout's async context too - so the tenant guard reads this header
 * when it finds no ambient context. Sending the id rather than making the guard
 * resolve the slug means it never has to trust a name it did not verify itself.
 */
const TENANT_ID_HEADER = "x-tenant-id"

/** Marks a request this file already rewrote, so the second pass does not undo it. */
const REWRITE_MARKER = "x-tenant-rewritten"

// Paths that are accessible without a session. The /api/cron and /api/public
// endpoints do their own token-based auth, so the session guard must let them
// through (otherwise cron-job.org / the careers site get 401 before the handler).
const PUBLIC_PREFIXES = [
  // Public marketing landing page. Only the EXACT root is public - the
  // isPublic() match is `pathname === prefix` for "/" (its prefix+"/" form is
  // "//", which nothing else matches), so no protected route is exposed by this.
  "/",
  "/login",
  // Self-service signup (M5). Public by definition - the person creating a
  // company does not have an account yet, so the session guard would bounce
  // them to /login and there would be no way to become a customer.
  "/signup",
  "/forgot-password",
  // Public marketing pages. Each is also listed in GLOBAL_SEGMENTS
  // (lib/tenant-url.ts) - without that, `looksLikeSlug` reads "about" as a
  // company name and the proxy strips it, exactly as it once did to /avatars.
  "/about",
  "/contact",
  "/pricing",
  "/faq",
  "/legal",
  // The homepage newsletter and the contact form both post from a signed-OUT
  // page, so their endpoints must bypass the session guard or the form answers
  // 401 to every visitor. /api/marketing was missing here and the newsletter
  // had been failing silently for anyone not already logged in.
  "/api/marketing",
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
  // The punch terminal has no session and never will - it is a door reader on a
  // private LAN posting outbound. It authenticates with ATTENDANCE_HOOK_SECRET
  // inside the handler, which refuses everything when that is unset, so this
  // bypasses the SESSION guard only, not authentication.
  "/api/attendance/hook",
  "/_next",
  "/favicon.ico",
  "/public",
  // Crawler files. Served by app/robots.ts and app/sitemap.ts at the root, and
  // NOT covered by PUBLIC_FILE below - .txt and .xml are deliberately absent
  // from that list, so without these two entries a signed-out crawler was being
  // 307'd to /login and the site had, in effect, no robots.txt and no sitemap.
  "/robots.txt",
  "/sitemap.xml",
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

  // --- Performance --------------------------------------------------------
  // A single evaluation is participant-gated by its own API (employee / manager /
  // controller / HR), so any authenticated user may open the detail URL - they
  // just can't read one they aren't part of. The LIST + KPI admin pages below
  // stay review-gated.
  [/^\/performance\/evaluations\/[^/]+(\/|$)/, null],
  [/^\/performance(\/|$)/, "performance:review"],

  // --- Recruitment (HR) --------------------------------------------------
  [/^\/recruitment(\/|$)/, "recruitment:read"],

  // --- Analytics (HR) ----------------------------------------------------
  [/^\/analytics(\/|$)/, "analytics:read"],

  // --- Projects ----------------------------------------------------------
  // /projects is reachable by any authenticated user: the list is scoped to the
  // caller (own + member projects) and each project API read enforces access, so
  // an account manager who is a plain employee can reach THEIR projects.

  // --- Per-employee documents (HR view of another employee's documents) --
  [/^\/documents\/employee(\/|$)/, "employee:read"],

  // --- Admin -------------------------------------------------------------
  [/^\/admin\/roles(\/|$)/, "role:read"],
  [/^\/admin\/permissions(\/|$)/, "role:read"],
  [/^\/admin\/audit-log(\/|$)/, "audit:read"],
  [/^\/admin\/email-templates(\/|$)/, "email_template:read"],
  [/^\/admin\/project-settings(\/|$)/, "project:write"],
  [/^\/admin\/storage(\/|$)/, "settings:write"],
  [
    /^\/admin(\/|$)/,
    ["role:read", "audit:read", "email_template:read", "project:write", "settings:write"],
  ],
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
  // The URL as typed, before the tenant prefix is stripped. Used for redirects
  // and callbackUrls so the user comes back to the address they asked for.
  const requestedPath = req.nextUrl.pathname

  // Split off a claimed tenant slug. Nothing is believed yet - `claimedSlug` is
  // whatever the URL says, and is checked against the session further down.
  const { slug: claimedSlug, rest } = splitTenant(requestedPath)

  // Next.js runs this file again on the path it was rewritten TO. Without a way
  // to tell that apart from a genuine un-prefixed request, the canonical
  // redirect below would bounce /dashboard back to /{tenant}/dashboard, which
  // rewrites to /dashboard, which bounces... The marker is set on the rewritten
  // request so the second pass knows to leave the path alone.
  const alreadyRewritten = req.headers.get(REWRITE_MARKER) === "1"
  // Every guard below reasons about the app path, not the prefixed one, so the
  // existing rules keep working unchanged.
  const pathname = claimedSlug ? rest : requestedPath

  /**
   * Build an absolute URL on the origin the request ACTUALLY arrived on.
   *
   * Not `req.nextUrl.clone()`, and not `new URL(path, req.url)`. Auth.js rebuilds
   * the request from `NEXTAUTH_URL`, so inside this file both of those carry
   * that value rather than the real host. For a redirect that is merely wrong;
   * for a REWRITE it is fatal - Next compares the destination's origin with the
   * request's, sees a different one, and proxies the request out to that other
   * host instead of serving the route internally. The symptom is a 404 on every
   * /{tenant}/… page, or worse, a silent round trip through the public URL.
   *
   * The Host header is what the client actually asked for and is the one thing
   * Auth.js does not touch. x-forwarded-* is preferred so this stays correct
   * behind nginx on the VPS.
   */
  const onThisOrigin = (path: string, search = ""): URL => {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
    if (!host) {
      const fallback = req.nextUrl.clone()
      fallback.pathname = path
      fallback.search = search
      return fallback
    }
    const proto =
      req.headers.get("x-forwarded-proto") ?? (req.nextUrl.protocol === "https:" ? "https" : "http")
    return new URL(`${path}${search}`, `${proto}://${host}`)
  }

  // `x-tenant-slug` is an INBOUND header a client can forge. Drop it here, on
  // every single request including the public ones, and re-add it only from the
  // session further down. Anything downstream that reads it is then reading
  // something this file wrote.
  const headers = new Headers(req.headers)
  headers.delete(TENANT_HEADER)
  headers.delete(TENANT_ID_HEADER)
  headers.delete(REWRITE_MARKER)
  const passThrough = () => NextResponse.next({ request: { headers } })

  // /client-login was retired: /login is the one door for staff and portal
  // contacts alike (see server/auth.ts). Invitation emails already sent still
  // point at the old address, so it forwards rather than 404s. Checked on the
  // stripped path, so /{tenant}/client-login lands here too.
  if (pathname === "/client-login") {
    return NextResponse.redirect(onThisOrigin("/login", req.nextUrl.search))
  }

  // Un-prefixed public paths: the marketing page, sign-in, static assets, the
  // self-authenticating API families. Unchanged behaviour.
  if (!claimedSlug && isPublic(requestedPath)) {
    return passThrough()
  }

  // A prefix in front of something global - /{tenant}/login, /{tenant}/logo.webp.
  // Nothing generates these, but a hand-typed one should land somewhere sensible
  // instead of 404ing, and a global route must never be served from two
  // addresses. Bare /{tenant} is excluded: that is the tenant's front door, and
  // it needs the session below to know where to send them.
  if (claimedSlug && pathname !== "/" && isPublic(pathname)) {
    return NextResponse.redirect(onThisOrigin(pathname, req.nextUrl.search))
  }

  // For protected paths, check the session embedded by the auth() wrapper.
  const session = (
    req as NextRequest & {
      auth: {
        user?: {
          kind?: "employee" | "client"
          mustChangePassword?: boolean
          roles?: string[]
          permissions?: string[]
          tenantSlug?: string
          tenantId?: string
        }
      } | null
    }
  ).auth

  const isPortalPath = pathname === "/portal" || pathname.startsWith("/portal/")
  const isPortalApi = pathname.startsWith("/api/portal")

  if (!session?.user) {
    // API routes: return 401 JSON instead of a redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Page routes: redirect to the login page, preserving the original URL as
    // a `callbackUrl` query parameter so the user is sent back after login.
    const loginUrl = onThisOrigin("/login")
    // Assign `.search` directly so the callback stays human-readable
    // (?callbackUrl=/dashboard) instead of percent-encoding the slash the way
    // searchParams.set would (?callbackUrl=%2Fdashboard). requestedPath is
    // already a safe, server-derived relative path, so it needs no extra
    // encoding - and it keeps the tenant prefix, so they land where they meant to.
    loginUrl.search = `callbackUrl=${requestedPath}`
    return NextResponse.redirect(loginUrl)
  }

  // -------------------------------------------------------------------------
  // Tenant resolution. Everything above this point ran on the stripped path;
  // here is where the prefix itself is judged.
  // -------------------------------------------------------------------------
  const sessionSlug = session.user.tenantSlug

  if (claimedSlug) {
    // A slug that is not the one the session is signed in to. Never serve it:
    // send them to the workspace switcher, which runs on Node, can look up what
    // they actually belong to, and can switch the active membership.
    if (!sessionSlug || claimedSlug !== sessionSlug) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return NextResponse.redirect(onThisOrigin("/select-workspace", `?next=${requestedPath}`))
    }
    // Bare /{tenant} is the tenant's front door.
    if (pathname === "/") {
      return NextResponse.redirect(onThisOrigin(`/${claimedSlug}/dashboard`))
    }
  } else if (
    sessionSlug &&
    !alreadyRewritten &&
    isTenantScoped(pathname) &&
    !pathname.startsWith("/api/")
  ) {
    // An un-prefixed app path from a signed-in user: a bookmark, an emailed
    // link, or an internal link not yet converted. Send them to the canonical
    // URL rather than serving a second address for the same page.
    return NextResponse.redirect(
      onThisOrigin(withTenant(pathname, sessionSlug), req.nextUrl.search),
    )
  }

  /**
   * Build an in-app redirect target that keeps the caller inside their tenant.
   * Every redirect below goes through this, so bouncing someone never silently
   * drops them out of the prefixed URL space.
   */
  const appUrl = (path: string) => withTenant(path, sessionSlug)

  // -------------------------------------------------------------------------
  // Population split. A client session and a staff session must never reach one
  // another's surface. The API wrappers enforce this too (assertStaff /
  // withClientSession) - this is the outer fence so a client typing /payroll
  // gets bounced before any page shell renders.
  // -------------------------------------------------------------------------
  const isClient = session.user.kind === "client"

  // The ONE shared surface: the project mailer.
  //
  // A client granted the "mailer" module drives the same endpoints staff do,
  // because the alternative was a duplicate /api/portal/*/mailer tree of a dozen
  // routes whose client copy would silently rot out of step with the original.
  //
  // Narrow on purpose - only this exact prefix, nothing else under /api/projects
  // - and it does NOT grant anything. Every route behind it is wrapped in
  // withMailerAccess, which re-proves the client's grant AND the module and
  // resolves the project id from the grant rather than the URL. This fence is
  // defence in depth; that guard is the authority.
  const isSharedMailerApi = /^\/api\/projects\/[^/]+\/mailer(\/|$)/.test(pathname)

  if (isClient && !isPortalPath && !isPortalApi && !isSharedMailerApi) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // /change-password is staff-only; the portal has its own flow.
    return NextResponse.redirect(onThisOrigin(appUrl("/portal")))
  }

  if (!isClient && (isPortalPath || isPortalApi)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // Staff manage client access from a project's Clients tab, not by browsing
    // the portal with a session that holds no grant.
    return NextResponse.redirect(onThisOrigin(appUrl("/projects")))
  }

  // Force-password-change gate: a flagged user is funneled to /change-password
  // until they set a new password (which clears the flag). The change endpoint
  // (POST /api/password) and /api/auth/* stay open so they can actually submit
  // the new password and then refresh their session / sign out - otherwise the
  // very request that clears the flag would be blocked by the flag.
  //
  // Clients get the SAME gate but on their own pages: /change-password is
  // staff-only, and the population split above would bounce them straight back
  // to /portal - an endless redirect. Theirs lives inside /portal.
  if (session.user.mustChangePassword) {
    const changePath = isClient ? "/portal/set-password" : "/change-password"
    const changeApi = isClient ? "/api/portal/password" : "/api/password"
    const allowed =
      pathname === changePath || pathname === changeApi || pathname.startsWith("/api/auth")
    if (!allowed) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Password change required" }, { status: 403 })
      }
      return NextResponse.redirect(onThisOrigin(appUrl(changePath)))
    }
  }

  // Route-level RBAC for PAGE routes. API routes enforce their own permissions
  // via the withAuth() wrapper (lib/permissions.ts), so they are skipped here.
  // A user who lacks the required scope is sent back to /dashboard (a page every
  // role can access), so they never reach an HR/admin page by typing the URL.
  if (!pathname.startsWith("/api/")) {
    const perm = requiredPermFor(pathname)
    if (!isAuthorized(perm, session.user.roles ?? [], session.user.permissions ?? [])) {
      return NextResponse.redirect(onThisOrigin(appUrl("/dashboard")))
    }
  }

  // -------------------------------------------------------------------------
  // Hand the request on, carrying the VERIFIED tenant.
  //
  // The slug comes from the SESSION, never from the URL - by this point the two
  // have been proven equal, but taking it from the session is what makes that
  // true by construction rather than by reading the code above.
  //
  // When the URL carried a prefix the request is also REWRITTEN to the app path,
  // so `app/(dashboard)/projects/page.tsx` serves /{tenant}/projects with no
  // change to the route tree. The browser keeps showing the prefixed URL.
  // -------------------------------------------------------------------------
  if (sessionSlug) headers.set(TENANT_HEADER, sessionSlug)
  if (session.user.tenantId) headers.set(TENANT_ID_HEADER, session.user.tenantId)

  if (claimedSlug) {
    headers.set(REWRITE_MARKER, "1")
    // ── THE REWRITE DESTINATION'S ORIGIN DECIDES INTERNAL vs EXTERNAL ───────
    //
    // Next decides whether a rewrite is INTERNAL (serve this route here) or
    // EXTERNAL (go and fetch that URL over the network) by comparing the
    // destination's origin with the request's. Get it wrong and Next proxies
    // every page out to the public URL - back through nginx, into Next,
    // rewritten again, looping until nginx answers 502. Only /{tenant}/… paths
    // are rewritten, so /api/… would keep working while every page failed.
    //
    // The origin Next compares against is built from the request AS IT ARRIVED:
    // `x-forwarded-proto` when a proxy set one, plain http otherwise. It is
    // NOT `nextUrl` - Auth.js rebuilds that from NEXTAUTH_URL, so inside this
    // file `nextUrl` says https://dnms.digitallynext.com even when the hop from
    // nginx into Next is plain http on 127.0.0.1:3000. Deriving the scheme from
    // `nextUrl` therefore composes an origin Next may not recognise as its own.
    //
    // Measured on a real reverse-proxy setup, destination scheme vs. accepted:
    //             direct            behind nginx
    //   http      200, relative     matches when no x-forwarded-proto
    //   https     500               matches when x-forwarded-proto: https
    //
    // A relative path in the header is not an option: Next parses the value
    // with `new URL()` and throws ERR_INVALID_URL.
    //
    // NOTE: a correctly configured nginx always sends x-forwarded-proto, so the
    // http fallback below is for the direct-to-Node case (dev, health checks,
    // container probes). If a deployment ever fronts this with a proxy that
    // omits the header, Next canonicalises http->https and answers 301 instead
    // of serving - the fix is on the proxy, which must send it.
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
    const scheme = forwardedProto || "http"
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
    const destination = host
      ? new URL(`${pathname}${req.nextUrl.search}`, `${scheme}://${host}`)
      : (() => {
          const fallback = req.nextUrl.clone()
          fallback.pathname = pathname
          return fallback
        })()
    return NextResponse.rewrite(destination, { request: { headers } })
  }
  return passThrough()
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
