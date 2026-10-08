import "server-only"

import { db } from "@/server/db"
import { currentTenant, runUnscoped } from "@/server/tenant-context"
import { checkHeadcount, daysRemaining, planOf, type HeadcountCheck, type Plan } from "../plans"

// Headcount limit, checked when an employee is created. Trial expiry and suspension are enforced
// at sign-in (server/identity.ts).

export interface TenantPlanState {
  plan: Plan
  status: string
  activeEmployees: number
  /** Null when the plan does not expire. Negative when it already has. */
  trialDaysLeft: number | null
  headcount: HeadcountCheck
}

/** The current company's plan and usage; null outside a tenant context (cron, scripts). */
export async function currentPlanState(): Promise<TenantPlanState | null> {
  const ctx = currentTenant()
  if (!ctx) return null

  // tenants is platform-level, so this is a deliberate unscoped read of our own row.
  const tenant = await runUnscoped("plan: a tenant reads its own platform record", () =>
    db.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { plan: true, status: true, trialEndsAt: true },
    }),
  )
  if (!tenant) return null

  const activeEmployees = await db.employee.count({ where: { isActive: true } })

  return {
    plan: planOf(tenant.plan),
    status: tenant.status,
    activeEmployees,
    trialDaysLeft: daysRemaining(tenant.plan, tenant.trialEndsAt),
    headcount: checkHeadcount(tenant.plan, activeEmployees),
  }
}

/** May the current company add another active employee? Fails open without a tenant context
 *  (only seeding/maintenance scripts) rather than blocking them. */
export async function checkTenantHeadcount(): Promise<HeadcountCheck> {
  const state = await currentPlanState()
  if (!state) return { allowed: true, current: 0, limit: null, message: null }
  return state.headcount
}
