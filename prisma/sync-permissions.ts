/**
 * Idempotent permission sync - NON-DESTRUCTIVE.
 *
 * Applies the PERMISSION_DEFINITIONS catalogue to an existing database WITHOUT
 * the destructive full reseed (which wipes role_permissions and recreates roles).
 * Run it after adding a scope to PERMISSION_DEFINITIONS:
 *
 *   npx tsx prisma/sync-permissions.ts
 *
 * What it does, all upserts (safe to run repeatedly):
 *   1. Ensure every catalogue scope exists as a Permission row.
 *   2. Ensure the `admin` role holds EVERY permission (admin = full access).
 *   3. Ensure `hr_manager` holds the company-noticeboard scopes it should have.
 *
 * It never deletes anything, so existing custom role grants are untouched.
 */
import "dotenv/config"
// Reuse the app's configured client: Prisma 7 requires the driver adapter
// (PrismaPg) that server/db.ts sets up - a bare `new PrismaClient()` throws.
import { db as prisma } from "@/server/db"
import { PERMISSION_DEFINITIONS } from "@/lib/constants"

/** Extra scopes a named role should hold (beyond what it already has). */
const ROLE_GRANTS: Record<string, string[]> = {
  hr_manager: ["announcement:write", "gallery:write"],
  // Self-service payslips: the route self-scopes non payroll:write callers to
  // their own records, so this exposes only the HR employee's own pay.
  hr_employee: ["payroll:read"],
}

async function main() {
  // 1. Upsert every catalogue permission.
  for (const def of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { scope: def.scope },
      update: { module: def.module, action: def.action, description: def.description },
      create: {
        scope: def.scope,
        module: def.module,
        action: def.action,
        description: def.description,
      },
    })
  }
  const allPerms = await prisma.permission.findMany({ select: { id: true, scope: true } })
  console.log(`Catalogue synced: ${allPerms.length} permissions present.`)

  // 2. admin = ALL. Link any permission it is missing.
  const admin = await prisma.role.findUnique({ where: { name: "admin" }, select: { id: true } })
  if (admin) {
    let linked = 0
    for (const p of allPerms) {
      const res = await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: admin.id, permissionId: p.id } },
        update: {},
        create: { roleId: admin.id, permissionId: p.id },
      })
      if (res) linked++
    }
    console.log(`admin: ensured ${linked} permission links.`)
  }

  // 3. Targeted role grants (idempotent).
  const byScope = new Map(allPerms.map((p) => [p.scope, p.id]))
  for (const [roleName, scopes] of Object.entries(ROLE_GRANTS)) {
    const role = await prisma.role.findUnique({ where: { name: roleName }, select: { id: true } })
    if (!role) {
      console.warn(`  (role "${roleName}" not found - skipped)`)
      continue
    }
    for (const scope of scopes) {
      const pid = byScope.get(scope)
      if (!pid) {
        console.warn(`  (scope "${scope}" not in catalogue - skipped)`)
        continue
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: pid } },
        update: {},
        create: { roleId: role.id, permissionId: pid },
      })
      console.log(`  ${roleName} += ${scope}`)
    }
  }

  console.log("Done. No rows were deleted.")
}

main()
  // Explicit exit: the pg Pool behind the adapter keeps the event loop alive, so
  // the script would otherwise hang after finishing.
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
