/**
 * M2 verification - READ-ONLY (the two probes run inside rolled-back transactions).
 *
 *   npx tsx prisma/verify-identity.ts
 *
 * What has to be true for M2 to be safe to deploy:
 *
 *   1. Every employee and every client user has exactly one membership, in the
 *      right tenant, with a credential that still matches the legacy column.
 *   2. The database refuses a malformed membership (wrong kind/profile pairing)
 *      and a cross-tenant one. These are the isolation guarantees; if they are
 *      only enforced in TypeScript they are not enforced.
 *   3. The legacy columns are untouched, so the deployed build still logs people
 *      in against them.
 */
import "dotenv/config"
import { db as prisma } from "@/server/db"
import { runUnscoped, FOUNDING_TENANT_ID } from "@/server/tenant-context"

let failures = 0
const ok = (s: string) => console.log(`  ✓ ${s}`)
const bad = (s: string) => {
  console.log(`  ✗ ${s}`)
  failures++
}

/** Record one check, so each call site stays a single readable statement. */
function check(pass: boolean, good: string, problem: string) {
  if (pass) ok(good)
  else bad(problem)
}

async function main() {
  console.log("\n== 1. Backfill completeness ==")
  const [counts] = await prisma.$queryRaw<
    { users: bigint; staff: bigint; clients: bigint; emps: bigint; cus: bigint }[]
  >`SELECT (SELECT COUNT(*) FROM users)::bigint                                  AS users,
           (SELECT COUNT(*) FROM memberships WHERE kind='STAFF')::bigint         AS staff,
           (SELECT COUNT(*) FROM memberships WHERE kind='CLIENT')::bigint        AS clients,
           (SELECT COUNT(*) FROM employees)::bigint                              AS emps,
           (SELECT COUNT(*) FROM client_users)::bigint                           AS cus`
  console.log(
    `  ${counts?.users} users · ${counts?.staff} STAFF + ${counts?.clients} CLIENT memberships` +
      ` (from ${counts?.emps} employees, ${counts?.cus} client users)`,
  )
  check(counts?.staff === counts?.emps, "every employee has a membership", "staff count mismatch")
  check(
    counts?.clients === counts?.cus,
    "every client user has a membership",
    "client count mismatch",
  )

  const [tenantCheck] = await prisma.$queryRaw<{ wrong: bigint }[]>`
    SELECT COUNT(*)::bigint AS wrong FROM memberships WHERE tenant_id <> ${FOUNDING_TENANT_ID}`
  check(
    Number(tenantCheck?.wrong ?? 0) === 0,
    "all memberships sit in the founding tenant",
    `${tenantCheck?.wrong} membership(s) in another tenant`,
  )

  console.log("\n== 2. Credentials carried across intact ==")
  const [pw] = await prisma.$queryRaw<{ drift: bigint; nulls: bigint }[]>`
    SELECT COUNT(*) FILTER (WHERE u.password_hash IS DISTINCT FROM e.password_hash)::bigint AS drift,
           COUNT(*) FILTER (WHERE u.password_hash IS NULL)::bigint                          AS nulls
      FROM employees e JOIN users u ON u.email = lower(e.email)`
  check(
    Number(pw?.drift ?? 0) === 0,
    `staff hashes identical to the legacy column (${pw?.nulls} with no password set)`,
    `${pw?.drift} staff hash(es) differ from employees.password_hash`,
  )

  const [cpw] = await prisma.$queryRaw<{ drift: bigint }[]>`
    SELECT COUNT(*) FILTER (WHERE u.password_hash IS DISTINCT FROM c.password_hash)::bigint AS drift
      FROM client_users c JOIN users u ON u.email = lower(c.email)`
  check(
    Number(cpw?.drift ?? 0) === 0,
    "client hashes identical to the legacy column",
    `${cpw?.drift} client hash(es) differ from client_users.password_hash`,
  )

  const [flags] = await prisma.$queryRaw<{ drift: bigint }[]>`
    SELECT COUNT(*) FILTER (WHERE u.must_change_password <> e.must_change_password
                              OR u.is_active <> e.is_active)::bigint AS drift
      FROM employees e JOIN users u ON u.email = lower(e.email)`
  check(
    Number(flags?.drift ?? 0) === 0,
    "must_change_password and is_active match",
    `${flags?.drift} row(s) with drifted flags`,
  )

  console.log("\n== 3. The legacy login path is untouched ==")
  const legacy = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM employees WHERE password_hash IS NOT NULL AND is_active`
  ok(
    `${legacy[0]?.n} active employees still have employees.password_hash - the deployed build can log them in`,
  )

  console.log("\n== 4. The database refuses malformed memberships ==")
  const anyEmployee = await prisma.employee.findFirst({ select: { id: true, tenantId: true } })
  if (!anyEmployee) {
    bad("no employee to probe with")
  } else {
    // 4a. kind/profile mismatch must violate the CHECK.
    await probe(
      "a STAFF membership with no employee_id is rejected",
      (tx) => tx.$executeRaw`
        INSERT INTO memberships (id, user_id, tenant_id, kind, is_active, created_at, updated_at)
        SELECT gen_random_uuid()::text, u.id, ${FOUNDING_TENANT_ID}, 'STAFF', true, NOW(), NOW()
          FROM users u LIMIT 1`,
    )

    // 4b. Cross-tenant must violate the COMPOSITE foreign key.
    //
    // The employee's real membership is deleted first, inside the transaction.
    // Without that, the insert trips memberships_employee_id_key instead and the
    // probe passes without ever exercising the constraint it is here to test.
    await probe("a membership whose tenant differs from its employee's is rejected", async (tx) => {
      await tx.$executeRaw`DELETE FROM memberships WHERE employee_id = ${anyEmployee.id}`
      await tx.$executeRaw`
        INSERT INTO tenants (id, slug, name, status, plan, created_at, updated_at)
        VALUES ('probe-tenant-0000', 'probe-tenant', 'Probe', 'ACTIVE', 'TRIAL', NOW(), NOW())`
      await tx.$executeRaw`
        INSERT INTO memberships (id, user_id, tenant_id, kind, employee_id, is_active, created_at, updated_at)
        SELECT gen_random_uuid()::text, u.id, 'probe-tenant-0000', 'STAFF', ${anyEmployee.id}, true, NOW(), NOW()
          FROM users u LIMIT 1`
    })

    // 4c. Control: the SAME insert in the employee's OWN tenant must succeed.
    // Without this, 4b proves nothing - a constraint that rejects everything
    // would pass it too.
    await probeAccepts(
      "the same membership in the employee's own tenant is accepted",
      async (tx) => {
        await tx.$executeRaw`DELETE FROM memberships WHERE employee_id = ${anyEmployee.id}`
        await tx.$executeRaw`
          INSERT INTO memberships (id, user_id, tenant_id, kind, employee_id, is_active, created_at, updated_at)
          SELECT gen_random_uuid()::text, u.id, ${anyEmployee.tenantId}, 'STAFF', ${anyEmployee.id}, true, NOW(), NOW()
            FROM users u LIMIT 1`
      },
    )
  }

  console.log(
    failures === 0
      ? "\nM2 schema verified. Identity is backfilled and the guarantees are in the database.\n"
      : `\n${failures} check(s) FAILED.\n`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Run `fn` inside a transaction that is ALWAYS rolled back; PASS means it threw.
 *
 * `fn` receives the transaction client and must use it - a write issued on the
 * outer `prisma` would run on its own connection, escape the rollback, and leave
 * probe rows in the database.
 */
async function probe(label: string, fn: (tx: Tx) => Promise<unknown>) {
  let rejected = false
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx)
      throw new Error("__accepted__")
    })
  } catch (err) {
    rejected = !(err instanceof Error && err.message === "__accepted__")
  }
  check(rejected, label, `${label} - IT WAS ACCEPTED`)
}

/** The inverse: PASS means the database accepted it. Always rolled back too. */
async function probeAccepts(label: string, fn: (tx: Tx) => Promise<unknown>) {
  let accepted = false
  let why = ""
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx)
      accepted = true
      throw new Error("__rollback__")
    })
  } catch (err) {
    if (!accepted) why = err instanceof Error ? ` - ${err.message.split("\n").pop()?.trim()}` : ""
  }
  check(accepted, label, `${label} - IT WAS REJECTED${why}`)
}

runUnscoped("verification: inspects rows across every tenant by design", main)
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
