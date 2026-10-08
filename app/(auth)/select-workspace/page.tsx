import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { AuthShell, WorkspacePicker } from "@/features/auth"
import { loadActiveMemberships } from "@/server/identity"
import { splitTenant, withTenant } from "@/lib/tenant-url"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Choose a workspace",
  description: "Pick the company you want to work in",
}

// Reached when a /{tenant}/... URL isn't the session's tenant, or to switch companies.
// One membership redirects straight through, so nobody sees a list of one.

/** Only ever redirect to an in-app path we built ourselves. */
function safeNext(raw: string | undefined, slug: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return `/${slug}/dashboard`
  // Re-point the path at the tenant being entered, so a colleague's link lands on the same page.
  const { rest } = splitTenant(raw)
  const target = withTenant(rest, slug)
  return target === rest && rest !== "/" ? `/${slug}/dashboard` : target
}

export default async function SelectWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { next } = await searchParams
  const memberships = await loadActiveMemberships(session.user.userId)

  // Authenticated, but no company will have them.
  if (memberships.length === 0) {
    return (
      <AuthShell>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">No workspace available</h1>
          <p className="text-muted-foreground text-sm">
            Your account is not currently active in any company. Contact your administrator.
          </p>
        </div>
      </AuthShell>
    )
  }

  // A client membership has no company pages - its home is the portal.
  if (memberships.length === 1) {
    const only = memberships[0]!
    redirect(only.kind === "CLIENT" ? "/portal" : safeNext(next, only.tenantSlug))
  }

  return (
    <AuthShell>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a workspace</h1>
        <p className="text-muted-foreground text-sm">
          Your account belongs to more than one company. Pick the one you want to work in.
        </p>
      </div>
      <WorkspacePicker
        workspaces={memberships.map((m) => ({
          membershipId: m.id,
          slug: m.tenantSlug,
          name: m.tenantName,
          kind: m.kind,
          current: m.tenantSlug === session.user.tenantSlug,
        }))}
        next={next ?? null}
      />
    </AuthShell>
  )
}
