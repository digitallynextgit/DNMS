// Edge proxy (Next 16 middleware): session guard, tenant URL prefix and page-level RBAC.
import { auth } from "@/server/auth"
import { NextResponse } from "next/server"
import { isTenantScoped, splitTenant, withTenant } from "@/lib/tenant-url"
import { isMarketingPath } from "@/lib/marketing-routes"
import { AUTH_HINT_COOKIE, parseAuthHint } from "@/lib/auth-hint"
import type { NextRequest } from "next/server"

// Pages live under /{tenant}/...; APIs stay at /api/... and carry the tenant in the token.
// This is the ONLY place a URL slug becomes trusted: `x-tenant-slug` is set here, after the
// slug is checked against the session. Edge runtime - no database here.

/** Set by this file after verification. Never trusted from the client. */
const TENANT_HEADER = "x-tenant-slug"

/** The tenant guard falls back to this in server components, which have no ambient context. */
const TENANT_ID_HEADER = "x-tenant-id"

/** Marks a request this file already rewrote, so the second pass does not undo it. */
const REWRITE_MARKER = "x-tenant-rewritten"

// Reachable without a session. The API entries here authenticate themselves (token, key or OTP).
const PUBLIC_PREFIXES = [
  // Only the exact root: "/" + "/" is "//", which matches nothing else.
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  // Each must also be in GLOBAL_SEGMENTS (lib/tenant-url.ts), or it is read as a tenant slug.
  "/about",
  "/contact",
  "/pricing",
  "/faq",
  "/legal",
  // Newsletter and contact forms post from signed-out pages.
  "/api/marketing",
  // Forgot-password steps (each OTP/token-protected). /api/password itself stays guarded.
  "/api/password/forgot",
  "/api/password/verify-otp",
  "/api/password/reset",
  "/api/auth",
  "/api/cron",
  "/api/public",
  // Punch terminal: no session; the handler checks ATTENDANCE_HOOK_SECRET.
  "/api/attendance/hook",
  // AI connector: MCP must send its own 401 + WWW-Authenticate, and OAuth/.well-known are
  // called server-to-server. The consent PAGE is not listed - it needs the session.
  "/api/mcp",
  "/api/oauth",
  "/.well-known",
  "/_next",
  "/favicon.ico",
  "/public",
  // Not covered by PUBLIC_FILE (.txt and .xml are deliberately absent there).
  "/robots.txt",
  "/sitemap.xml",
]

// /public files are served at the root and are needed on signed-out pages (logo, /theme-boot.js).
const PUBLIC_FILE =
  /\.(?:webp|png|jpe?g|gif|svg|ico|bmp|avif|webmanifest|woff2?|ttf|otf|mp4|webm|js|mjs)$/i

function isPublic(pathname: string): boolean {
  if (!pathname.startsWith("/api/") && PUBLIC_FILE.test(pathname)) return true
  return PUBLIC_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?"),
  )
}

// Page-level RBAC (the sidebar only hides links). First matching regex wins:
// null = any signed-in user, "scope" = required, [...] = any one of. admin_ always passes.
// HR pages are gated on MANAGE scopes (write/approve/review), not :read - the plain employee
// role holds several :read scopes. API routes check their own permissions (withAuth).
type RoutePerm = string | string[] | null

const ROUTE_RULES: ReadonlyArray<readonly [RegExp, RoutePerm]> = [
  [/^\/attendance\/me(\/|$)/, null],
  [/^\/payroll\/me(\/|$)/, null],
  [/^\/performance\/me(\/|$)/, null],
  [/^\/leave\/apply(\/|$)/, null],
  [/^\/wfh\/apply(\/|$)/, null],
  [/^\/employees\/org-chart(\/|$)/, null],
  // Anyone may be asked to sign a clearance; the API limits it to the caller's own items.
  [/^\/clearances(\/|$)/, null],
  [/^\/holiday-calendar(\/|$)/, null],
  [/^\/calendar(\/|$)/, null],
  // Each guide hides itself from readers who can't open the page it explains.
  [/^\/help(\/|$)/, null],
  // A tool limited to a permission hides its card.
  [/^\/tools(\/|$)/, null],
  [/^\/leave$/, null],
  [/^\/wfh$/, null],

  [/^\/employees\/new(\/|$)/, "employee:write"],
  [/^\/employees\/import(\/|$)/, "employee:write"],
  [/^\/employees\/[^/]+\/edit(\/|$)/, "employee:write"],
  [/^\/employees(\/|$)/, "employee:read"],

  [/^\/onboarding(\/|$)/, ["onboarding:read", "onboarding:write"]],
  [/^\/exit-clearance(\/|$)/, ["exit:read", "exit:write"]],

  [/^\/attendance(\/|$)/, "attendance:write"],

  [/^\/holidays(\/|$)/, "attendance:write"],

  [/^\/stock(\/|$)/, "employee:read"],

  [/^\/leave\/(team|types|leave-directory)(\/|$)/, "leave:approve"],

  [/^\/wfh\/requests(\/|$)/, "wfh:approve"],

  [/^\/payroll(\/|$)/, "payroll:write"],

  // One evaluation is participant-gated by its own API; the list and KPI pages stay review-gated.
  [/^\/performance\/evaluations\/[^/]+(\/|$)/, null],
  [/^\/performance(\/|$)/, "performance:review"],

  [/^\/recruitment(\/|$)/, "recruitment:read"],

  [/^\/analytics(\/|$)/, "analytics:read"],

  // No /projects rule: the list is scoped to the caller and each project API checks access.

  [/^\/documents\/employee(\/|$)/, "employee:read"],

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

// No matching rule (undefined) => open to any signed-in user.
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

/**
 * Keep the "signed in?" hint cookie in step with the session, so a static marketing page can
 * show Dashboard vs Log in on first paint. Only written when wrong.
 */
function syncAuthHint(req: NextRequest, auth: unknown, res: NextResponse): NextResponse {
  const user = (auth as { user?: { kind?: string } } | null)?.user
  const want = user ? (user.kind === "client" ? "client" : "employee") : null
  if (parseAuthHint(req.cookies.get(AUTH_HINT_COOKIE)?.value) === want) return res
  if (!want) {
    // Path must match the set below, or the browser keeps the old cookie.
    res.cookies.delete({ name: AUTH_HINT_COOKIE, path: "/" })
    return res
  }
  res.cookies.set(AUTH_HINT_COOKIE, want, {
    path: "/",
    sameSite: "lax",
    // Not httpOnly: theme-boot.js has to read it. It is a display hint only.
    secure: req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https",
    maxAge: 7 * 24 * 60 * 60, // same as the session lifetime
  })
  return res
}

export default auth((req: NextRequest & { auth: unknown }) => {
  // As typed, with the tenant prefix - used for redirects and callbackUrls.
  const requestedPath = req.nextUrl.pathname

  // Not trusted yet - checked against the session below.
  const { slug: claimedSlug, rest } = splitTenant(requestedPath)

  // Next re-runs the proxy on the rewritten path; without this marker the canonical
  // redirect below would loop (/dashboard -> /{tenant}/dashboard -> /dashboard ...).
  const alreadyRewritten = req.headers.get(REWRITE_MARKER) === "1"
  const pathname = claimedSlug ? rest : requestedPath

  /**
   * An absolute URL on the origin the request actually arrived on (Host / x-forwarded-*).
   * Not req.nextUrl or req.url: Auth.js rebuilds those from NEXTAUTH_URL, and a rewrite to
   * another origin is proxied out instead of served internally.
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

  // Clients can forge these headers: strip them on EVERY request; only the session re-adds them.
  const headers = new Headers(req.headers)
  headers.delete(TENANT_HEADER)
  headers.delete(TENANT_ID_HEADER)
  headers.delete(REWRITE_MARKER)
  const passThrough = () => NextResponse.next({ request: { headers } })

  // /login serves staff and clients; old invitation emails still link to /client-login.
  if (pathname === "/client-login") {
    return NextResponse.redirect(onThisOrigin("/login", req.nextUrl.search))
  }

  if (!claimedSlug && isPublic(requestedPath)) {
    return isMarketingPath(requestedPath)
      ? syncAuthHint(req, req.auth, passThrough())
      : passThrough()
  }

  // /{tenant}/login etc.: a global route has one address. Bare /{tenant} is handled below.
  if (claimedSlug && pathname !== "/" && isPublic(pathname)) {
    return NextResponse.redirect(onThisOrigin(pathname, req.nextUrl.search))
  }

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
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = onThisOrigin("/login")
    // Set .search directly so the callback stays readable (no %2F); the path is server-derived.
    loginUrl.search = `callbackUrl=${requestedPath}`
    return NextResponse.redirect(loginUrl)
  }

  const sessionSlug = session.user.tenantSlug

  if (claimedSlug) {
    // Not the session's tenant: never serve it; the workspace switcher can switch membership.
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
    // An un-prefixed app path (old bookmark or email link): redirect to the canonical URL.
    return NextResponse.redirect(
      onThisOrigin(withTenant(pathname, sessionSlug), req.nextUrl.search),
    )
  }

  const appUrl = (path: string) => withTenant(path, sessionSlug)

  // Clients and staff must never reach each other's surface. The API wrappers check this too;
  // this bounces them before any page shell renders.
  const isClient = session.user.kind === "client"

  // The one shared surface: the project mailer API. It grants nothing - every route behind it
  // uses withMailerAccess, which re-checks the client's grant and module.
  const isSharedMailerApi = /^\/api\/projects\/[^/]+\/mailer(\/|$)/.test(pathname)

  if (isClient && !isPortalPath && !isPortalApi && !isSharedMailerApi) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.redirect(onThisOrigin(appUrl("/portal")))
  }

  if (!isClient && (isPortalPath || isPortalApi)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.redirect(onThisOrigin(appUrl("/projects")))
  }

  // Force-password-change gate. The change endpoint and /api/auth/* stay open, or the request
  // that clears the flag would be blocked. Clients use a page inside /portal - the split above
  // would bounce them off /change-password in a loop.
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

  // Page RBAC (APIs check their own). /dashboard is open to every role.
  if (!pathname.startsWith("/api/")) {
    const perm = requiredPermFor(pathname)
    if (!isAuthorized(perm, session.user.roles ?? [], session.user.permissions ?? [])) {
      return NextResponse.redirect(onThisOrigin(appUrl("/dashboard")))
    }
  }

  // The tenant comes from the SESSION (proven equal to the URL slug above). A prefixed URL is
  // rewritten to the app path, so the route tree needs no /{tenant} folder.
  if (sessionSlug) headers.set(TENANT_HEADER, sessionSlug)
  if (session.user.tenantId) headers.set(TENANT_ID_HEADER, session.user.tenantId)

  if (claimedSlug) {
    headers.set(REWRITE_MARKER, "1")
    // Next serves a rewrite internally only if its origin matches the request AS IT ARRIVED:
    // x-forwarded-proto (nginx) or plain http - NOT nextUrl, which Auth.js rebuilds from
    // NEXTAUTH_URL. A mismatch proxies every page out through nginx and loops into a 502.
    // A relative URL throws ERR_INVALID_URL. The proxy in front must send x-forwarded-proto.
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
}
