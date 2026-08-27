/**
 * Load test - drives a RUNNING server and reports latency percentiles.
 *
 *   pnpm build && TENANT_ENFORCEMENT=strict PORT=3111 pnpm start
 *   BASE=http://localhost:3111 npx tsx --conditions=react-server scripts/load-test.ts
 *
 * Ramps concurrency and, at each step, reports throughput and p50/p95/p99 for a
 * representative mix of pages and API routes, signed in as an admin.
 *
 * WHAT THIS DOES AND DOES NOT TELL YOU.
 *
 * It measures ONE Node process on whatever machine it runs on. It is a per-
 * process ceiling and a relative ranking of routes - "which endpoint is
 * expensive", "where does latency knee", "does the pool saturate". It is NOT a
 * production capacity number: the VPS has different cores, the database is
 * remote, and real traffic is not a uniform mix.
 *
 * Read it as: the shape of the curve is real, the absolute numbers move with
 * the hardware.
 *
 * Read-only: every request is a GET.
 */
import "dotenv/config"
import { encode } from "next-auth/jwt"
import { db } from "@/server/db"
import { FOUNDING_TENANT_ID, runUnscoped } from "@/server/tenant-context"
import { loadActiveMemberships } from "@/server/identity"

const BASE = process.env.BASE ?? "http://localhost:3111"
const COOKIE_NAME = "authjs.session-token"

/** Concurrency steps. Each runs for DURATION_MS. */
const STEPS = (process.env.STEPS ?? "1,5,10,25,50,100").split(",").map(Number)
const DURATION_MS = Number(process.env.DURATION_MS ?? 8000)

/**
 * A representative mix, weighted the way real traffic is: most people look at
 * the dashboard and their own things, a few open the heavy directories.
 */
const MIX: { path: string; weight: number; label: string }[] = [
  { path: "/dashboard", weight: 30, label: "dashboard" },
  { path: "/api/dashboard/stats", weight: 20, label: "api:stats" },
  { path: "/api/notifications/inbox", weight: 15, label: "api:inbox" },
  { path: "/api/profile", weight: 10, label: "api:profile" },
  { path: "/projects", weight: 10, label: "projects" },
  { path: "/attendance/me", weight: 5, label: "attendance/me" },
  { path: "/employees/employee-directory", weight: 5, label: "employee-dir" },
  { path: "/api/employees", weight: 5, label: "api:employees" },
]

function pick(): { path: string; label: string } {
  const total = MIX.reduce((s, m) => s + m.weight, 0)
  let r = Math.random() * total
  for (const m of MIX) {
    r -= m.weight
    if (r <= 0) return m
  }
  return MIX[0]!
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[i]!
}

async function mintAdminCookie(): Promise<{ cookie: string; slug: string; who: string }> {
  const employee = await runUnscoped("load-test", () =>
    db.employee.findFirst({
      // PINNED TO THE FOUNDING TENANT, and that matters.
      //
      // An unscoped findFirst() for "an active admin" returned whichever row
      // came first - and once a second company signed up, that was THEIR admin.
      // Every check then ran against a one-employee workspace with no projects,
      // no payroll and no attendance: pages returned 200 because they render
      // fine when empty, so the sweep stayed green while testing almost nothing.
      where: {
        isActive: true,
        tenantId: FOUNDING_TENANT_ID,
        employeeRoles: { some: { role: { name: "admin" } } },
      },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePhoto: true,
        employeeRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    }),
  )
  if (!employee) throw new Error("no admin to test with")
  const own = await runUnscoped("load-test", () =>
    db.membership.findUnique({ where: { employeeId: employee.id }, select: { userId: true } }),
  )
  const m = (await loadActiveMemberships(own!.userId))[0]!
  const roles = employee.employeeRoles.map((er) => er.role.name)
  const permissions = [
    ...new Set(
      employee.employeeRoles.flatMap((er) =>
        er.role.rolePermissions.map((rp) => rp.permission.scope),
      ),
    ),
  ]
  const jwt = await encode({
    token: {
      id: employee.id,
      userId: own!.userId,
      membershipId: m.id,
      tenantId: m.tenantId,
      tenantSlug: m.tenantSlug,
      kind: "employee",
      employeeNo: employee.employeeNo,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      profilePhoto: employee.profilePhoto,
      roles,
      permissions,
      mustChangePassword: false,
      checkedAt: Date.now(),
      sub: employee.id,
    },
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET!,
    salt: COOKIE_NAME,
    maxAge: 2592000,
  })
  return {
    cookie: `${COOKIE_NAME}=${jwt}`,
    slug: m.tenantSlug,
    who: `${employee.employeeNo} [${roles.join(", ")}]`,
  }
}

interface Sample {
  ms: number
  status: number
  label: string
}

async function runStep(
  concurrency: number,
  cookie: string,
  slug: string,
): Promise<{ samples: Sample[]; elapsed: number }> {
  const samples: Sample[] = []
  const deadline = Date.now() + DURATION_MS
  const started = Date.now()

  const worker = async () => {
    while (Date.now() < deadline) {
      const { path, label } = pick()
      // Pages carry the tenant prefix; API routes do not.
      const url = path.startsWith("/api/") ? `${BASE}${path}` : `${BASE}/${slug}${path}`
      const t0 = performance.now()
      let status = 0
      try {
        const res = await fetch(url, {
          headers: { cookie, "x-forwarded-proto": "https" },
          redirect: "manual",
        })
        status = res.status
        // Drain the body: not doing so leaves the socket half-read and measures
        // time-to-headers instead of time-to-response, which flatters every number.
        await res.arrayBuffer()
      } catch {
        status = 0
      }
      samples.push({ ms: performance.now() - t0, status, label })
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  return { samples, elapsed: Date.now() - started }
}

async function main() {
  const { cookie, slug, who } = await mintAdminCookie()
  console.log(`\nLOAD TEST - ${BASE}`)
  console.log("═".repeat(78))
  console.log(`signed in as ${who} · tenant /${slug}`)
  console.log(`${DURATION_MS}ms per step · mix of ${MIX.length} routes\n`)

  console.log("  conc     req/s    p50      p95      p99      max     errors")
  console.log("  " + "─".repeat(64))

  const perLabel = new Map<string, number[]>()
  let sawFailure = false

  for (const concurrency of STEPS) {
    const { samples, elapsed } = await runStep(concurrency, cookie, slug)
    const okSamples = samples.filter((s) => s.status > 0 && s.status < 500)
    const errors = samples.length - okSamples.length
    if (errors > 0) sawFailure = true

    for (const s of okSamples) {
      if (!perLabel.has(s.label)) perLabel.set(s.label, [])
      perLabel.get(s.label)!.push(s.ms)
    }

    const sorted = okSamples.map((s) => s.ms).sort((a, b) => a - b)
    const rps = (samples.length / elapsed) * 1000
    console.log(
      `  ${String(concurrency).padStart(4)}  ${rps.toFixed(0).padStart(8)}  ` +
        `${percentile(sorted, 50).toFixed(0).padStart(6)}ms ` +
        `${percentile(sorted, 95).toFixed(0).padStart(6)}ms ` +
        `${percentile(sorted, 99).toFixed(0).padStart(6)}ms ` +
        `${(sorted[sorted.length - 1] ?? 0).toFixed(0).padStart(6)}ms  ` +
        `${String(errors).padStart(6)}${errors > 0 ? " ✗" : ""}`,
    )
  }

  console.log("\n── Per-route latency (all steps pooled) ──")
  const rows = [...perLabel.entries()]
    .map(([label, ms]) => {
      const s = ms.sort((a, b) => a - b)
      return { label, n: s.length, p50: percentile(s, 50), p95: percentile(s, 95) }
    })
    .sort((a, b) => b.p95 - a.p95)
  console.log("  route                      n      p50       p95")
  console.log("  " + "─".repeat(48))
  for (const r of rows) {
    console.log(
      `  ${r.label.padEnd(22)} ${String(r.n).padStart(5)}  ${r.p50.toFixed(0).padStart(6)}ms  ${r.p95.toFixed(0).padStart(6)}ms`,
    )
  }

  if (sawFailure) {
    console.log("\n  ✗ Requests failed or 5xx'd under load - see the errors column above.")
    process.exitCode = 1
  }
  await db.$disconnect()
}

main()
