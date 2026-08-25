/**
 * M4 tenant-guard verification.
 *
 *   npx tsx --conditions=react-server scripts/verify-tenant-guard.ts
 *
 * Proves the Prisma extension actually scopes queries, without creating or
 * changing a single row.
 *
 * THE TRICK: every row in this database belongs to Digitally Next. So running a
 * query inside a context for a tenant that does not exist must return NOTHING,
 * and inside the real tenant must return everything. No second tenant needs to
 * be provisioned, and nothing needs cleaning up afterwards.
 *
 * The two probes that do write run inside transactions that always roll back.
 */
import "dotenv/config"
import { db } from "@/server/db"
import {
  FOUNDING_TENANT_ID,
  FOUNDING_TENANT_SLUG,
  runUnscoped,
  runWithTenant,
} from "@/server/tenant-context"
import { TENANT_GUARD_INFO } from "@/server/tenant-guard"

/** A tenant id that is well-formed but belongs to nobody. */
const GHOST = { tenantId: "0197d1ab-0000-7000-8000-0000000ghost", slug: "ghost-corp" }
const FOUNDING = { tenantId: FOUNDING_TENANT_ID, slug: FOUNDING_TENANT_SLUG }

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
  console.log("\nTENANT GUARD (M4)")
  console.log("═".repeat(78))
  console.log(
    `  mode: ${TENANT_GUARD_INFO.mode} · ${TENANT_GUARD_INFO.scopedModelCount} scoped models`,
  )
  if (TENANT_GUARD_INFO.mode === "off") {
    bad("TENANT_ENFORCEMENT=off - the guard is disabled, nothing below means anything")
    return finish()
  }

  // A baseline taken with the guard deliberately out of the way.
  const real = await runUnscoped("verification baseline", async () => ({
    employees: await db.employee.count(),
    users: await db.user.count(),
    projects: await db.project.count(),
    someEmployeeId: (await db.employee.findFirst({ select: { id: true } }))!.id,
  }))
  console.log(
    `  baseline: ${real.employees} employees · ${real.projects} projects · ${real.users} users`,
  )

  // ---- Reads are scoped --------------------------------------------------
  console.log("\n── Reads see only their own tenant ──")
  await runWithTenant(FOUNDING, async () => {
    check(
      (await db.employee.count()) === real.employees,
      `inside ${FOUNDING.slug}: count() sees all ${real.employees} employees`,
      `inside ${FOUNDING.slug}: count() saw ${await db.employee.count()}, expected ${real.employees}`,
    )
  })
  await runWithTenant(GHOST, async () => {
    const n = await db.employee.count()
    check(n === 0, "inside ghost-corp: count() sees 0 employees", `LEAK - ghost-corp saw ${n}`)

    const first = await db.employee.findFirst()
    check(
      first === null,
      "inside ghost-corp: findFirst() returns null",
      "LEAK - findFirst returned a row",
    )

    const many = await db.employee.findMany({ take: 5 })
    check(
      many.length === 0,
      "inside ghost-corp: findMany() returns nothing",
      `LEAK - ${many.length} rows`,
    )

    // THE important one: an id lifted from a URL, read by another tenant.
    const byId = await db.employee.findUnique({ where: { id: real.someEmployeeId } })
    check(
      byId === null,
      "inside ghost-corp: findUnique by a REAL id returns null (the URL-tampering case)",
      "LEAK - findUnique by id crossed the tenant boundary",
    )

    const agg = await db.projectTask.aggregate({ _count: { _all: true } })
    check(
      agg._count._all === 0,
      "inside ghost-corp: aggregate() counts nothing",
      `LEAK - aggregate saw ${agg._count._all}`,
    )

    const grouped = await db.projectTask.groupBy({ by: ["status"], _count: { _all: true } })
    check(
      grouped.length === 0,
      "inside ghost-corp: groupBy() returns no groups",
      `LEAK - groupBy returned ${grouped.length} groups`,
    )
  })

  // ---- Platform models are NOT scoped ------------------------------------
  console.log("\n── Platform-level models stay global ──")
  await runWithTenant(GHOST, async () => {
    const n = await db.user.count()
    check(
      n === real.users,
      `inside ghost-corp: users still visible (${n}) - it is a platform model`,
      `users were scoped (${n} vs ${real.users}) - sign-in would break`,
    )
  })

  // ---- Writes are stamped and filtered -----------------------------------
  console.log("\n── Writes (all rolled back) ──")
  await rolledBack("a create inside a tenant is stamped with it", async (tx) => {
    const row = await tx.holiday.create({
      data: { name: "guard probe", date: new Date("2099-02-02"), isOptional: false },
      select: { id: true, tenantId: true },
    })
    check(
      row.tenantId === GHOST.tenantId,
      `create() stamped tenant_id = ghost-corp without being told to`,
      `create() stamped ${row.tenantId}, expected ${GHOST.tenantId}`,
    )
  })

  await rolledBack("updateMany cannot touch another tenant's rows", async (tx) => {
    const res = await tx.employee.updateMany({ data: { workLocation: "guard probe" } })
    check(
      res.count === 0,
      "updateMany() from ghost-corp changed 0 rows",
      `LEAK - updateMany changed ${res.count} of another tenant's rows`,
    )
  })

  await rolledBack("deleteMany cannot touch another tenant's rows", async (tx) => {
    const res = await tx.holiday.deleteMany({})
    check(
      res.count === 0,
      "deleteMany() from ghost-corp deleted 0 rows",
      `LEAK - deleteMany removed ${res.count} of another tenant's rows`,
    )
  })

  // ---- The extension survives into transactions --------------------------
  console.log("\n── Scoping holds inside $transaction ──")
  await runWithTenant(GHOST, async () => {
    try {
      await db.$transaction(async (tx) => {
        const n = await tx.employee.count()
        check(
          n === 0,
          "inside a transaction, ghost-corp still sees 0 employees",
          `LEAK - transaction client bypassed the guard (${n} rows)`,
        )
        throw new Error("__rollback__")
      })
    } catch (e) {
      if (!(e instanceof Error) || e.message !== "__rollback__") throw e
    }
  })

  // ---- The escape hatch works, and is the only way out -------------------
  console.log("\n── runUnscoped() is the only way past the guard ──")
  await runWithTenant(GHOST, async () => {
    const inside = await db.employee.count()
    const escaped = await runUnscoped("verification", () => db.employee.count())
    check(
      inside === 0 && escaped === real.employees,
      `scoped sees 0, runUnscoped() sees all ${escaped} - the hatch is explicit and works`,
      `scoped=${inside} unscoped=${escaped}`,
    )
  })

  console.log("═".repeat(78))
  console.log(
    failures === 0
      ? `Tenant guard verified in "${TENANT_GUARD_INFO.mode}" mode. Cross-tenant reads and writes are blocked.\n`
      : `${failures} check(s) FAILED.\n`,
  )
  finish()
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

/**
 * Run `fn` as ghost-corp inside a transaction that is always rolled back.
 *
 * The ghost tenant is inserted first, because M1 put a real foreign key on
 * every `tenant_id`: without a matching `tenants` row the guard's stamp is
 * rejected by the database before the assertion can look at it. (That rejection
 * is itself a good sign - it is the FK doing its job - but "the write was
 * stamped with exactly this tenant" is the stronger thing to prove.)
 */
async function rolledBack(label: string, fn: (tx: Tx) => Promise<void>) {
  try {
    await runWithTenant(GHOST, () =>
      db.$transaction(async (tx) => {
        await runUnscoped(
          "probe setup",
          () =>
            tx.$executeRaw`
            INSERT INTO tenants (id, slug, name, status, plan, created_at, updated_at)
            VALUES (${GHOST.tenantId}, ${GHOST.slug}, 'Ghost Corp', 'ACTIVE', 'TRIAL', NOW(), NOW())`,
        )
        await fn(tx)
        throw new Error("__rollback__")
      }),
    )
    bad(`${label}: the transaction committed - it should always roll back`)
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "__rollback__") throw e
  }
}

function finish() {
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
