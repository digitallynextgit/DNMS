/**
 * M3 routing verification - drives a RUNNING server over HTTP.
 *
 *   pnpm build && PORT=3111 pnpm start        # in one terminal
 *   BASE=http://localhost:3111 npx tsx --conditions=react-server scripts/verify-tenant-routing.ts
 *
 * The unit checks in verify-tenant-urls.ts prove the string logic. This proves
 * the thing that actually matters: what proxy.ts does with a real request.
 *
 * A session is MINTED here with the same `encode()` Auth.js uses, from a real
 * employee's row, because the signed-in paths - the rewrite, the canonical
 * redirect, the wrong-tenant bounce - are most of the behaviour and are
 * unreachable signed out.
 *
 * Every request below is a GET that either redirects inside the proxy or renders
 * a page. Nothing is written.
 */
import "dotenv/config"
import { encode } from "next-auth/jwt"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { loadActiveMemberships } from "@/server/identity"

const BASE = process.env.BASE ?? "http://localhost:3111"
// Auth.js v5 names the cookie __Secure-… only over https; this harness is http.
const COOKIE_NAME = "authjs.session-token"

let failures = 0
const ok = (s: string) => console.log(`  ✓ ${s}`)
const bad = (s: string) => {
  console.log(`  ✗ ${s}`)
  failures++
}

interface Probe {
  status: number
  location: string | null
}

async function get(path: string, cookie?: string, extraHeaders: HeadersInit = {}): Promise<Probe> {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: { ...(cookie ? { cookie } : {}), ...extraHeaders },
  })
  const location = res.headers.get("location")
  // Normalise to a path so assertions do not depend on the host.
  return {
    status: res.status,
    location: location ? location.replace(BASE, "").replace(/^https?:\/\/[^/]+/, "") : null,
  }
}

function expect(label: string, actual: Probe, status: number, location?: string | null) {
  const statusOk = actual.status === status
  const locOk = location === undefined || actual.location === location
  if (statusOk && locOk) {
    ok(`${label} → ${actual.status}${actual.location ? ` ${actual.location}` : ""}`)
  } else {
    bad(
      `${label}\n      expected ${status}${location !== undefined ? ` ${location}` : ""}` +
        `\n      got      ${actual.status}${actual.location ? ` ${actual.location}` : ""}`,
    )
  }
}

async function main() {
  console.log(`\nM3 ROUTING - against ${BASE}`)
  console.log("─".repeat(78))

  // ---- Signed out --------------------------------------------------------
  console.log("\n== Signed out ==")
  expect("GET /            (marketing)", await get("/"), 200)
  expect("GET /login", await get("/login"), 200)
  expect(
    "GET /dashboard   → login, callback kept",
    await get("/dashboard"),
    307,
    "/login?callbackUrl=/dashboard",
  )
  expect(
    "GET /digitallynext/dashboard → login, callback KEEPS the prefix",
    await get("/digitallynext/dashboard"),
    307,
    "/login?callbackUrl=/digitallynext/dashboard",
  )
  expect("GET /api/employees → 401 JSON, not a redirect", await get("/api/employees"), 401)

  // ---- Signed in ---------------------------------------------------------
  // A real employee WITH their real roles: an API probe against a token with no
  // grants would 403 for reasons that have nothing to do with the URL space.
  const employee = await db.employee.findFirst({
    where: { isActive: true, passwordHash: { not: null } },
    select: {
      id: true,
      employeeNo: true,
      email: true,
      employeeRoles: {
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
      },
    },
    orderBy: { employeeNo: "asc" },
  })
  if (!employee) {
    bad("no active employee to mint a session for")
    return finish()
  }
  const own = await db.membership.findUnique({
    where: { employeeId: employee.id },
    select: { userId: true },
  })
  const membership = (await loadActiveMemberships(own!.userId))[0]!
  const roles = employee.employeeRoles.map((er) => er.role.name)
  const permissions = [
    ...new Set(
      employee.employeeRoles.flatMap((er) =>
        er.role.rolePermissions.map((rp) => rp.permission.scope),
      ),
    ),
  ]

  const secret = process.env.AUTH_SECRET
  if (!secret) {
    bad("AUTH_SECRET is not set - cannot mint a session")
    return finish()
  }

  const token = await encode({
    token: {
      id: employee.id,
      kind: "employee",
      userId: own!.userId,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenantSlug,
      employeeNo: employee.employeeNo,
      firstName: "Probe",
      lastName: "Session",
      company: null,
      profilePhoto: null,
      roles,
      permissions,
      mustChangePassword: false,
      // Fresh, so the 15-minute re-check does not fire mid-probe.
      checkedAt: Date.now(),
    },
    secret,
    salt: COOKIE_NAME,
  })
  const cookie = `${COOKIE_NAME}=${token}`
  const slug = membership.tenantSlug
  console.log(`\n== Signed in as ${employee.employeeNo} in "${slug}" ==`)

  expect(
    `GET /dashboard → canonical /${slug}/dashboard`,
    await get("/dashboard", cookie),
    307,
    `/${slug}/dashboard`,
  )
  expect(
    `GET /projects/my-projects → canonical`,
    await get("/projects/my-projects", cookie),
    307,
    `/${slug}/projects/my-projects`,
  )
  expect(
    "query string survives the canonical redirect",
    await get("/leave/types?tab=policy", cookie),
    307,
    `/${slug}/leave/types?tab=policy`,
  )
  expect(
    `GET /${slug}  → the tenant's front door`,
    await get(`/${slug}`, cookie),
    307,
    `/${slug}/dashboard`,
  )
  expect(`GET /${slug}/dashboard renders`, await get(`/${slug}/dashboard`, cookie), 200)
  expect(
    "another tenant's URL → /select-workspace",
    await get("/acme-corp/dashboard", cookie),
    307,
    "/select-workspace?next=/acme-corp/dashboard",
  )
  expect(
    "another tenant's API → 403, never a redirect",
    await get("/acme-corp/api/employees", cookie),
    403,
  )
  // A redirect() that runs after the shell has begun streaming cannot be a 307 -
  // Next delivers it inside the RSC payload instead, and the browser follows it.
  // So "did it redirect" has to allow both shapes.
  {
    const res = await fetch(`${BASE}/select-workspace`, { headers: { cookie }, redirect: "manual" })
    const target = `/${slug}/dashboard`
    if (res.status === 307 && (res.headers.get("location") ?? "").endsWith(target)) {
      ok(`one membership → the picker forwards to ${target} (307)`)
    } else if (res.status === 200) {
      const body = await res.text()
      if (body.includes("NEXT_REDIRECT") && body.includes(target.slice(1))) {
        ok(`one membership → the picker forwards to ${target} (streamed redirect)`)
      } else if (body.includes("more than one company")) {
        bad("the picker was shown for a single membership")
      } else {
        bad(`the picker neither forwarded nor rendered a choice (200, no redirect in payload)`)
      }
    } else {
      bad(`/select-workspace returned ${res.status}`)
    }
  }
  expect(
    "prefixed global route redirects to the bare one",
    await get(`/${slug}/login`, cookie),
    307,
    "/login",
  )
  // APIs are token-scoped, so they must reach their handler with no prefix and
  // no redirect. /api/profile is self-service and answers for any staff session;
  // /api/employees may legitimately 403 for someone without employee:read - what
  // matters is that the answer comes from the route, never from the proxy.
  expect(
    "/api/profile reaches its handler under a tenant session",
    await get("/api/profile", cookie),
    200,
  )
  {
    const probe = await get("/api/employees", cookie)
    if (probe.status === 307 || probe.status === 308 || probe.location) {
      bad(`/api/employees was redirected to ${probe.location} - APIs must never be`)
    } else {
      ok(`/api/employees answered from its handler (${probe.status}), not the proxy`)
    }
  }

  // ---- Header spoofing ---------------------------------------------------
  //
  // `x-tenant-slug` decides which tenant server code builds URLs for. A client
  // sends it here; the page must come back scoped to the SESSION's tenant, not
  // the header's. Both requests must therefore render identically.
  console.log("\n== A forged x-tenant-slug header is ignored ==")
  const honest = await fetch(`${BASE}/${slug}/dashboard`, { headers: { cookie } })
  const forged = await fetch(`${BASE}/${slug}/dashboard`, {
    headers: { cookie, "x-tenant-slug": "acme-corp" },
  })
  const [honestBody, forgedBody] = await Promise.all([honest.text(), forged.text()])
  if (honest.status !== 200 || forged.status !== 200) {
    bad(`could not compare renders (${honest.status} vs ${forged.status})`)
  } else if (forgedBody.includes("/acme-corp/")) {
    bad("the forged header reached the render - links point at acme-corp")
  } else if (honestBody.length === forgedBody.length) {
    ok("forged header changed nothing - proxy.ts stripped it")
  } else {
    // Lengths can differ for innocent reasons (timestamps); the assertion that
    // matters is that no acme-corp URL was produced.
    ok("forged header produced no acme-corp URLs")
  }

  // ---- The links the page actually rendered ------------------------------
  console.log("\n== The rendered page emits prefixed links ==")
  const hrefs = [...honestBody.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1] as string)
  const appHrefs = hrefs.filter((h) =>
    /^\/(dashboard|projects|employees|leave|wfh|payroll)/.test(h),
  )
  const prefixed = hrefs.filter((h) => h.startsWith(`/${slug}/`))
  if (prefixed.length === 0) bad("no tenant-prefixed links in the rendered page")
  else ok(`${prefixed.length} links carry /${slug}/`)
  if (appHrefs.length > 0) {
    bad(`${appHrefs.length} app link(s) still un-prefixed, e.g. ${appHrefs.slice(0, 5).join(", ")}`)
  } else {
    ok("no un-prefixed app links remain in the shell")
  }

  finish()
}

function finish() {
  console.log("─".repeat(78))
  console.log(failures === 0 ? "ROUTING VERIFIED.\n" : `${failures} check(s) FAILED.\n`)
  process.exitCode = failures === 0 ? 0 : 1
}

runUnscoped("routing check: mints a session from a real account", main)
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
