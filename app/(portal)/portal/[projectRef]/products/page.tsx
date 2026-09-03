import { redirect, notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { PortalProductGrid } from "@/features/client-portal"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Products",
  description: "Your product catalog and marketplace listings.",
}

export default async function PortalProductsPage({
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
  // The API behind the grid re-checks the module independently, so a hand-typed
  // URL renders nothing either way.
  if (!grant.modules.includes("products")) notFound()

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground text-sm">
          Your catalog across every connected store, as we see it.
        </p>
      </div>
      <PortalProductGrid projectRef={projectRef} />
    </div>
  )
}
