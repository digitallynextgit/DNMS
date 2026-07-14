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
 * Server shell for the leave directory: prefetch the leave-request list so
 * LeaveDirectoryClient's `useLeaveRequests(...)` finds a warm cache and paints
 * immediately, with no client fetch on first load.
 *
 * The query key MUST stay byte-identical to the `filters` object the client
 * builds (see leave-directory-client.tsx). Only `tab` is URL-backed
 * (`useUrlState("tab", "requests")`); every other filter starts at its default on
 * mount (status "all" → undefined, page 1), so the first key is fully derivable:
 *   - the "on-leave" tab forces status "APPROVED"
 *   - "requests" and "balances" both leave status undefined
 * `useLeaveRequests` runs on all three tabs, so the same key is correct for each.
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
      // Same service the API route calls (app/api/leave/requests/route.ts) - it
      // scopes rows by the session's leave:approve permission internally and
      // already `serialize()`s its payload, so the cached value matches the wire
      // shape exactly. The client's queryFn unwraps `{ data }`, so cache `.data`.
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
