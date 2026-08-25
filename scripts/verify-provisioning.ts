/**
 * M5 provisioning + the first real two-tenant isolation test.
 *
 *   npx tsx --conditions=react-server scripts/verify-provisioning.ts
 *
 * Everything M1-M4 built has, until now, been verified against a single tenant
 * and a made-up "ghost" id. This actually creates a second company, checks that
 * the two cannot see each other, and removes it again.
 *
 * It WRITES - a real tenant is created. The `finally` always deprovisions, and
 * deprovisionTenant() refuses to touch Digitally Next, so the worst case of a
 * crash mid-run is a leftover `acme-test` workspace that a re-run cleans up.
 */
import "dotenv/config"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { FOUNDING_TENANT_ID, runUnscoped, runWithTenant } from "@/server/tenant-context"
import { findLoginUser, loadActiveMemberships } from "@/server/identity"
import {
  deprovisionTenant,
  provisionTenant,
  ProvisionError,
} from "@/features/tenants/server/provision.service"

const SLUG = "acme-test"
const ADMIN_EMAIL = "founder@acme-test.invalid"
const ADMIN_PASSWORD = "AcmeTest!2026"

let failures = 0
const ok = (s: string) => console.log(`  ✓ ${s}`)
const bad = (s: string) => {
  console.log(`  ✗ ${s}`)
  failures++
}
function check(pass: boolean, good: string, problem: string) {
  if (pass) ok(good)
  else bad(problem)
}

async function main() {
  console.log("\nPROVISIONING + TWO-TENANT ISOLATION (M5)")
  console.log("═".repeat(78))

  // Clean up anything a previous crashed run left behind.
  await runUnscoped("test setup", async () => {
    const stale = await db.tenant.findUnique({ where: { slug: SLUG }, select: { id: true } })
    if (stale) {
      console.log("  (removing a leftover acme-test from an earlier run)")
      await deprovisionTenant(SLUG)
    }
  })

  const before = await runUnscoped("baseline", async () => ({
    tenants: await db.tenant.count(),
    dnEmployees: await runWithTenant({ tenantId: FOUNDING_TENANT_ID, slug: "digitallynext" }, () =>
      db.employee.count(),
    ),
    dnEmployeeId: (await db.employee.findFirst({
      where: { tenantId: FOUNDING_TENANT_ID },
      select: { id: true },
    }))!.id,
  }))
  console.log(`  baseline: ${before.tenants} tenant(s), ${before.dnEmployees} DN employees`)

  try {
    // ---- Rejections come first: a signup form is a public surface ----------
    console.log("\n── Input the front door must refuse ──")
    for (const [label, input] of [
      ["a reserved slug (dashboard)", { slug: "dashboard" }],
      ["a route segment (projects)", { slug: "projects" }],
      ["a public/ directory (avatars)", { slug: "avatars" }],
      ["an existing slug (digitallynext)", { slug: "digitallynext" }],
      ["a slug with spaces", { slug: "acme corp" }],
      ["a short password", { adminPassword: "abc" }],
    ] as const) {
      try {
        await provisionTenant({
          companyName: "Acme Test",
          slug: SLUG,
          adminFirstName: "Ada",
          adminLastName: "Founder",
          adminEmail: ADMIN_EMAIL,
          adminPassword: ADMIN_PASSWORD,
          ...input,
        })
        bad(`${label} was ACCEPTED`)
        await deprovisionTenant((input as { slug?: string }).slug ?? SLUG).catch(() => {})
      } catch (err) {
        check(
          err instanceof ProvisionError,
          `${label} refused - ${(err as Error).message}`,
          `${label} failed for the wrong reason: ${(err as Error).message}`,
        )
      }
    }

    // ---- Provision for real ------------------------------------------------
    console.log("\n── Provisioning acme-test ──")
    const result = await provisionTenant({
      companyName: "Acme Test",
      slug: SLUG,
      adminFirstName: "Ada",
      adminLastName: "Founder",
      adminEmail: ADMIN_EMAIL,
      adminPassword: ADMIN_PASSWORD,
    })
    ok(`created tenant ${result.slug}`)

    const acme = { tenantId: result.tenantId, slug: SLUG }

    await runWithTenant(acme, async () => {
      const roles = await db.role.findMany({
        select: { name: true, _count: { select: { rolePermissions: true } } },
        orderBy: { name: "asc" },
      })
      check(
        roles.length === 5,
        `5 roles created: ${roles.map((r) => `${r.name}(${r._count.rolePermissions})`).join(" ")}`,
        `expected 5 roles, got ${roles.length}`,
      )
      const admin = roles.find((r) => r.name === "admin")
      check(
        (admin?._count.rolePermissions ?? 0) === 39,
        "the admin role holds all 39 permission scopes",
        `admin holds ${admin?._count.rolePermissions} scopes, expected 39`,
      )
      const types = await db.leaveType.count()
      check(types === 4, `${types} default leave types`, `expected 4 leave types, got ${types}`)

      const staff = await db.employee.findMany({ select: { email: true, employeeNo: true } })
      check(
        staff.length === 1 && staff[0]!.email === ADMIN_EMAIL,
        `one employee: ${staff[0]?.employeeNo} ${staff[0]?.email}`,
        `expected exactly the founder, got ${staff.length}`,
      )
    })

    // ---- The whole point: the two companies cannot see each other ----------
    console.log("\n── Isolation, with two REAL tenants ──")
    await runWithTenant(acme, async () => {
      const n = await db.employee.count()
      check(n === 1, "inside acme-test: 1 employee (its own founder)", `LEAK - acme saw ${n}`)

      const dnRow = await db.employee.findUnique({ where: { id: before.dnEmployeeId } })
      check(
        dnRow === null,
        "inside acme-test: a Digitally Next employee id resolves to null",
        "LEAK - acme read a Digitally Next employee by id",
      )

      const dnRoles = await db.role.findMany({ where: { name: "admin" } })
      check(
        dnRoles.length === 1,
        "inside acme-test: exactly one 'admin' role - its own",
        `LEAK - acme sees ${dnRoles.length} admin roles`,
      )
    })

    await runWithTenant({ tenantId: FOUNDING_TENANT_ID, slug: "digitallynext" }, async () => {
      const n = await db.employee.count()
      check(
        n === before.dnEmployees,
        `inside digitallynext: still ${n} employees - acme's founder is invisible`,
        `Digitally Next now sees ${n}, was ${before.dnEmployees}`,
      )
      const acmeRow = await db.employee.findFirst({ where: { email: ADMIN_EMAIL } })
      check(
        acmeRow === null,
        "inside digitallynext: acme's founder cannot be found by email",
        "LEAK - Digitally Next can read acme's employee",
      )
    })

    // ---- The founder can actually sign in ----------------------------------
    console.log("\n── The new admin can sign in ──")
    const candidate = await findLoginUser(ADMIN_EMAIL)
    check(Boolean(candidate), "a platform identity exists for the founder", "no users row created")
    if (candidate?.passwordHash) {
      check(
        await bcrypt.compare(ADMIN_PASSWORD, candidate.passwordHash),
        "the password they chose at signup verifies",
        "the stored hash does not match the signup password",
      )
    } else {
      bad("the founder's identity has no password hash")
    }
    const memberships = candidate ? await loadActiveMemberships(candidate.id) : []
    check(
      memberships.length === 1 && memberships[0]!.tenantSlug === SLUG,
      `sign-in resolves to exactly one workspace: ${memberships[0]?.tenantSlug}`,
      `expected one membership in ${SLUG}, got ${memberships.map((m) => m.tenantSlug).join(",") || "none"}`,
    )
    check(
      memberships[0]?.kind === "STAFF",
      "the founder is STAFF, not a portal client",
      `kind was ${memberships[0]?.kind}`,
    )
  } finally {
    // ---- Always clean up ---------------------------------------------------
    console.log("\n── Removing acme-test ──")
    try {
      const { deleted } = await deprovisionTenant(SLUG)
      ok(`removed ${deleted} rows`)
    } catch (err) {
      bad(`could not deprovision: ${(err as Error).message}`)
    }

    const after = await runUnscoped("final check", async () => ({
      tenants: await db.tenant.count(),
      dnEmployees: await runWithTenant(
        { tenantId: FOUNDING_TENANT_ID, slug: "digitallynext" },
        () => db.employee.count(),
      ),
      orphanUser: await db.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } }),
    }))
    check(
      after.tenants === before.tenants,
      `tenant count back to ${after.tenants}`,
      `tenant count is ${after.tenants}, was ${before.tenants}`,
    )
    check(
      after.dnEmployees === before.dnEmployees,
      `Digitally Next untouched: ${after.dnEmployees} employees`,
      `DN employee count changed: ${before.dnEmployees} → ${after.dnEmployees}`,
    )
    // The platform `users` row outlives the tenant by design - the person still
    // exists even when a company does not - but with no membership it cannot
    // sign in anywhere. Reported rather than asserted, because deleting people
    // when a company closes is a policy decision, not a cleanup detail.
    if (after.orphanUser) {
      await runUnscoped("test cleanup", () => db.user.deleteMany({ where: { email: ADMIN_EMAIL } }))
      console.log("  · removed the now-membership-less users row left by the test")
    }
  }

  console.log("═".repeat(78))
  console.log(
    failures === 0
      ? "PROVISIONING VERIFIED. Two tenants coexisted and could not see each other.\n"
      : `${failures} check(s) FAILED.\n`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
