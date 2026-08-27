/**
 * Whole-app health sweep - drives a RUNNING server over HTTP.
 *
 *   pnpm build && PORT=3111 pnpm start
 *   BASE=http://localhost:3111 npx tsx --conditions=react-server scripts/health-check.ts
 *
 * Walks every page route and a sample of API routes, signed in, at BOTH the
 * tenant-prefixed and the legacy un-prefixed address, and reports anything that
 * is not a 200 or an expected redirect. Static assets and the favicon chain are
 * checked too, because a broken icon is invisible to a build that compiles.
 *
 * Read-only: every request is a GET.
 */
import "dotenv/config"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { encode } from "next-auth/jwt"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { loadActiveMemberships } from "@/server/identity"
import { GLOBAL_SEGMENTS } from "@/lib/tenant-url"
import { LEGAL_INDEX } from "@/features/marketing/legal.content"

const BASE = process.env.BASE ?? "http://localhost:3111"
const COOKIE_NAME = "authjs.session-token"

/** Page routes an admin should be able to open. */
const PAGES = [
  "/dashboard",
  "/analytics",
  "/announcements",
  "/attendance",
  "/attendance/me",
  "/attendance/attendance-directory",
  "/chat",
  "/documents",
  "/employees",
  "/employees/employee-directory",
  "/employees/org-chart",
  "/gallery",
  "/holiday-calendar",
  "/holidays",
  "/leave",
  "/leave/apply",
  "/leave/leave-directory",
  "/leave/types",
  "/more",
  "/notifications",
  "/payroll",
  "/payroll/me",
  "/payroll/payroll-directory",
  "/payroll/salary-structures",
  "/performance",
  "/performance/me",
  "/performance/evaluations",
  "/profile",
  "/projects",
  "/projects/my-projects",
  "/projects/my-tasks",
  "/projects/progress",
  "/recruitment",
  "/recruitment/applications",
  "/referrals",
  "/resignations",
  "/wfh",
  "/wfh/apply",
  "/wfh/requests",
  "/admin/roles",
  "/admin/permissions",
  "/admin/audit-log",
  // Admin-only sections. These were missing for a long time and the omission was
  // invisible: the sweep reported 42/42 green while 25 real routes - nearly all
  // of them reachable only from an admin's sidebar - were never requested once.
  // A blind spot shaped exactly like "works as an employee, breaks as an admin".
  "/admin/careers",
  "/admin/email-templates",
  "/admin/integrations",
  "/admin/referrals",
  "/admin/storage",
  "/attendance/devices",
  "/attendance/floating-holidays",
  "/employees/departments",
  "/employees/designations",
  "/employees/job-roles",
  "/employees/new",
  "/leave/policy",
  "/leave/team",
  "/performance/kpi-profiles",
  "/wfh/team",
  "/platform",
  "/docs",
  "/select-workspace",
]

/**
 * Fail if a page route exists on disk but nobody added it to PAGES.
 *
 * Hand-maintained lists rot silently, and this one did: every route added after
 * the list was written stayed unswept, so a green sweep meant "the routes I
 * remembered still work", not "the app works". Reading the routes back off the
 * filesystem turns that from a thing you have to remember into a thing that
 * breaks the check.
 *
 * Dynamic segments are excluded - they need a real id to request - as are the
 * unauthenticated entry points, which are covered by their own probes below.
 */
function assertNoUnsweptRoutes(): void {
  const roots = ["app"]
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === "page.tsx") {
        const route =
          "/" +
          full
            .replace(/\\/g, "/") // Windows separators first, so one regex set works
            .replace(/^app\//, "")
            .replace(/(^|\/)page\.tsx$/, "")
            .replace(/\([^)]*\)\/?/g, "") // route groups do not appear in the URL
            .replace(/\/+$/, "")
        found.push(route)
      }
    }
  }
  for (const r of roots) walk(r)

  const exempt = new Set([
    "/", // marketing home, requested directly below
    "/login",
    "/client-login",
    "/forgot-password",
    "/signup",
    "/change-password",
    "/portal",
    "/portal/set-password",
    // Public marketing pages. Swept by their own signed-OUT probe below, which
    // is the state that matters for them - a visitor reading the privacy policy
    // has no session, and checking them with an admin cookie would miss exactly
    // the failure that matters.
    "/about",
    "/contact",
    "/pricing",
    "/faq",
    ...LEGAL_INDEX.map((d) => `/legal/${d.slug}`),
  ])
  const unswept = found
    .filter((r) => !r.includes("[") && !exempt.has(r) && !PAGES.includes(r))
    .sort()

  if (unswept.length > 0) {
    console.log("\n── Unswept routes ──")
    for (const r of unswept) console.log(`  ✗ ${r} exists but is not in PAGES`)
    console.log(`\n  ${unswept.length} route(s) would never be health-checked.`)
    console.log("  Add them to PAGES in scripts/health-check.ts.")
    process.exitCode = 1
  }
}

const APIS = [
  "/api/profile",
  "/api/employees",
  "/api/notifications/inbox",
  "/api/dashboard/stats",
  "/api/leave/balances",
]

const ASSETS = [
  "/favicon.ico",
  "/icon.png",
  "/apple-touch-icon.png",
  "/logo_dark_bg.webp",
  "/logo_white_bg.png",
  "/theme-boot.js",
  "/robots.txt",
  "/sitemap.xml",
  // A directory under public/: the case that broke when "avatars" was read as a
  // tenant slug and stripped. Every file beneath it 404d.
  "/avatars/av-web-01.webp",
  "/avatars/av-design-01.webp",
  "/email-icons/mail.png",
]

let problems = 0
const bad = (s: string) => {
  console.log(`  ✗ ${s}`)
  problems++
}

async function probe(path: string, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  })
  const body = res.status === 200 ? await res.text() : ""
  return {
    status: res.status,
    location: res.headers.get("location")?.replace(/^https?:\/\/[^/]+/, "") ?? null,
    type: res.headers.get("content-type") ?? "",
    body,
  }
}

async function main() {
  console.log(`\nHEALTH SWEEP - ${BASE}`)
  console.log("═".repeat(78))

  // Before anything is requested: is the list of things to request complete?
  assertNoUnsweptRoutes()

  // Pick an admin so permission-gated pages are actually exercised rather than
  // bouncing to /dashboard and reporting a false green.
  const employee =
    (await db.employee.findFirst({
      where: {
        isActive: true,
        employeeRoles: { some: { role: { name: "admin" } } },
      },
      select: {
        id: true,
        employeeNo: true,
        employeeRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    })) ??
    (await db.employee.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        employeeNo: true,
        employeeRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    }))
  if (!employee) throw new Error("no employee to test with")

  const own = await db.membership.findUnique({
    where: { employeeId: employee.id },
    select: { userId: true },
  })
  const membership = (await loadActiveMemberships(own!.userId))[0]!
  const slug = membership.tenantSlug
  const roles = employee.employeeRoles.map((er) => er.role.name)
  const permissions = [
    ...new Set(
      employee.employeeRoles.flatMap((er) =>
        er.role.rolePermissions.map((rp) => rp.permission.scope),
      ),
    ),
  ]

  const cookie = `${COOKIE_NAME}=${await encode({
    token: {
      id: employee.id,
      kind: "employee",
      userId: own!.userId,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      tenantSlug: slug,
      employeeNo: employee.employeeNo,
      firstName: "Health",
      lastName: "Check",
      company: null,
      profilePhoto: null,
      roles,
      permissions,
      mustChangePassword: false,
      checkedAt: Date.now(),
    },
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE_NAME,
  })}`

  console.log(
    `signed in as ${employee.employeeNo} · roles [${roles.join(", ") || "none"}] · /${slug}`,
  )

  // ---- Static assets and the icon chain ----------------------------------
  console.log("\n── Static assets ──")
  for (const path of ASSETS) {
    const r = await probe(path)
    if (r.status !== 200) bad(`${path} → ${r.status}`)
  }
  console.log(`  ${ASSETS.length} assets checked`)

  console.log("\n── Icon <link> tags, per layout ──")
  for (const [label, path] of [
    ["marketing /", "/"],
    ["dashboard", `/${slug}/dashboard`],
    ["auth /login", "/login"],
  ] as const) {
    const r = await probe(path, cookie)
    if (r.status !== 200) {
      bad(`${label} (${path}) → ${r.status}`)
      continue
    }
    const tags = [...r.body.matchAll(/<link[^>]*rel="[^"]*icon[^"]*"[^>]*>/g)].map((m) => m[0])
    const hrefs = tags
      .map((t) => t.match(/href="([^"]+)"/)?.[1])
      .filter((h): h is string => Boolean(h))
    if (hrefs.length === 0) {
      bad(`${label}: no icon <link> emitted`)
      continue
    }
    // Every icon href must resolve, and must be absolute - a relative one would
    // resolve against /{tenant}/... and 404 on every prefixed page.
    for (const href of hrefs) {
      if (!href.startsWith("/")) {
        bad(`${label}: icon href "${href}" is relative - breaks under /{tenant}/`)
        continue
      }
      const asset = await probe(href)
      if (asset.status !== 200) bad(`${label}: icon ${href} → ${asset.status}`)
    }
    console.log(`  ${label}: ${hrefs.join(", ")} — all resolve`)
  }

  // ---- Pages, prefixed ----------------------------------------------------
  console.log("\n── Pages at /{tenant}/… ──")
  let pageOk = 0
  const denied: string[] = []
  for (const page of PAGES) {
    const r = await probe(`/${slug}${page}`, cookie)
    if (r.status === 200) pageOk++
    else if (r.status === 307 && r.location === `/${slug}/dashboard`) denied.push(page)
    else if (r.status === 307 && r.location?.startsWith(`/${slug}/`)) pageOk++
    else bad(`/${slug}${page} → ${r.status}${r.location ? ` ${r.location}` : ""}`)
  }
  console.log(`  ${pageOk}/${PAGES.length} render`)
  if (denied.length)
    console.log(`  ${denied.length} permission-denied (expected): ${denied.join(", ")}`)

  // ---- Pages, legacy un-prefixed → must all canonicalise ------------------
  //
  // GLOBAL routes are the exception and must NOT canonicalise: /platform
  // administers every tenant and /select-workspace is where you choose one, so
  // neither can sit behind a single tenant's prefix. The exception is read from
  // the same GLOBAL_SEGMENTS the proxy routes on, so the two cannot disagree -
  // spelling the list out again here is how a check ends up asserting the
  // opposite of what the app is supposed to do.
  console.log("\n── Legacy un-prefixed pages redirect to the canonical URL ──")
  let canonical = 0
  let globalPages = 0
  for (const page of PAGES) {
    const first = page.split("/")[1] ?? ""
    const r = await probe(page, cookie)
    if (GLOBAL_SEGMENTS.has(first)) {
      globalPages++
      if (r.status === 200) canonical++
      else bad(`${page} → ${r.status} (a global route must serve un-prefixed)`)
      continue
    }
    if (r.status === 307 && r.location === `/${slug}${page}`) canonical++
    else bad(`${page} → ${r.status} ${r.location ?? ""} (expected 307 /${slug}${page})`)
  }
  console.log(
    `  ${canonical}/${PAGES.length} canonicalise (${globalPages} global, correctly un-prefixed)`,
  )

  // ---- APIs ---------------------------------------------------------------
  console.log("\n── API routes (must never redirect) ──")
  for (const api of APIS) {
    const r = await probe(api, cookie)
    if (r.status === 307 || r.status === 308 || r.location) {
      bad(`${api} was redirected to ${r.location}`)
    } else if (r.status >= 500) {
      bad(`${api} → ${r.status}`)
    } else {
      console.log(`  ${api} → ${r.status}`)
    }
  }

  // ---- Public, key-authenticated APIs -------------------------------------
  //
  // These have NO session, so they establish tenant context from the API key
  // (server/public-api.ts). Missing from this sweep originally, which is how
  // /api/public/careers reached production querying with no tenant context at
  // all - under strict enforcement the guard refused and the throw escaped the
  // handler. Probed WITH the key, because without one every request stops at
  // 401 before it ever reaches a query.
  // ---- Public marketing pages, signed OUT --------------------------------
  //
  // The state that actually matters for these. Every one of them must render
  // for a visitor with no cookie: they are linked from the footer, indexed in
  // the sitemap, and a legal page that bounces to /login is worse than absent.
  //
  // They are also the exact shape of the /avatars bug - a top-level segment
  // with no dot reads as a tenant slug unless GLOBAL_SEGMENTS says otherwise,
  // so a 307 here means the proxy stripped it and served the wrong route.
  console.log("\n── Public marketing pages (no session) ──")
  {
    const publicPages = [
      "/about",
      "/contact",
      "/pricing",
      "/faq",
      ...LEGAL_INDEX.map((d) => `/legal/${d.slug}`),
      "/signup",
    ]
    let served = 0
    for (const path of publicPages) {
      const r = await probe(path) // no cookie: a real visitor
      if (r.status === 200) served++
      else bad(`${path} → ${r.status} ${r.location ?? ""} (must render signed out)`)
    }
    console.log(`  ${served}/${publicPages.length} render for a signed-out visitor`)

    // The contact form posts from one of those pages, so its endpoint has to be
    // reachable without a session too. An empty body is a 422 from validation -
    // proof it reached the handler. A 401 means the proxy blocked it, which is
    // how the newsletter endpoint was failing silently for every visitor.
    const contact = await fetch(`${BASE}/api/public/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
    if (contact.status === 401 || contact.status === 307) {
      bad(`contact form endpoint → ${contact.status} (not public - check PUBLIC_PREFIXES)`)
    } else {
      console.log(`  contact form endpoint reachable signed out → ${contact.status}`)
    }

    const news = await fetch(`${BASE}/api/marketing/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
    if (news.status === 401 || news.status === 307) {
      bad(`newsletter endpoint → ${news.status} (not public - check PUBLIC_PREFIXES)`)
    } else {
      console.log(`  newsletter endpoint reachable signed out → ${news.status}`)
    }
  }

  console.log("\n── Public APIs (key-authenticated, no session) ──")
  const careersKey = process.env.CAREERS_API_KEY
  if (!careersKey) {
    console.log("  · CAREERS_API_KEY not set locally - skipped")
  } else {
    for (const [label, path] of [
      ["careers full-time", "/api/public/careers?mode=full-time"],
      ["careers internship", "/api/public/careers?mode=internship"],
    ] as const) {
      const res = await fetch(`${BASE}${path}`, { headers: { "x-api-key": careersKey } })
      if (res.status !== 200) {
        const body = await res.text()
        bad(`${label} → ${res.status} ${body.slice(0, 120)}`)
      } else {
        console.log(`  ${label} → 200`)
      }
    }
    // A wrong key must still be refused - the tenant wrapper must not have
    // loosened the gate.
    const denied = await fetch(`${BASE}/api/public/careers?mode=full-time`, {
      headers: { "x-api-key": "definitely-not-the-key" },
    })
    if (denied.status !== 401) bad(`a bad API key returned ${denied.status}, expected 401`)
    else console.log("  a wrong key → 401")
  }

  // ---- NO-SESSION paths ---------------------------------------------------
  //
  // The blind spot that let three separate bugs reach production. Every probe
  // above carries a session, so the `x-tenant-id` header the proxy writes is
  // always present and the tenant guard's fallback silently covers for anything
  // that failed to establish context another way.
  //
  // These have NO session, by definition - you are signing in, or resetting a
  // password you have forgotten - so they depend on runUnscoped() alone. That is
  // exactly where a duplicated AsyncLocalStorage broke sign-in outright:
  //
  //   [auth][cause]: [TENANT] refusing Membership.findMany with no tenant context
  //
  // thrown from inside a function that WAS wrapped.
  console.log("\n── No-session paths (nothing to fall back on) ──")
  {
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`)
    const setCookie = csrfRes.headers.get("set-cookie") ?? ""
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

    // A WRONG password on purpose: this exercises the whole authorize() path -
    // findLoginUser, then loadActiveMemberships - without signing anyone in.
    const signIn = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: setCookie.split(";")[0] ?? "",
      },
      body: new URLSearchParams({
        csrfToken,
        email: "verification-probe@example.invalid",
        password: "not-a-real-password",
      }),
    })
    // 302 back to the login page is the correct answer to a bad credential.
    // A 500 means the path threw before it could decide.
    if (signIn.status >= 500) bad(`credentials sign-in path → ${signIn.status} (it threw)`)
    else console.log(`  credentials sign-in path → ${signIn.status}`)

    // Unknown address: reaches the employee lookup, then declines. A 500 here
    // means the lookup itself was refused.
    const forgot = await fetch(`${BASE}/api/password/forgot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "verification-probe@example.invalid" }),
    })
    if (forgot.status >= 500) bad(`forgot-password path → ${forgot.status} (it threw)`)
    else console.log(`  forgot-password path → ${forgot.status}`)
  }

  console.log("═".repeat(78))
  console.log(problems === 0 ? "NO PROBLEMS FOUND.\n" : `${problems} problem(s) found.\n`)
  process.exitCode = problems === 0 ? 0 : 1
}

runUnscoped("health sweep: picks a real account to drive the app with", main)
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
