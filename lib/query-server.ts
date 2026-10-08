import "server-only"

import { QueryClient } from "@tanstack/react-query"
import { cache } from "react"

/**
 * Per-request QueryClient for RSC prefetching. `cache()` gives one per request - never a module
 * singleton, which would leak data between users. staleTime matches the client QueryProvider.
 */
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60 * 1000 },
      },
    }),
)
