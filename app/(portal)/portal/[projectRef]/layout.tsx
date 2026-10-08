import { notFound, redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { PortalSidebar, PortalTopbar, PortalMobileTabbar } from "@/features/client-portal"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Client portal",
  description: "Your project's client portal.",
}

/** Same shell as the staff dashboard. Under [projectRef] because the nav is per-project. */
export default async function PortalProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectRef: string }>
}) {
  const { projectRef } = await params
  const session = await auth()
  if (!session || session.user.kind !== "client") redirect("/login")

  const grants = await listClientGrants(session.user.id)
  const current = grants.find((g) => g.projectRef === projectRef || g.projectId === projectRef)
  // 404, not 403: a client shouldn't be able to tell a project they don't hold
  // from one that doesn't exist.
  if (!current) notFound()

  return (
    <div className="dashboard-shell bg-background fixed inset-0 grid grid-cols-1 overflow-hidden md:grid-cols-[auto_1fr]">
      {/* On a phone the rail becomes a bottom tab bar of this client's granted modules. */}
      <div className="hidden md:contents">
        <PortalSidebar projects={grants} current={current} />
      </div>
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden">
        <PortalTopbar
          name={session.user.firstName}
          email={session.user.email}
          company={session.user.company}
        />
        <main className="min-h-0 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6">
          {children}
        </main>
        <PortalMobileTabbar projectRef={current.projectRef} modules={current.modules} />
      </div>
    </div>
  )
}
