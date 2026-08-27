import { notFound } from "next/navigation"
import { getPlatformAdminSession, platformAdminsConfigured } from "@/server/platform-admin"
import { listTenants, platformTotals } from "@/features/tenants/server/platform.queries"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Platform",
  description: "Every company on DNMS.",
}

export const dynamic = "force-dynamic"

/**
 * The platform console (M5) - every customer, on one page.
 *
 * NOT FOUND rather than Forbidden for anyone who may not see it. A 403 confirms
 * the page exists; for the one surface that lists every customer, saying nothing
 * is the better answer.
 */
export default async function PlatformPage() {
  const session = await getPlatformAdminSession()
  if (!session) notFound()

  const [totals, tenants] = await Promise.all([platformTotals(), listTenants()])

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
          DNMS Platform
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Signed in as {session.user.email}. Every workspace on this deployment.
        </p>
      </header>

      {!platformAdminsConfigured() && (
        <p className="border-destructive/40 bg-destructive/10 mb-6 rounded-[6px] border p-3 text-sm">
          PLATFORM_ADMINS is not set. Nobody can reach this page.
        </p>
      )}

      <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border md:grid-cols-5">
        {[
          ["Companies", totals.tenants],
          ["Active", totals.activeTenants],
          ["Employees", totals.employees],
          ["People", totals.users],
          ["Trials ending ≤7d", totals.trialsExpiringSoon],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-card p-4">
            <dt className="text-muted-foreground font-mono text-[11px] tracking-wider uppercase">
              {label}
            </dt>
            <dd className="mt-1 font-mono text-2xl tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto rounded-[8px] border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-muted-foreground text-left font-mono text-[11px] tracking-wider uppercase">
              <th className="px-4 py-3 font-normal">Company</th>
              <th className="px-4 py-3 font-normal">Plan</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 text-right font-normal">Employees</th>
              <th className="px-4 py-3 text-right font-normal">Clients</th>
              <th className="px-4 py-3 font-normal">Created</th>
              <th className="px-4 py-3 font-normal">Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-muted-foreground font-mono text-xs">/{t.slug}</div>
                </td>
                <td className="px-4 py-3">
                  {t.planName}
                  {t.trialDaysLeft !== null && (
                    <span
                      className={
                        t.trialDaysLeft < 0
                          ? "text-destructive ml-2 text-xs"
                          : "text-muted-foreground ml-2 text-xs"
                      }
                    >
                      {t.trialDaysLeft < 0
                        ? `lapsed ${Math.abs(t.trialDaysLeft)}d ago`
                        : `${t.trialDaysLeft}d left`}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      t.status === "ACTIVE"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {t.activeEmployees}
                  {t.employees !== t.activeEmployees && (
                    <span className="text-muted-foreground"> / {t.employees}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{t.clients}</td>
                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                  {t.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                  {t.lastSignIn ? t.lastSignIn.toISOString().slice(0, 10) : "never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground mt-6 text-xs">
        Read-only. Suspending a company, changing a plan and extending a trial are edits to
        `tenants`: they are done in the database until this page grows the controls for them.
      </p>
    </div>
  )
}
