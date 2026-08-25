import "server-only"

import { db } from "@/server/db"
import { currentTenant, runUnscoped } from "@/server/tenant-context"
import { checkHeadcount, daysRemaining, planOf, type HeadcountCheck, type Plan } from "../plans"

// =============================================================================
// Plan enforcement (M5).
//
// Three things gate a company, and they are enforced in three different places
// because they fail at three different moments:
//
//   1. TRIAL EXPIRY - server/identity.ts, at sign-in. A lapsed trial yields no
//      membership, so nobody from that company can get in at all. Already built
//      in M2; nothing here duplicates it.
//   2. SUSPENSION   - same place, same mechanism.
//   3. HEADCOUNT    - here, at the moment an employee is created. It cannot live
//      in the login path: the limit is not about who may sign in, it is about
//      how many people the company has bought seats for.
// =============================================================================

export interface TenantPlanState {
  plan: Plan
  status: string
  activeEmployees: number
  /** Null when the plan does not expire. Negative when it already has. */
  trialDaysLeft: number | null
  headcount: HeadcountCheck
}

/**
 * The current company's plan and how much of it is used.
 *
 * Returns null outside a tenant context - a cron sweep, a script - where there
 * is no "current company" to describe.
 */
export async function currentPlanState(): Promise<TenantPlanState | null> {
  const ctx = currentTenant()
  if (!ctx) return null

  // The tenants table is platform-level, so reading our own row is a deliberate
  // cross-tenant read of exactly one row.
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

/**
 * May the current company add another active employee?
 *
 * Fails OPEN when there is no tenant context, and that is deliberate: the only
 * paths without one are seeding and maintenance scripts, and a backfill that
 * silently refuses to create people would be a far worse failure than one that
 * briefly exceeds a headcount limit.
 */
export async function checkTenantHeadcount(): Promise<HeadcountCheck> {
  const state = await currentPlanState()
  if (!state) return { allowed: true, current: 0, limit: null, message: null }
  return state.headcount
}
