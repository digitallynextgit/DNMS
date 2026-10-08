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

/** Switches tenant via update({ membershipId }); the JWT callback in server/auth.ts verifies the membership. */
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
        // Client access has no company pages; its home is the portal.
        router.push("/portal")
        router.refresh()
        return
      }
      // Back to the page they asked for, re-pointed at the new company.
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
          className="border-border hover:bg-muted/60 flex items-center gap-3 rounded-sm border p-3 text-left transition-colors disabled:opacity-60"
        >
          <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-sm">
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
