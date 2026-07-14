import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { auth } from "@/server/auth"
import { getQueryClient } from "@/lib/query-server"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { serialize } from "@/server/action-result"
import { getDashboardStats, getMyDashboard } from "@/features/dashboard/server/dashboard.queries"

import { DashboardClient } from "./dashboard-client"

/**
 * Server shell for the dashboard: prefetch the panel the signed-in user will
 * actually see, so <AdminDashboard> / <EmployeeDashboard> paint on first render
 * instead of firing their own `useQuery` after hydration.
 *
 * DashboardClient picks its panel from `usePermissions()` exactly as before -
 * we only mirror that branch here to know WHICH query to warm.
 */
export default async function DashboardPage() {
  const queryClient = getQueryClient()
  const session = await auth()

  if (session) {
    // Mirrors DashboardClient: employee:read → the org-wide HR panel.
    const isManager = hasPermission(session, PERMISSIONS.EMPLOYEE_READ)
    try {
      if (isManager) {
        // /api/dashboard/stats is additionally gated by dashboard:read - if the
        // user lacks it the API would 403, so don't seed a cache entry either.
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
      // A prefetch must never take the page down - the client hook will just
      // fetch on mount, exactly as it did before.
      console.error("[DASHBOARD_PREFETCH]", error)
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  )
}
