/**
 * Non-destructive permission sync: run `pnpm db:permissions` after adding a scope to PERMISSION_DEFINITIONS.
 * Upserts every catalogue scope, gives `admin` every permission and adds ROLE_GRANTS. Never deletes anything.
 * Use the pnpm script: @/server/db needs the react-server export condition.
 */
import "dotenv/config"
// The app's client: Prisma 7 needs the driver adapter that server/db.ts sets up.
import { db as prisma } from "@/server/db"
import { PERMISSION_DEFINITIONS } from "@/lib/constants"
import { forEachTenant } from "@/server/tenant-jobs"

/** Extra scopes a named role should hold (beyond what it already has). */
const ROLE_GRANTS: Record<string, string[]> = {
  hr_manager: [
    "announcement:write",
    "gallery:write",
    // hr_manager runs both checklists, including the exit sign-off that issues relieving and deactivates the account.
    "onboarding:read",
    "onboarding:write",
    "exit:read",
    "exit:write",
  ],
  // payroll:read self-scopes to the caller's own records; running an exit stays with hr_manager.
  hr_employee: ["payroll:read", "onboarding:read", "exit:read"],
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

  // Steps 2 and 3 run once per tenant: roles and role_permissions belong to a company.
  const summary = await forEachTenant("sync-permissions", async (tenant) => {
    console.log(`\n-- ${tenant.slug} --`)

    // 2. admin = ALL. Link any permission it is missing.
    const admin = await prisma.role.findFirst({ where: { name: "admin" }, select: { id: true } })
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
      const role = await prisma.role.findFirst({ where: { name: roleName }, select: { id: true } })
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
  })

  console.log(
    `\nDone across ${summary.succeeded}/${summary.tenants} tenant(s). No rows were deleted.`,
  )
}

main()
  // Explicit exit: the adapter's pg Pool would otherwise keep the process alive.
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
