import { redirect, notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { ProjectMailerTab } from "@/features/project-mailer/components/project-mailer-tab"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Email campaigns",
  description: "Send email campaigns to your subscribers.",
}

/** The same component staff use; withMailerAccess admits a client holding the "mailer" module. */
export default async function PortalMailerPage({
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
  // Belt and braces: every endpoint behind this re-proves the module itself.
  if (!grant.modules.includes("mailer")) notFound()

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Email campaigns</h1>
        <p className="text-muted-foreground text-sm">
          Send to your subscriber list from your own address. Everything you do here is recorded in
          Activity.
        </p>
      </div>
      <ProjectMailerTab projectRef={projectRef} canManage />
    </div>
  )
}
