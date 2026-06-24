"use client"

import { useEffect } from "react"
import { signOut } from "next-auth/react"
import { Loader2 } from "lucide-react"

/**
 * Rendered by the dashboard layout when the signed-in employee's account is no
 * longer active (e.g. an approved resignation deactivated them mid-session).
 * Because sessions are stateless JWTs, the existing cookie stays valid until it
 * expires — so we force a client-side sign-out here, which clears the cookie and
 * sends them to the login page where authorize() will refuse a fresh login.
 */
export function AccountDeactivated() {
  useEffect(() => {
    signOut({ callbackUrl: "/login" })
  }, [])

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      <p className="text-sm font-medium">Your account has been deactivated.</p>
      <p className="text-muted-foreground text-xs">Signing you out…</p>
    </div>
  )
}
