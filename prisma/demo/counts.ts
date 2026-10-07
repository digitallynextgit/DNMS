/**
 * READ-ONLY: row counts for every tenant-scoped table of one tenant.
 *
 *   pnpm exec tsx --conditions=react-server prisma/demo/counts.ts            # demo
 *   pnpm exec tsx --conditions=react-server prisma/demo/counts.ts digitallynext
 *   ... counts.ts digitallynext --json > before.json                         # machine-readable
 *
 * Used to prove `pnpm db:demo` only ever touches the demo tenant: snapshot the
 * real company before a run, run the seed, snapshot again, compare.
 */
import "dotenv/config"
import { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { runUnscoped, runWithTenant } from "@/server/tenant-context"
import { DEMO_TENANT_SLUG } from "@/lib/demo"

type Counter = { count: (a?: unknown) => Promise<number> }

export async function tenantCounts(slug: string): Promise<Record<string, number> | null> {
  const tenant = await runUnscoped("demo counts: resolve a tenant by slug", () =>
    db.tenant.findUnique({ where: { slug }, select: { id: true, slug: true } }),
  )
  if (!tenant) return null

  const models = Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "tenantId"))
    .map((m) => m.name.charAt(0).toLowerCase() + m.name.slice(1))
    .filter((d) => d !== "tenant")
    .sort()

  const client = db as unknown as Record<string, Counter | undefined>
  const out: Record<string, number> = {}
  await runWithTenant({ tenantId: tenant.id, slug: tenant.slug }, async () => {
    for (const name of models) {
      const delegate = client[name]
      if (typeof delegate?.count !== "function") continue
      // The tenant guard narrows every count to this tenant.
      out[name] = await delegate.count()
    }
  })
  return out
}

async function main() {
  const slug = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? DEMO_TENANT_SLUG
  const counts = await tenantCounts(slug)
  if (!counts) {
    console.log(`No tenant "${slug}".`)
    return
  }
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(counts, null, 2))
    return
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log(`Tenant "${slug}": ${total} rows across ${Object.keys(counts).length} tables`)
  for (const [name, n] of Object.entries(counts)) {
    if (n > 0) console.log(`  ${name.padEnd(32)} ${n}`)
  }
}

// Only when run directly, not when imported by the seed.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/demo/counts.ts")) {
  main()
    .catch((e) => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(() => db.$disconnect())
}
