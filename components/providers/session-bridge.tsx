"use client"

import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

/**
 * Re-provides the SERVER-resolved session inside an authed route group.
 *
 * The root layout deliberately no longer calls auth() - that one read made
 * every page in the app dynamic, including the static marketing site. The
 * root SessionProvider therefore starts with session={null}, and useSession()
 * under it resolves client-side (fine for the marketing header and the auth
 * pages, which handle the brief unauthenticated state anyway).
 *
 * The dashboard/portal/platform shells are different: their layouts are
 * already dynamic (tenantScopedSession) and their UI is permission-gated, so
 * a null-then-fetch session made every gated button pop in after hydration.
 * Nesting a second SessionProvider with the layout's server session restores
 * correct-on-first-paint permissions exactly where that guarantee matters.
 */
export function SessionBridge({
  session,
  children,
}: {
  session: Session
  children: React.ReactNode
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>
}
