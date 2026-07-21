import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { auth } from "@/server/auth"
import { getQueryClient } from "@/lib/query-server"
import { serialize } from "@/server/action-result"
import { listProjects } from "@/features/projects/server/projects.queries"

import { ProjectsClient } from "../projects-client"

/**
 * Server shell for the projects board (now at /projects/my-projects): prefetch
 * the project list so ProjectsClient's useQuery(["projects"]) finds a warm cache
 * and paints immediately, with no client fetch on first load.
 */
export default async function MyProjectsPage() {
  const queryClient = getQueryClient()
  const session = await auth()

  if (session) {
    try {
      await queryClient.prefetchQuery({
        queryKey: ["projects"],
        queryFn: async () => ({
          success: true,
          ...serialize(await listProjects({ limit: 100 }, session)),
        }),
      })
    } catch (error) {
      console.error("[PROJECTS_PREFETCH]", error)
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectsClient />
    </HydrationBoundary>
  )
}
