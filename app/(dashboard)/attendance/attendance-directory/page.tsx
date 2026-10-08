import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { format } from "date-fns"

import { auth } from "@/server/auth"
import { getQueryClient } from "@/lib/query-server"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { serialize } from "@/server/action-result"
import { getAttendanceDirectory } from "@/features/attendance/server/attendance-directory.queries"

import { AttendanceDirectoryClient } from "./attendance-directory-client"

/**
 * Prefetches today's roster so the client paints from a warm cache. `today` uses the same
 * date-fns call as the client; if the server's timezone differs, the prefetch is just ignored.
 */
export default async function AttendanceDirectoryPage() {
  const queryClient = getQueryClient()
  const session = await auth()

  // The API needs attendance:write, so only warm the cache for users who'd pass.
  if (session && hasPermission(session, PERMISSIONS.ATTENDANCE_WRITE)) {
    const today = format(new Date(), "yyyy-MM-dd")
    try {
      await queryClient.prefetchQuery({
        queryKey: ["attendance-directory", today, today],
        // The client's queryFn unwraps { data }, so cache .data.
        queryFn: async () => {
          const result = await getAttendanceDirectory(today, today)
          if (!result.ok) throw new Error(result.error)
          return serialize(result.data)
        },
      })
    } catch (error) {
      // Never 500 the page over a prefetch - the client hook will fetch on mount.
      console.error("[ATTENDANCE_DIRECTORY_PREFETCH]", error)
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AttendanceDirectoryClient />
    </HydrationBoundary>
  )
}
