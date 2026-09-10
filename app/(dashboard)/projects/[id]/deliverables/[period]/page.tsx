"use client"

import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"

import { Skeleton } from "@/components/ui/skeleton"
import { useProject } from "@/features/projects/hooks/use-projects"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"

// Same split as the project page: the feature chunk loads with this page, not
// with the app shell.
const DeliverablePeriodPage = dynamic(
  () => import("@/features/projects").then((m) => m.DeliverablePeriodPage),
  { loading: () => <Skeleton className="h-64 rounded-sm" /> },
)

/**
 * One deliverable - a planned week or month - on its own page.
 *
 * /projects/[id]/deliverables/[period], where [period] is the window as
 * "2026-09-07_2026-09-11" (or "unplanned"). Permissions are worked out the
 * same way the project page works them out, so the two never disagree about
 * who may plan, assign or accept.
 */
export default function Page() {
  const params = useParams()
  const projectRef = params.id as string
  const periodSlug = params.period as string

  const { data: session } = useSession()
  const { can } = usePermissions()
  const userId = session?.user?.id ?? ""

  const { data } = useProject(projectRef)
  const project = data?.data
  // project:write, or the account manager of THIS project.
  const canManage = can(PERMISSIONS.PROJECT_WRITE) || (!!project && project.owner.id === userId)

  return (
    <DeliverablePeriodPage
      projectId={projectRef}
      periodSlug={periodSlug}
      canManage={canManage}
      currentUserId={userId}
      projectName={project?.name}
    />
  )
}
