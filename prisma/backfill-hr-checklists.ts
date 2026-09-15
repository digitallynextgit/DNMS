/**
 * Seed the onboarding and exit-clearance templates into companies that already
 * exist.
 *
 *   pnpm db:checklists              # dry run
 *   pnpm db:checklists --write      # actually write
 *
 * DRY RUN BY DEFAULT. Nothing is written without `--write`.
 *
 * Use the pnpm script, not a bare `npx tsx`. This imports @/server/db, which
 * chains through server/tenant-guard.ts and its `import "server-only"` - and
 * that package THROWS unless the `react-server` export condition is on. The
 * script passes `tsx --conditions=react-server` for you.
 *
 * A --conditions FLAG rather than the `NODE_OPTIONS=...` prefix the older
 * scripts in this folder document: that prefix is bash syntax and silently does
 * nothing in PowerShell.
 *
 * `provisionTenant` seeds these for every NEW company, which does nothing for
 * the ones already on the system - the same gap `prisma/sync-permissions.ts`
 * exists to close for permission scopes, and this is its equivalent.
 *
 * IDEMPOTENT and NON-DESTRUCTIVE: a tenant that already has a template of a
 * given kind is skipped, never replaced. HR may have edited theirs, and an
 * overwrite would silently discard that. Safe to re-run.
 */
import "dotenv/config"
// Reuse the app's configured client: Prisma 7 requires the driver adapter
// (PrismaPg) that server/db.ts sets up - a bare `new PrismaClient()` throws.
import { db as prisma } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { seedChecklistTemplates } from "@/features/hr-checklists/lib/seed-templates"
import { DEFAULT_CHECKLIST_TEMPLATES } from "@/features/hr-checklists/lib/default-templates"

const WRITE = process.argv.includes("--write")

async function main() {
  // Deliberately unscoped: this visits every company, which is exactly the
  // case runUnscoped exists to make explicit rather than accidental.
  const tenants = await runUnscoped("backfill: seeding HR checklist templates", () =>
    prisma.tenant.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  )

  if (tenants.length === 0) {
    console.log("No tenants found - nothing to do.")
    return
  }

  console.log(
    `${WRITE ? "Seeding" : "DRY RUN - would seed"} checklist templates for ${tenants.length} tenant(s).\n`,
  )

  let created = 0
  let skipped = 0

  for (const tenant of tenants) {
    // One tenant's failure must not stop the sweep.
    try {
      if (!WRITE) {
        const have = await runUnscoped("backfill: checking existing templates", () =>
          prisma.checklistTemplate.findMany({
            where: { tenantId: tenant.id },
            select: { kind: true },
          }),
        )
        const haveKinds = new Set(have.map((t) => t.kind))
        const missing = DEFAULT_CHECKLIST_TEMPLATES.filter((t) => !haveKinds.has(t.kind))
        console.log(
          `  ${tenant.slug.padEnd(20)} has ${haveKinds.size}/2 · would create: ${
            missing.map((m) => m.kind).join(", ") || "nothing"
          }`,
        )
        created += missing.length
        skipped += haveKinds.size
        continue
      }

      const result = await runUnscoped("backfill: seeding HR checklist templates", () =>
        seedChecklistTemplates(prisma, tenant.id),
      )
      created += result.created.length
      skipped += result.skipped.length
      console.log(
        `  ${tenant.slug.padEnd(20)} created: ${result.created.join(", ") || "-"} · skipped: ${
          result.skipped.join(", ") || "-"
        }`,
      )
    } catch (error) {
      console.error(`  ${tenant.slug.padEnd(20)} FAILED:`, (error as Error).message)
    }
  }

  console.log(
    `\n${WRITE ? "Done" : "Dry run complete"}. templates created=${created} skipped=${skipped}`,
  )
  if (!WRITE) console.log("Re-run with --write to apply.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
