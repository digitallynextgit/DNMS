import { redirect, notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { PortalActivityLog } from "@/features/client-portal"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Activity" }

export default async function PortalActivityPage({
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
  if (!grant.modules.includes("activity")) notFound()

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">
          What you have done in the portal, newest first.
        </p>
      </div>
      <PortalActivityLog projectRef={projectRef} />
    </div>
  )
}
