"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Building2, Check } from "lucide-react"
import { toast } from "sonner"
import { Spinner } from "@/components/shared/spinner"
import { splitTenant, withTenant } from "@/lib/tenant-url"

export interface WorkspaceOption {
  membershipId: string
  slug: string
  name: string
  kind: "STAFF" | "CLIENT"
  current: boolean
}

/**
 * Move an existing session to another company (M3).
 *
 * `update({ membershipId })` re-issues the JWT: the callback in server/auth.ts
 * re-reads that membership, checks it belongs to this user, and swaps the
 * token's tenant, roles and permissions. The id is only ever a request - the
 * server decides.
 */
export function WorkspacePicker({
  workspaces,
  next,
}: {
  workspaces: WorkspaceOption[]
  next: string | null
}) {
  const router = useRouter()
  const { update } = useSession()
  const [pending, setPending] = useState<string | null>(null)

  async function choose(workspace: WorkspaceOption) {
    setPending(workspace.membershipId)
    try {
      await update({ membershipId: workspace.membershipId })
      if (workspace.kind === "CLIENT") {
        // Client access has no company pages: its home is the portal, and the
        // proxy would only bounce a /{tenant}/… address there anyway. This is
        // how somebody who is both staff and a client contact reaches the
        // portal now that /client-login is gone.
        router.push("/portal")
        router.refresh()
        return
      }
      // Send them to the page they originally asked for, re-pointed at the
      // company they just entered.
      const { rest } = splitTenant(next && next.startsWith("/") ? next : "/dashboard")
      const target = withTenant(rest === "/" ? "/dashboard" : rest, workspace.slug)
      router.push(target === rest ? `/${workspace.slug}/dashboard` : target)
      router.refresh()
    } catch {
      toast.error("Could not switch workspace. Please try again.")
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {workspaces.map((workspace) => (
        <button
          key={workspace.membershipId}
          type="button"
          disabled={pending !== null}
          onClick={() => choose(workspace)}
          className="border-border hover:bg-muted/60 flex items-center gap-3 rounded-[6px] border p-3 text-left transition-colors disabled:opacity-60"
        >
          <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px]">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{workspace.name}</span>
            <span className="text-muted-foreground block truncate text-xs">
              /{workspace.slug} &middot; {workspace.kind === "CLIENT" ? "Client access" : "Staff"}
            </span>
          </span>
          {pending === workspace.membershipId ? (
            <Spinner />
          ) : workspace.current ? (
            <Check className="text-muted-foreground h-4 w-4" aria-label="Current workspace" />
          ) : null}
        </button>
      ))}
    </div>
  )
}
