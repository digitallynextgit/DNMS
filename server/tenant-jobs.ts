import "server-only"

import { db } from "@/server/db"
import { runUnscoped, runWithTenant, type TenantContext } from "@/server/tenant-context"

// Background jobs have no session, so they run once per tenant with `db` scoped to each.
// One tenant's failure must not stop the sweep: each iteration is caught and reported.

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
