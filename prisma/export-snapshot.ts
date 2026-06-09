// =============================================================================
// Export the CURRENT database into prisma/snapshot.json  (raw SQL, drift-proof)
// Run with: pnpm tsx prisma/export-snapshot.ts   (or: pnpm db:snapshot)
// =============================================================================
// A data-only backup of whatever is live in the DB right now, captured with
// raw `SELECT *` so it works even when schema.prisma has drifted ahead of the
// database. Pair with seed-snapshot.ts to restore the exact same data (IDs
// preserved) so hand-corrected data is never lost.
// =============================================================================

import "dotenv/config"
import { Pool, types } from "pg"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { SNAPSHOT_TABLES } from "./snapshot-config"

// Capture date/timestamp columns as their exact stored text - bypassing the JS
// Date round-trip avoids any timezone shift between export and restore.
types.setTypeParser(1082, (v) => v) // date
types.setTypeParser(1114, (v) => v) // timestamp (no tz)
types.setTypeParser(1184, (v) => v) // timestamptz

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 0,
  keepAlive: true,
})

async function main() {
  console.log("Exporting current database to snapshot.json (raw SQL)...")
  console.log("─────────────────────────────────────────")

  const snapshot: Record<string, unknown[]> = {}
  const missing: string[] = []
  let total = 0

  for (const table of SNAPSHOT_TABLES) {
    try {
      const res = await pool.query(`SELECT * FROM "${table}"`)
      snapshot[table] = res.rows
      total += res.rows.length
      if (res.rows.length) console.log(`  ${table.padEnd(30)} ${res.rows.length}`)
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "42P01") {
        snapshot[table] = [] // table does not exist in this DB yet (schema drift)
        missing.push(table)
      } else {
        throw e
      }
    }
  }

  const outPath = path.join("prisma", "snapshot.json")
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2))

  console.log("─────────────────────────────────────────")
  console.log(`✓ Exported ${total} rows across ${SNAPSHOT_TABLES.length} tables`)
  console.log(`✓ Written to ${outPath}`)
  if (missing.length) {
    console.log(`⚠ tables not present in DB (skipped, empty): ${missing.join(", ")}`)
  }
}

main()
  .catch((e) => {
    console.error("Export failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
  })
