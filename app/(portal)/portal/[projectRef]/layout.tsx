import { notFound, redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { PortalSidebar, PortalTopbar } from "@/features/client-portal"

/**
 * The portal shell - deliberately the SAME structure as the staff dashboard
 * layout (app/(dashboard)/layout.tsx): a fixed full-viewport grid with the rail
 * in the first column and a topbar/main stack in the second, so only <main>
 * scrolls. A client gets the app they were shown in a demo, not a different
 * product.
 *
 * It lives at [projectRef] rather than at the (portal) root because the nav is
 * per-project: only a layout under this segment can read which project is open.
 */
export default async function PortalProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectRef: string }>
}) {
  const { projectRef } = await params
  const session = await auth()
  if (!session || session.user.kind !== "client") redirect("/client-login")

  const grants = await listClientGrants(session.user.id)
  const current = grants.find((g) => g.projectRef === projectRef || g.projectId === projectRef)
  // 404, not 403: a client shouldn't be able to tell a project they don't hold
  // from one that doesn't exist.
  if (!current) notFound()

  return (
    <div className="dashboard-shell bg-background fixed inset-0 grid grid-cols-[auto_1fr] overflow-hidden">
      <PortalSidebar projects={grants} current={current} />
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr] overflow-hidden">
        <PortalTopbar
          name={session.user.firstName}
          email={session.user.email}
          company={session.user.company}
        />
        <main className="min-h-0 overflow-x-hidden overflow-y-auto px-6 py-4">{children}</main>
      </div>
    </div>
  )
}
