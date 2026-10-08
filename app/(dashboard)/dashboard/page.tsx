import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { auth } from "@/server/auth"
import { getQueryClient } from "@/lib/query-server"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { serialize } from "@/server/action-result"
import { getDashboardStats, getMyDashboard } from "@/features/dashboard/server/dashboard.queries"

import { DashboardClient } from "./dashboard-client"

/** Prefetches the panel DashboardClient will pick, so it paints on first render. */
export default async function DashboardPage() {
  const queryClient = getQueryClient()
  const session = await auth()

  if (session) {
    // Mirrors DashboardClient: employee:read → the org-wide HR panel.
    const isManager = hasPermission(session, PERMISSIONS.EMPLOYEE_READ)
    try {
      if (isManager) {
        // The API also needs dashboard:read; without it, don't seed a cache entry.
        if (hasPermission(session, PERMISSIONS.DASHBOARD_READ)) {
          await queryClient.prefetchQuery({
            queryKey: ["dashboard-stats"],
            // `normalize()` in the API layer adds `success: true` alongside the
            // handler's own keys, and the client's queryFn caches the whole body.
            queryFn: async () => ({ success: true, ...serialize(await getDashboardStats()) }),
          })
        }
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
