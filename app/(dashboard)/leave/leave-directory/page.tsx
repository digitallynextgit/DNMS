import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { getQueryClient } from "@/lib/query-server"
import { getLeaveRequests } from "@/features/leave/server/leave.service"

import { LeaveDirectoryClient } from "./leave-directory-client"

type SearchParams = Record<string, string | string[] | undefined>

/** Mimic `URLSearchParams.get()`, which yields the FIRST value of a repeated key. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const PAGE_SIZE = 10

/**
 * Prefetches the list so the client paints from a warm cache. The key MUST match the client's
 * filters: only `tab` is in the URL, and "on-leave" forces status APPROVED.
 */
export default async function LeaveDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const tab = first(sp.tab) ?? "requests"
  const onLeave = tab === "on-leave"

  const filters = {
    status: onLeave ? "APPROVED" : undefined,
    leaveTypeId: undefined,
    from: undefined,
    to: undefined,
    page: 1,
    limit: PAGE_SIZE,
  }

  const queryClient = getQueryClient()

  try {
    await queryClient.prefetchQuery({
      queryKey: ["leave-requests", filters],
      // Same service as the API route (it scopes rows by leave:approve and serialize()s), so the
      // cache matches the wire shape. The client's queryFn unwraps { data }.
      queryFn: async () => {
        const result = await getLeaveRequests(filters)
        if (!result.ok) throw new Error(result.error)
        return result.data
      },
    })
  } catch (error) {
    // Never 500 the page over a prefetch - the client hook will fetch on mount.
    console.error("[LEAVE_DIRECTORY_PREFETCH]", error)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LeaveDirectoryClient />
    </HydrationBoundary>
  )
}
