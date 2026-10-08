"use client"

import { useEffect } from "react"
import { signOut } from "next-auth/react"
import { Spinner } from "@/components/shared/spinner"

/** Sessions are stateless JWTs, so an inactive account is signed out client-side; login then refuses it. */
export function AccountDeactivated() {
  useEffect(() => {
    signOut({ callbackUrl: "/login" })
  }, [])

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <Spinner size="lg" className="text-muted-foreground" />
      <p className="text-sm font-medium">Your account has been deactivated.</p>
      <p className="text-muted-foreground text-xs">Signing you out…</p>
    </div>
  )
}
