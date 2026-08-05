"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

import { FormDialog } from "@/components/shared/form-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Role {
  id: string
  name: string
  displayName: string
  description?: string | null
}

async function fetchRoles(): Promise<Role[]> {
  const res = await fetch("/api/roles")
  if (!res.ok) throw new Error("Failed to load roles")
  const json = await res.json()
  return json.data as Role[]
}

export function ManageRolesDialog({
  employeeId,
  employeeName,
  currentRoleIds,
}: {
  employeeId: string
  employeeName: string
  currentRoleIds: string[]
}) {
  const [open, setOpen] = useState(false)
  // ONE role per employee. The underlying grant table is many-to-many and the
  // API takes an array, but the product rule is a single role, so this holds one
  // id and the save sends a one-item list. An employee who was given several
  // before this rule opens on the first of them.
  const [selected, setSelected] = useState<string | null>(currentRoleIds[0] ?? null)
  const queryClient = useQueryClient()
  const { data: session, update: updateSession } = useSession()

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
    enabled: open,
  })

  function handleOpenChange(next: boolean) {
    if (next) setSelected(currentRoleIds[0] ?? null) // reset to current each time it opens
    setOpen(next)
  }

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selected ? [selected] : [] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update roles" }))
        throw new Error(err.error || "Failed to update roles")
      }
      return res.json()
    },
    onSuccess: async () => {
      // Refetch, don't just mark stale: `invalidateQueries` alone leaves the
      // badges showing the old roles until something else triggers a render,
      // which is what made a manual reload look necessary.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employee", employeeId], refetchType: "all" }),
        // The directory shows role chips too.
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
      ])

      // Editing YOUR OWN roles is the other half of this. Permissions are read
      // from the session JWT (see lib/permissions.ts), not from any query, so
      // the sidebar and every `can()` check would keep using the old grants
      // until the next sign-in. Ask NextAuth to reissue the token instead.
      if (employeeId === session?.user?.id) await updateSession()

      toast.success("Roles updated")
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        Manage Roles
      </Button>
      <FormDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Manage roles"
        description={`Choose the role for ${employeeName}. Each employee holds one role, which grants permissions such as approving leave or managing payroll.`}
        isPending={save.isPending}
        submitDisabled={isLoading || !selected}
        submitLabel="Save"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading roles…</p>
          ) : (roles ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No assignable roles found.</p>
          ) : (
            (roles ?? []).map((role) => (
              <label
                key={role.id}
                htmlFor={`role-${role.id}`}
                className={cn(
                  "hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-[2px] border p-2 transition-colors",
                  selected === role.id ? "border-primary bg-muted/40" : "border-transparent",
                )}
              >
                {/* Radios, not checkboxes: an employee holds exactly one role,
                    and a checkbox would promise a combination the save cannot
                    keep. Picking one clears whatever was chosen before. */}
                <input
                  type="radio"
                  id={`role-${role.id}`}
                  name="employee-role"
                  checked={selected === role.id}
                  onChange={() => setSelected(role.id)}
                  className="accent-primary mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <p className="text-sm leading-none font-medium">{role.displayName}</p>
                  {role.description && (
                    <p className="text-muted-foreground text-xs">{role.description}</p>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
      </FormDialog>
    </>
  )
}
