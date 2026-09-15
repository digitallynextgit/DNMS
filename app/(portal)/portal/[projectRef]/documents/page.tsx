import { redirect, notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { PortalDocuments } from "@/features/client-portal"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Documents & assets",
  description: "Shared project documents and campaign assets.",
}

export default async function PortalDocumentsPage({
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
  if (!grant.modules.includes("documents")) notFound()

  return <PortalDocuments projectRef={projectRef} />
}
