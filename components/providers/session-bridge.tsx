"use client"

import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

/**
 * Re-provides the server-resolved session inside authed shells. The root layout passes
 * session={null} (so marketing stays static), which next-auth treats as signed out for good.
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
