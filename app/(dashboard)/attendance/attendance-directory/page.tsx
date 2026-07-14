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
 * Server shell for the attendance directory: prefetch today's roster so
 * AttendanceDirectoryClient's `useAttendanceDirectory(from, to)` finds a warm
 * cache and paints immediately, with no client fetch on first load.
 *
 * The client seeds both `from` and `to` to `format(new Date(), "yyyy-MM-dd")` in
 * local state (no URL params), so the first key is always
 * ["attendance-directory", today, today]. We build `today` with the SAME date-fns
 * call so the keys match. Note this resolves in the SERVER's timezone: if the
 * server runs in UTC and the user is in IST, the two dates disagree between
 * 00:00-05:30 IST and the prefetch is simply ignored (the client fetches as it
 * does today) - a wasted prefetch, never wrong data. Pinning `TZ` on the server
 * to the company timezone removes even that edge case.
 */
export default async function AttendanceDirectoryPage() {
  const queryClient = getQueryClient()
  const session = await auth()

  // The API route is gated by attendance:write (everyone else is redirected to
  // /attendance/me by the client), so only warm the cache for users who'd pass.
  if (session && hasPermission(session, PERMISSIONS.ATTENDANCE_WRITE)) {
    const today = format(new Date(), "yyyy-MM-dd")
    try {
      await queryClient.prefetchQuery({
        queryKey: ["attendance-directory", today, today],
        // Same query the API route runs (app/api/attendance/directory/route.ts).
        // The client's queryFn unwraps the `{ data }` envelope, so cache `.data`.
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
