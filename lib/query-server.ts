import "server-only"

import { QueryClient } from "@tanstack/react-query"
import { cache } from "react"

/**
 * Per-request QueryClient for server-side prefetching (RSC).
 *
 * Pages that render a client component whose `useQuery` would otherwise fire on
 * mount can prefetch that query here and hand the dehydrated cache down through
 * `<HydrationBoundary>`. The client hook then finds the cache already warm and
 * paints on first render - no client fetch, no extra API round trip.
 *
 * `cache()` scopes ONE client per request and dedupes it across the RSC tree, so
 * several prefetches in the same render share a single cache. It must never be a
 * module-level singleton: that would leak one user's data into another's page.
 *
 * `staleTime` mirrors the client QueryProvider (components/providers/query-provider.tsx)
 * so a freshly hydrated query is not immediately considered stale and refetched.
 */
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60 * 1000 },
      },
    }),
)
