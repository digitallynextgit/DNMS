"use client"

import { useSession } from "next-auth/react"
import { SYSTEM_ROLES } from "@/lib/constants"

export function usePermissions() {
  const { data: session, status } = useSession()

  // No permissions while the session resolves, so every can() is false - wait for this before branching.
  const isLoading = status === "loading"

  const permissions = session?.user.permissions ?? []
  const roles = session?.user.roles ?? []
  const userId = session?.user.id ?? null
  const isAdmin_ = roles.includes(SYSTEM_ROLES.ADMIN_)

  function can(scope: string): boolean {
    if (isAdmin_) return true
    return permissions.includes(scope)
  }

  function canAny(scopes: string[]): boolean {
    if (isAdmin_) return true
    return scopes.some((s) => permissions.includes(s))
  }

  function canAll(scopes: string[]): boolean {
    if (isAdmin_) return true
    return scopes.every((s) => permissions.includes(s))
  }

  return { can, canAny, canAll, isAdmin_, isLoading, permissions, roles, userId }
}
