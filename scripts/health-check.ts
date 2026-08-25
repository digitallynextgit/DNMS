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
import { encode } from "next-auth/jwt"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { loadActiveMemberships } from "@/server/identity"

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
]

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
  console.log("\n── Legacy un-prefixed pages redirect to the canonical URL ──")
  let canonical = 0
  for (const page of PAGES) {
    const r = await probe(page, cookie)
    if (r.status === 307 && r.location === `/${slug}${page}`) canonical++
    else bad(`${page} → ${r.status} ${r.location ?? ""} (expected 307 /${slug}${page})`)
  }
  console.log(`  ${canonical}/${PAGES.length} canonicalise`)

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
