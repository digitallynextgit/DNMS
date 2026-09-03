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

// =============================================================================
// The workspace switcher (M3).
//
// Reached two ways:
//   - the proxy sends you here when a /{tenant}/… URL is not the tenant your
//     session is signed in to (a shared link, or a second company)
//   - by choice, to move between companies without signing out
//
// It is deliberately NOT shown when there is nothing to choose: one membership
// redirects straight through. Today every account has exactly one, so nobody
// ever sees this page - it exists so that stops being true safely.
// =============================================================================

/** Only ever redirect to an in-app path we built ourselves. */
function safeNext(raw: string | undefined, slug: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return `/${slug}/dashboard`
  // Re-point whatever they asked for at the tenant they are actually entering,
  // so following a colleague's link lands on the same PAGE in your own company
  // rather than on a 403.
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

  // No live membership: they authenticated, but no company will have them.
  // Nothing to choose and nowhere to go.
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

  // Exactly one: never make somebody choose from a list of one. A client
  // membership has no company pages - its home is the portal.
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
