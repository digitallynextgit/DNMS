import { redirect } from "next/navigation"
import { db } from "@/server/db"
import { TenantProvider } from "@/components/tenant-link"
import {
  currentTenantSlugOrFounding,
  tenantPath,
  tenantScopedSession,
} from "@/server/tenant-request"

/**
 * Portal route group. proxy.ts already keeps staff out and signed-out visitors
 * on /client-login; this re-checks server-side (defence in depth) and, like the
 * dashboard layout, re-reads isActive on every navigation - a stateless JWT
 * outlives an account being disabled.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Establishes the tenant context for everything this layout renders (M4).
  const session = await tenantScopedSession()
  if (!session) redirect("/client-login")
  if (session.user.kind !== "client") redirect(await tenantPath("/dashboard"))

  const account = await db.clientUser.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  })
  if (!account?.isActive) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold">Access unavailable</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Your portal access has been turned off. Please contact your account manager.
        </p>
      </div>
    )
  }

  // The tenant for every <Link> in the portal (M3) - see the dashboard layout.
  const tenantSlug = await currentTenantSlugOrFounding()

  return (
    <TenantProvider slug={tenantSlug}>
      <div className="bg-background min-h-dvh">{children}</div>
    </TenantProvider>
  )
}
