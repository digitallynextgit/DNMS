/**
 * M1 verification - READ-ONLY (the one write runs inside a rolled-back transaction).
 *
 *   npx tsx prisma/verify-tenancy.ts
 *
 * Proves the four things the tenant spine has to be true for the deployed VPS to
 * keep working:
 *
 *   1. The `tenants` table exists and holds Digitally Next at the hard-coded id.
 *   2. Every tenant_id column is NOT NULL, has the founding DEFAULT, is indexed,
 *      and has a real FK to tenants(id).
 *   3. No row anywhere is unattributed.
 *   4. An INSERT that never mentions tenant_id - i.e. what the currently deployed
 *      build emits - still succeeds and lands in Digitally Next.
 *
 * (4) is the whole ground rule. If it ever fails, the running deployment breaks
 * the moment someone creates a record.
 */
import "dotenv/config"
import { db as prisma } from "@/server/db"
import { FOUNDING_TENANT_ID, FOUNDING_TENANT_SLUG } from "@/server/tenant-context"

const ok = (s: string) => console.log(`  ✓ ${s}`)
const bad = (s: string) => {
  console.log(`  ✗ ${s}`)
  failures++
}
let failures = 0

/** Record one check. An if/else in expression position, so it reads as one line. */
function check(pass: boolean, good: string, problem: string) {
  if (pass) ok(good)
  else bad(problem)
}

async function main() {
  console.log("\n== 1. Tenants table + founding tenant ==")
  const tenants = await prisma.$queryRaw<
    { id: string; slug: string; name: string; status: string; plan: string }[]
  >`SELECT id, slug, name, status, plan FROM tenants ORDER BY created_at`
  console.log(`  ${tenants.length} tenant(s):`)
  for (const t of tenants) console.log(`    ${t.slug.padEnd(16)} ${t.name} [${t.plan}/${t.status}]`)

  const founding = tenants.find((t) => t.id === FOUNDING_TENANT_ID)
  if (!founding) bad(`no tenant at the founding id ${FOUNDING_TENANT_ID}`)
  else if (founding.slug !== FOUNDING_TENANT_SLUG) bad(`founding slug is "${founding.slug}"`)
  else ok(`founding tenant is ${founding.name} (${founding.slug})`)

  console.log("\n== 2. Column shape across every tenant-scoped table ==")
  const cols = await prisma.$queryRaw<
    { table_name: string; is_nullable: string; column_default: string | null }[]
  >`SELECT table_name, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'tenant_id'
     ORDER BY table_name`

  const nullable = cols.filter((c) => c.is_nullable !== "NO")
  console.log(`  ${cols.length} tables carry tenant_id`)
  check(
    nullable.length === 0,
    "all NOT NULL",
    `nullable: ${nullable.map((c) => c.table_name).join(", ")}`,
  )

  // The DEFAULT exists for exactly one reason: so an INSERT from the PRE-TENANCY
  // build, which never mentions tenant_id, still lands in the right tenant. That
  // only applies to tables the old build actually writes to. A table introduced
  // AFTER M1 is written solely by tenant-aware code, and giving it a default
  // would be worse than useless - it would let a forgotten tenantId pass
  // silently instead of failing.
  const POST_M1_TABLES = new Set([
    "memberships", // M2 - the old build does not know this table exists
  ])
  const needsDefault = cols.filter((c) => !POST_M1_TABLES.has(c.table_name))
  const noDefault = needsDefault.filter((c) => !c.column_default?.includes(FOUNDING_TENANT_ID))
  check(
    noDefault.length === 0,
    `${needsDefault.length} pre-M1 tables DEFAULT to the founding tenant (this is what keeps the deployed build alive); ` +
      `${cols.length - needsDefault.length} post-M1 table(s) correctly have none`,
    `missing the founding DEFAULT: ${noDefault.map((c) => c.table_name).join(", ")}`,
  )
  // The inverse also has to hold, or the exclusion list is just hiding a bug.
  const wrongDefault = cols.filter(
    (c) => POST_M1_TABLES.has(c.table_name) && c.column_default?.includes(FOUNDING_TENANT_ID),
  )
  check(
    wrongDefault.length === 0,
    "no post-M1 table has a founding default it should not have",
    `post-M1 tables with a founding default: ${wrongDefault.map((c) => c.table_name).join(", ")}`,
  )

  const fks = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT DISTINCT c.conrelid::regclass::text AS table_name
      FROM pg_constraint c
      JOIN unnest(c.conkey) AS k(attnum) ON TRUE
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
     WHERE c.contype = 'f' AND a.attname = 'tenant_id'
       AND c.confrelid = 'tenants'::regclass`
  const fkSet = new Set(fks.map((f) => f.table_name.replace(/^public\./, "").replace(/"/g, "")))
  const missingFk = cols.map((c) => c.table_name).filter((t) => !fkSet.has(t))
  check(
    missingFk.length === 0,
    `${fkSet.size} FKs to tenants(id)`,
    `no FK to tenants: ${missingFk.join(", ")}`,
  )

  const idx = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT DISTINCT tablename FROM pg_indexes
     WHERE schemaname = 'public' AND indexdef LIKE '%(tenant_id%'`
  const idxSet = new Set(idx.map((i) => i.tablename))
  const missingIdx = cols.map((c) => c.table_name).filter((t) => !idxSet.has(t))
  check(
    missingIdx.length === 0,
    `${idxSet.size} tables indexed on tenant_id`,
    `not indexed: ${missingIdx.join(", ")}`,
  )

  console.log("\n== 3. Row attribution ==")
  //
  // WHAT THIS ASSERTS CHANGED WHEN THE SECOND TENANT SIGNED UP.
  //
  // It used to require every row to carry the FOUNDING tenant id, which was the
  // right invariant for exactly as long as one company existed - it proved the
  // M1 backfill had reached everything. The first real signup made it fail on a
  // perfectly healthy database, reporting genuine isolation as corruption.
  //
  // The invariant that actually matters, and keeps mattering: every tenant_id
  // points at a tenant that EXISTS. A row attributed to a deleted or invented
  // tenant is unreachable by any session and invisible to the guard, which is
  // the real corruption this check is for.
  const [{ n: tenantCount }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM tenants`
  let totalRows = 0
  let populated = 0
  let foundingRows = 0
  const orphans: string[] = []
  for (const { table_name } of cols) {
    const [row] = await prisma.$queryRawUnsafe<{ n: bigint; founding: bigint; bad: bigint }[]>(
      `SELECT COUNT(*)::bigint AS n,
              COUNT(*) FILTER (WHERE t.tenant_id = $1)::bigint AS founding,
              COUNT(*) FILTER (WHERE NOT EXISTS (
                SELECT 1 FROM tenants x WHERE x.id = t.tenant_id
              ))::bigint AS bad
         FROM "${table_name}" t`,
      FOUNDING_TENANT_ID,
    )
    const n = Number(row?.n ?? 0)
    totalRows += n
    foundingRows += Number(row?.founding ?? 0)
    if (n > 0) populated++
    if (Number(row?.bad ?? 0) > 0) orphans.push(`${table_name} (${row?.bad})`)
  }
  console.log(
    `  ${totalRows.toLocaleString()} rows across ${populated} populated tables` +
      ` · ${foundingRows.toLocaleString()} in the founding tenant` +
      ` · ${Number(tenantCount)} tenant(s) total`,
  )
  check(
    orphans.length === 0,
    "every row is attributed to a tenant that exists",
    `rows pointing at a non-existent tenant: ${orphans.join(", ")}`,
  )

  console.log("\n== 4. The deployed build's INSERT still works (rolled back) ==")
  try {
    await prisma.$transaction(async (tx) => {
      // Exactly what the old code emits: no tenant_id in the column list.
      const [inserted] = await tx.$queryRaw<{ id: string; tenant_id: string }[]>`
        INSERT INTO holidays (id, name, date, is_optional, created_at)
        VALUES (gen_random_uuid()::text, 'M1 verification probe', DATE '2099-01-01', false, NOW())
        RETURNING id, tenant_id`
      if (inserted?.tenant_id === FOUNDING_TENANT_ID) {
        ok(`INSERT without tenant_id resolved to ${FOUNDING_TENANT_SLUG}`)
      } else {
        bad(`INSERT without tenant_id resolved to ${inserted?.tenant_id ?? "nothing"}`)
      }
      throw new Error("__rollback__")
    })
  } catch (err) {
    if (!(err instanceof Error) || err.message !== "__rollback__") throw err
    ok("probe row rolled back - database unchanged")
  }

  console.log(
    failures === 0
      ? "\nM1 verified. Safe to deploy: the old build and the new schema agree.\n"
      : `\n${failures} check(s) FAILED - do not deploy.\n`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
