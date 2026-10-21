import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { auth } from "@/server/auth"
import { getQueryClient } from "@/lib/query-server"
import { SYSTEM_ROLES } from "@/lib/constants"
import { serialize } from "@/server/action-result"
import { getMyDashboard } from "@/features/dashboard/server/dashboard.queries"
import { getLeadershipDashboard } from "@/features/dashboard/server/leadership.queries"

import { DashboardClient } from "./dashboard-client"

/** Prefetches the panel DashboardClient will pick, so it paints on first render. */
export default async function DashboardPage() {
  const queryClient = getQueryClient()
  const session = await auth()

  if (session) {
    // Mirrors DashboardClient: admins get the company view, everyone else their own.
    const roles = session.user.roles ?? []
    const isAdmin = roles.includes(SYSTEM_ROLES.ADMIN) || roles.includes(SYSTEM_ROLES.ADMIN_)
    try {
      if (isAdmin) {
        await queryClient.prefetchQuery({
          queryKey: ["dashboard-leadership"],
          queryFn: async () => serialize(await getLeadershipDashboard(session)),
        })
      } else {
        await queryClient.prefetchQuery({
          queryKey: ["dashboard-me"],
          queryFn: async () => ({
            success: true,
            ...serialize(await getMyDashboard(session.user.id)),
          }),
        })
      }
    } catch (error) {
      // A prefetch must never take the page down - the client hook fetches on mount.
      console.error("[DASHBOARD_PREFETCH]", error)
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  )
}
