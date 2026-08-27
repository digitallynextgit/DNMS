import { redirect } from "next/navigation"
import { notFound } from "next/navigation"
import { PlatformSidebar } from "@/components/layout/platform-sidebar"
import { Topbar } from "@/components/layout/topbar"
import { TenantProvider } from "@/components/tenant-link"
import { getPlatformAdminSession } from "@/server/platform-admin"
import { currentTenantSlugOrFounding } from "@/server/tenant-request"

/**
 * Shell for the platform console.
 *
 * The same visual chrome as the dashboard - a left rail and the topbar - so the
 * console does not look like a different application. The NAV inside that rail
 * is different, and deliberately so.
 *
 * ── ITS OWN NAV, NOT THE TENANT ONE ──────────────────────────────────────────
 * The dashboard sidebar is built from the signed-in tenant's permissions, so
 * every item in it means "in this company". Beside a page listing every company
 * that is actively misleading - does "Employees" mean this workspace or all of
 * them? The console therefore uses PlatformSidebar, which lists only what the
 * console does, plus one route back to the operator's own workspace.
 *
 * The mobile tab bar is omitted for the same reason: its five destinations are
 * all tenant screens.
 *
 * ── GATED HERE, NOT ONLY ON THE PAGE ─────────────────────────────────────────
 * The page checks too, and keeps checking. Putting it in the layout as well
 * means any /platform/* screen added later is covered from the moment it is
 * created rather than the moment somebody remembers.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformAdminSession()
  // notFound(), not redirect: a 403 or a bounce confirms the route exists. For
  // the one surface listing every customer, saying nothing is the better answer.
  if (!session) notFound()

  // Belt and braces: getPlatformAdminSession() already requires an employee
  // session, so this only fires if that contract changes underneath us.
  if (!session.user?.id) redirect("/login")

  // Platform staff are always Digitally Next employees, so this resolves to the
  // founding slug - which is what makes the sidebar links point back into their
  // own workspace rather than nowhere.
  const tenantSlug = await currentTenantSlugOrFounding()

  return (
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
  )
}
