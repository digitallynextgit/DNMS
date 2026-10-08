import { redirect } from "next/navigation"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { PlatformSidebar } from "@/components/layout/platform-sidebar"
import { Topbar } from "@/components/layout/topbar"
import { SessionBridge } from "@/components/providers/session-bridge"
import { TenantProvider } from "@/components/tenant-link"
import { getPlatformAdminSession } from "@/server/platform-admin"
import { currentTenantSlugOrFounding } from "@/server/tenant-request"

// Own nav, not the tenant sidebar: beside a page listing every company, tenant items like
// "Employees" would mislead. Gated here as well as on the page, so new /platform/* pages are covered.

/** The one surface listing every customer must never be indexed, even if the page check changes. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformAdminSession()
  // notFound(), not redirect: a 403 or a bounce confirms the route exists.
  if (!session) notFound()

  // Belt and braces: getPlatformAdminSession() already requires an employee session.
  if (!session.user?.id) redirect("/login")

  // Platform staff are always Digitally Next employees, so this resolves to the founding slug.
  const tenantSlug = await currentTenantSlugOrFounding()

  return (
    // See the dashboard layout for why the session is re-provided here.
    <SessionBridge session={session}>
      <TenantProvider slug={tenantSlug}>
        <div className="dashboard-shell bg-background fixed inset-0 grid grid-cols-1 overflow-hidden md:grid-cols-[auto_1fr]">
          <div className="hidden md:contents">
            <PlatformSidebar />
          </div>
          <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden">
            <Topbar session={session} />
            <main className="min-h-0 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6">
              {children}
            </main>
          </div>
        </div>
      </TenantProvider>
    </SessionBridge>
  )
}
