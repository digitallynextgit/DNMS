"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { FormDialog } from "@/components/shared/form-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

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
  const [selected, setSelected] = useState<string[]>(currentRoleIds)
  const queryClient = useQueryClient()

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
    enabled: open,
  })

  function handleOpenChange(next: boolean) {
    if (next) setSelected(currentRoleIds) // reset to current each time it opens
    setOpen(next)
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selected }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update roles" }))
        throw new Error(err.error || "Failed to update roles")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] })
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
        description={`Assign or remove roles for ${employeeName}. Roles grant permissions such as approving leave or managing payroll.`}
        isPending={save.isPending}
        submitDisabled={isLoading}
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
                className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded p-2"
              >
                <Checkbox
                  id={`role-${role.id}`}
                  checked={selected.includes(role.id)}
                  onCheckedChange={() => toggle(role.id)}
                  className="mt-0.5"
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
