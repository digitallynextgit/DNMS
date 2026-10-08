import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { db } from "@/server/db"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { MobileTabbar } from "@/components/layout/mobile-tabbar"
import { RealtimeNotifications } from "@/components/providers/realtime-notifications"
import { SessionBridge } from "@/components/providers/session-bridge"
import { FollowUpConflictDialog } from "@/components/providers/follow-up-conflict-dialog"
import { AiAssistant } from "@/components/shared/ai-assistant"
import { AccountDeactivated } from "@/features/auth"
import { TenantProvider } from "@/components/tenant-link"
import { currentTenantSlugOrFounding, tenantScopedSession } from "@/server/tenant-request"

/** Nothing under here may be indexed - covers any page that somehow renders for a crawler. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Establishes the tenant context for everything this layout renders.
  const session = await tenantScopedSession()
  if (!session) redirect("/login")

  // The tenant for every <Link> below. Read from the request, not the URL - proxy.ts rewrites
  // /{tenant}/x to /x, so the server and the browser see different addresses.
  const tenantSlug = await currentTenantSlugOrFounding()

  // Sessions are stateless JWTs, so re-check isActive on every navigation and sign out a user
  // deactivated mid-session (e.g. an approved resignation).
  const account = await db.employee.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  })
  if (!account || !account.isActive) {
    return <AccountDeactivated />
  }

  return (
    // Re-provides the server session (the root layout doesn't read it) for gated UI on first paint.
    <SessionBridge session={session}>
      <TenantProvider slug={tenantSlug}>
        <div className="dashboard-shell bg-background fixed inset-0 grid grid-cols-1 overflow-hidden md:grid-cols-[auto_1fr]">
          <RealtimeNotifications />
          {/* Mounted once: any screen that changes a task's status can raise the follow-up question. */}
          <FollowUpConflictDialog />
          {/* Phones get the bottom tab bar instead - the rail would eat 56px of a 390px screen. */}
          <div className="hidden md:contents">
            <Sidebar session={session} />
          </div>
          <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden">
            <Topbar session={session} />
            <main className="min-h-0 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6">
              {children}
            </main>
            <MobileTabbar />
          </div>
          <AiAssistant />
        </div>
      </TenantProvider>
    </SessionBridge>
  )
}
