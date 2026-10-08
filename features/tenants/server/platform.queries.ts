import "server-only"

import { db } from "@/server/db"
import { runUnscoped, runWithTenant } from "@/server/tenant-context"
import { daysRemaining, planOf } from "../plans"

// Platform console reads - deliberately cross-tenant (runUnscoped). Callers must already have
// passed isPlatformAdmin(); this module does not check.

export interface TenantRow {
  id: string
  slug: string
  name: string
  status: string
  planKey: string
  planName: string
  trialDaysLeft: number | null
  employees: number
  activeEmployees: number
  clients: number
  createdAt: Date
  lastSignIn: Date | null
}

export async function listTenants(): Promise<TenantRow[]> {
  return runUnscoped("platform console: administering every tenant", async () => {
    const tenants = await db.tenant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        plan: true,
        trialEndsAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    })

    // Counted per tenant inside runWithTenant, so these match what each company itself sees.
    const rows: TenantRow[] = []
    for (const t of tenants) {
      const counts = await runWithTenant({ tenantId: t.id, slug: t.slug }, async () => ({
        employees: await db.employee.count(),
        activeEmployees: await db.employee.count({ where: { isActive: true } }),
        clients: await db.clientUser.count(),
      }))
      const lastSignIn = await db.user.findFirst({
        where: { memberships: { some: { tenantId: t.id } }, lastLoginAt: { not: null } },
        orderBy: { lastLoginAt: "desc" },
        select: { lastLoginAt: true },
      })
      rows.push({
        id: t.id,
        slug: t.slug,
        name: t.name,
        status: t.status,
        planKey: t.plan,
        planName: planOf(t.plan).name,
        trialDaysLeft: daysRemaining(t.plan, t.trialEndsAt),
        createdAt: t.createdAt,
        lastSignIn: lastSignIn?.lastLoginAt ?? null,
        ...counts,
      })
    }
    return rows
  })
}

export interface PlatformTotals {
  tenants: number
  activeTenants: number
  employees: number
  users: number
  trialsExpiringSoon: number
}

export async function platformTotals(): Promise<PlatformTotals> {
  return runUnscoped("platform console: totals across every tenant", async () => {
    const tenants = await db.tenant.findMany({
      select: { status: true, plan: true, trialEndsAt: true },
    })
    return {
      tenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === "ACTIVE").length,
      employees: await db.employee.count(),
      users: await db.user.count(),
      trialsExpiringSoon: tenants.filter((t) => {
        const left = daysRemaining(t.plan, t.trialEndsAt)
        return left !== null && left >= 0 && left <= 7
      }).length,
    }
  })
}
