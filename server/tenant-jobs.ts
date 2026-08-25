import "server-only"

import { db } from "@/server/db"
import { runUnscoped, runWithTenant, type TenantContext } from "@/server/tenant-context"

// =============================================================================
// Running background work once per tenant (M4).
//
// Cron routes and the in-process schedulers have no session, so before M4 they
// had no tenant either - every one of them swept the whole `project_tasks` (or
// `leave_balances`, or …) table in a single pass. With one customer that was
// indistinguishable from correct. With two it would send Acme's reminders to
// Digitally Next's staff.
//
// `forEachTenant` makes the loop the default shape:
//
//   export const GET = withErrorHandler(async () =>
//     ok(await forEachTenant("leave-accrual", (tenant) => accrueFor(tenant))))
//
// Inside `fn`, `db` is scoped to that tenant, so the job body can be written as
// if only one company existed - which is how they are all written today, and why
// this needed no rewriting of the jobs themselves.
//
// ONE TENANT'S FAILURE MUST NOT STOP THE SWEEP. A job that throws for Acme still
// has to run for everyone else, so each iteration is caught and reported rather
// than allowed to abort the loop.
// =============================================================================

export interface TenantJobOutcome<T> {
  tenantId: string
  slug: string
  ok: boolean
  result?: T
  error?: string
}

export interface TenantJobSummary<T> {
  job: string
  tenants: number
  succeeded: number
  failed: number
  outcomes: TenantJobOutcome<T>[]
  ms: number
}

/** Every tenant a background job should visit. */
export async function servableTenants(): Promise<TenantContext[]> {
  return runUnscoped("background job: deciding which tenants to visit", async () => {
    const rows = await db.tenant.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, slug: true, plan: true, trialEndsAt: true },
      orderBy: { createdAt: "asc" },
    })
    const now = Date.now()
    return rows
      .filter((t) => !(t.plan === "TRIAL" && t.trialEndsAt && t.trialEndsAt.getTime() < now))
      .map((t) => ({ tenantId: t.id, slug: t.slug }))
  })
}

/**
 * Run `fn` once per active tenant, each inside its own tenant context.
 *
 * Returns a per-tenant summary rather than a single value, so a cron endpoint
 * can report what happened for whom instead of one opaque number.
 */
export async function forEachTenant<T>(
  job: string,
  fn: (tenant: TenantContext) => Promise<T>,
): Promise<TenantJobSummary<T>> {
  const started = Date.now()
  const tenants = await servableTenants()
  const outcomes: TenantJobOutcome<T>[] = []

  for (const tenant of tenants) {
    try {
      const result = await runWithTenant(tenant, () => fn(tenant))
      outcomes.push({ tenantId: tenant.tenantId, slug: tenant.slug, ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[JOB ${job}] ${tenant.slug} failed:`, err)
      outcomes.push({ tenantId: tenant.tenantId, slug: tenant.slug, ok: false, error: message })
    }
  }

  const failed = outcomes.filter((o) => !o.ok).length
  const summary: TenantJobSummary<T> = {
    job,
    tenants: tenants.length,
    succeeded: outcomes.length - failed,
    failed,
    outcomes,
    ms: Date.now() - started,
  }
  if (failed > 0) {
    console.error(`[JOB ${job}] ${failed}/${tenants.length} tenant(s) failed`)
  }
  return summary
}
