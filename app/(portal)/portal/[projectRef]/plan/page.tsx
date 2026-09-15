import { redirect, notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { PortalPlan } from "@/features/client-portal"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Content plan",
  description: "What is planned between two dates, and what has been made against it.",
}

export default async function PortalPlanPage({
  params,
}: {
  params: Promise<{ projectRef: string }>
}) {
  const { projectRef } = await params
  const session = await auth()
  if (!session || session.user.kind !== "client") redirect("/login")

  const grant = (await listClientGrants(session.user.id)).find(
    (g) => g.projectRef === projectRef || g.projectId === projectRef,
  )
  if (!grant) notFound()
  // The API behind the page re-checks the module independently, so a hand-typed
  // URL renders nothing either way.
  if (!grant.modules.includes("plan")) notFound()

  return <PortalPlan projectRef={projectRef} />
}
