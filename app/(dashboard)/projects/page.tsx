import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { auth } from "@/server/auth"
import { getQueryClient } from "@/lib/query-server"
import { serialize } from "@/server/action-result"
import { listProjects } from "@/features/projects/server/projects.queries"

import { ProjectsClient } from "./projects-client"

/**
 * Server shell for the projects board: prefetch the project list so
 * ProjectsClient's `useQuery({ queryKey: ["projects"] })` finds a warm cache and
 * paints immediately, with no client fetch on first load.
 *
 * The client's queryFn hits `/api/projects?limit=100` and caches the WHOLE
 * response body, so the cached value must be the normalized envelope
 * (`{ success: true, data, pagination }`) - not just the rows. `?page` in the URL
 * only drives client-side slicing of that one payload, so the key stays the
 * constant ["projects"] and needs nothing from searchParams.
 */
export default async function ProjectsPage() {
  const queryClient = getQueryClient()
  const session = await auth()

  if (session) {
    try {
      await queryClient.prefetchQuery({
        queryKey: ["projects"],
        // Same query the API route runs (app/api/projects/route.ts) - it scopes
        // rows by the session's project:write permission internally.
        queryFn: async () => ({
          success: true,
          ...serialize(await listProjects({ limit: 100 }, session)),
        }),
      })
    } catch (error) {
      // Never 500 the page over a prefetch - the client hook will fetch on mount.
      console.error("[PROJECTS_PREFETCH]", error)
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectsClient />
    </HydrationBoundary>
  )
}
