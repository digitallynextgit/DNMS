import { redirect, notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { moduleByKey } from "@/features/client-portal"

/**
 * A project has no landing page of its own - it opens on the first section the
 * client's grant allows. Which section that is therefore differs per client on
 * the same project, which is the point.
 */
export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ projectRef: string }>
}) {
  const { projectRef } = await params
  const session = await auth()
  if (!session || session.user.kind !== "client") redirect("/client-login")

  const grant = (await listClientGrants(session.user.id)).find(
    (g) => g.projectRef === projectRef || g.projectId === projectRef,
  )
  if (!grant) notFound()

  const first = grant.modules[0]
  if (!first) {
    return (
      <div className="text-muted-foreground mx-auto max-w-md py-20 text-center text-sm">
        No sections have been shared with you on {grant.projectName} yet. Please contact your
        account manager.
      </div>
    )
  }

  redirect(`/portal/${grant.projectRef}/${moduleByKey(first)!.path}`)
}
