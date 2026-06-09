// =============================================================================
// Restore prisma/snapshot.json into the database  (raw SQL, drift-proof)
// =============================================================================
//   Validate only (read-only, safe):   pnpm tsx prisma/seed-snapshot.ts --dry-run
//   Restore into an EMPTY db:           pnpm tsx prisma/seed-snapshot.ts
//   Wipe & restore a populated db:      pnpm tsx prisma/seed-snapshot.ts --force
//
// Inserts IDs verbatim so every foreign-key relationship is preserved exactly.
// This is the companion to export-snapshot.ts - together they guarantee the
// hand-corrected production data can always be recreated.
// =============================================================================

import "dotenv/config"
import { Pool } from "pg"
import { readFileSync } from "node:fs"
import path from "node:path"
import { SNAPSHOT_TABLES, DEFERRED_FIELDS } from "./snapshot-config"

const DRY_RUN = process.argv.includes("--dry-run")
const FORCE = process.argv.includes("--force")

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 0,
  keepAlive: true,
})

interface ColMeta {
  cols: Set<string>
  jsonb: Set<string>
  required: Set<string> // NOT NULL and no default → must be present in snapshot
  exists: boolean
}

async function getColumnMeta(table: string): Promise<ColMeta> {
  const res = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  )
  const cols = new Set<string>()
  const jsonb = new Set<string>()
  const required = new Set<string>()
  for (const r of res.rows) {
    cols.add(r.column_name)
    if (r.data_type === "json" || r.data_type === "jsonb") jsonb.add(r.column_name)
    if (r.is_nullable === "NO" && r.column_default === null) required.add(r.column_name)
  }
  return { cols, jsonb, required, exists: res.rows.length > 0 }
}

async function main() {
  const snapshotPath = path.join("prisma", "snapshot.json")
  const snapshot: Record<string, Record<string, unknown>[]> = JSON.parse(
    readFileSync(snapshotPath, "utf8"),
  )

  console.log(
    DRY_RUN
      ? "DRY RUN - validating snapshot against target DB (no writes)"
      : "Restoring snapshot.json into database...",
  )
  console.log("─────────────────────────────────────────")

  // Gather column metadata for every table up front.
  const meta: Record<string, ColMeta> = {}
  for (const table of SNAPSHOT_TABLES) meta[table] = await getColumnMeta(table)

  // ── Validation (always run) ───────────────────────────────────────────────
  const problems: string[] = []
  for (const table of SNAPSHOT_TABLES) {
    const rows = snapshot[table] ?? []
    if (!rows.length) continue
    const { cols, required, exists } = meta[table]
    if (!exists) {
      problems.push(`✗ ${table}: ${rows.length} rows in snapshot but table missing in DB`)
      continue
    }
    const snapCols = new Set(Object.keys(rows[0]))
    const skipped = [...snapCols].filter((c) => !cols.has(c))
    if (skipped.length) {
      console.log(`  ⚠ ${table}: snapshot columns not in DB (skipped): ${skipped.join(", ")}`)
    }
    const deferred = new Set(DEFERRED_FIELDS[table] ?? [])
    const missingRequired = [...required].filter((c) => !snapCols.has(c) && !deferred.has(c))
    if (missingRequired.length) {
      problems.push(
        `✗ ${table}: required column(s) absent from snapshot: ${missingRequired.join(", ")}`,
      )
    }
  }

  if (problems.length) {
    console.log("─────────────────────────────────────────")
    console.log("VALIDATION FAILED:")
    for (const p of problems) console.log("  " + p)
    process.exit(1)
  }
  console.log("  ✓ Validation passed - every required column is present")

  if (DRY_RUN) {
    const total = SNAPSHOT_TABLES.reduce((n, t) => n + (snapshot[t]?.length ?? 0), 0)
    console.log("─────────────────────────────────────────")
    console.log(
      `✓ Dry run OK - would restore ${total} rows across ${SNAPSHOT_TABLES.length} tables`,
    )
    return
  }

  // ── Safety guard: refuse to overwrite a populated DB without --force ───────
  const empCount = await pool
    .query<{ c: number }>(`SELECT count(*)::int AS c FROM "employees"`)
    .then((r) => r.rows[0].c)
    .catch(() => 0)
  if (empCount > 0 && !FORCE) {
    console.error(
      `\nTarget DB already has ${empCount} employees. ` +
        `Re-run with --force to WIPE and restore.`,
    )
    process.exit(1)
  }

  // ── Clear existing data in reverse dependency order ───────────────────────
  if (FORCE) {
    for (const table of [...SNAPSHOT_TABLES].reverse()) {
      await pool.query(`DELETE FROM "${table}"`).catch((e: unknown) => {
        if ((e as { code?: string })?.code !== "42P01") throw e
      })
    }
    console.log("  ✓ Existing data cleared")
  }

  // ── Insert in dependency order (one row at a time - pg pooler safe) ────────
  let inserted = 0
  for (const table of SNAPSHOT_TABLES) {
    const rows = snapshot[table] ?? []
    if (!rows.length) continue
    const { cols, jsonb } = meta[table]
    const deferred = new Set(DEFERRED_FIELDS[table] ?? [])

    for (const row of rows) {
      const colNames = Object.keys(row).filter((k) => cols.has(k))
      const values = colNames.map((k) => {
        if (deferred.has(k)) return null
        const v = row[k]
        if (v !== null && jsonb.has(k)) return JSON.stringify(v)
        return v
      })
      const colSql = colNames.map((c) => `"${c}"`).join(", ")
      const placeholders = colNames.map((_, i) => `$${i + 1}`).join(", ")
      await pool.query(`INSERT INTO "${table}" (${colSql}) VALUES (${placeholders})`, values)
      inserted++
    }
    console.log(`  ${table.padEnd(30)} ${rows.length}`)
  }

  // ── Second pass: patch deferred self / circular foreign keys ──────────────
  for (const [table, fields] of Object.entries(DEFERRED_FIELDS)) {
    const rows = snapshot[table] ?? []
    const { cols } = meta[table]
    for (const row of rows) {
      const sets = fields.filter((f) => cols.has(f) && row[f] != null)
      if (!sets.length) continue
      const setSql = sets.map((f, i) => `"${f}" = $${i + 1}`).join(", ")
      const vals = sets.map((f) => row[f])
      await pool.query(`UPDATE "${table}" SET ${setSql} WHERE "id" = $${sets.length + 1}`, [
        ...vals,
        row.id,
      ])
    }
  }

  console.log("─────────────────────────────────────────")
  console.log(`✓ Restored ${inserted} rows`)
}

main()
  .catch((e) => {
    console.error("Restore failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
  })
