"use client"

import { useSession } from "next-auth/react"
import { SYSTEM_ROLES } from "@/lib/constants"

export function usePermissions() {
  const { data: session, status } = useSession()

  // While the session is resolving there are NO permissions yet, so every
  // `can()` answers false. Screens that branch on a permission must wait for
  // this rather than trusting that first answer - otherwise a manager renders
  // the non-manager view for a beat, mounting components meant for someone else
  // before flipping. See the progress page.
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
