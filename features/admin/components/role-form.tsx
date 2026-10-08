"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Spinner } from "@/components/shared/spinner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const roleFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores are allowed"),
  displayName: z.string().min(1, "Display name is required").max(80),
  description: z.string().max(500).optional(),
})

type RoleFormValues = z.infer<typeof roleFormSchema>

interface Permission {
  id: string
  scope: string
  module: string
  action: string
  description: string | null
}

interface PermissionGroup {
  module: string
  permissions: Permission[]
}

interface RoleInput {
  id: string
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  rolePermissions?: { permission: Permission }[]
}

interface RoleFormProps {
  role?: RoleInput
  onSuccess: () => void
  onCancel: () => void
}

export function RoleForm({ role, onSuccess, onCancel }: RoleFormProps) {
  const isEditing = !!role

  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([])
  const [loadingPermissions, setLoadingPermissions] = useState(true)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: role?.name ?? "",
      displayName: role?.displayName ?? "",
      description: role?.description ?? "",
    },
  })

  const { isSubmitting } = form.formState

  useEffect(() => {
    async function loadPermissions() {
      setLoadingPermissions(true)
      try {
        const [permsRes, roleRes] = await Promise.all([
          fetch("/api/permissions"),
          role?.id ? fetch(`/api/roles/${role.id}`) : Promise.resolve(null),
        ])

        if (!permsRes.ok) throw new Error("Failed to load permissions")
        const permsJson = await permsRes.json()
        setPermissionGroups(permsJson.data)

        if (roleRes && roleRes.ok) {
          const roleJson = await roleRes.json()
          const existingIds: string[] = (roleJson.data?.rolePermissions ?? []).map(
            (rp: { permission: Permission }) => rp.permission.id,
          )
          setSelectedIds(new Set(existingIds))
        } else if (role?.rolePermissions) {
          setSelectedIds(new Set(role.rolePermissions.map((rp) => rp.permission.id)))
        }
      } catch {
        toast.error("Could not load permissions")
      } finally {
        setLoadingPermissions(false)
      }
    }
    loadPermissions()
  }, [role?.id])

  function togglePermission(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function isModuleFullySelected(group: PermissionGroup) {
    return group.permissions.every((p) => selectedIds.has(p.id))
  }

  function isModulePartiallySelected(group: PermissionGroup) {
    return group.permissions.some((p) => selectedIds.has(p.id)) && !isModuleFullySelected(group)
  }

  function toggleModule(group: PermissionGroup) {
    const fullySelected = isModuleFullySelected(group)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (fullySelected) {
        group.permissions.forEach((p) => next.delete(p.id))
      } else {
        group.permissions.forEach((p) => next.add(p.id))
      }
      return next
    })
  }

  function handleNameInput(e: React.ChangeEvent<HTMLInputElement>) {
    const normalized = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
    form.setValue("name", normalized, { shouldValidate: true })
  }

  async function onSubmit(values: RoleFormValues) {
    const payload = {
      name: values.name,
      displayName: values.displayName,
      description: values.description ?? null,
      permissionIds: Array.from(selectedIds),
    }

    const url = isEditing ? `/api/roles/${role!.id}` : "/api/roles"
    const method = isEditing ? "PATCH" : "POST"

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "Request failed")
      }

      toast.success(
        isEditing ? `Role "${values.displayName}" updated` : `Role "${values.displayName}" created`,
      )
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Internal name (slug)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(e) => {
                    field.onChange(e)
                    handleNameInput(e)
                  }}
                  placeholder="e.g. hr_manager"
                  aria-label="e.g. hr_manager"
                  disabled={isSubmitting || (isEditing && role?.isSystem === true)}
                />
              </FormControl>
              <FormDescription>
                Lowercase letters, numbers, and underscores only. Cannot be changed for system
                roles.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g. HR Manager"
                  aria-label="e.g. HR Manager"
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Optional description of this role's purpose…"
                  aria-label="Optional description of this role's purpose"
                  disabled={isSubmitting}
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-foreground text-sm font-medium">Permissions</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {selectedIds.size} permission
                {selectedIds.size !== 1 ? "s" : ""} selected
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all-permissions"
                checked={
                  permissionGroups.length > 0 &&
                  permissionGroups.every((g) => isModuleFullySelected(g))
                }
                onCheckedChange={(checked) => {
                  setSelectedIds(() => {
                    const next = new Set<string>()
                    if (checked) {
                      permissionGroups.forEach((g) => g.permissions.forEach((p) => next.add(p.id)))
                    }
                    return next
                  })
                }}
                disabled={isSubmitting || loadingPermissions}
              />
              <label
                htmlFor="select-all-permissions"
                className="text-foreground cursor-pointer text-sm font-medium select-none"
              >
                Select All
              </label>
            </div>
          </div>

          {loadingPermissions ? (
            <div className="text-muted-foreground flex items-center gap-2 py-4">
              <Spinner />
              Loading permissions…
            </div>
          ) : (
            <div className="space-y-5">
              {permissionGroups.map((group) => {
                const fullySelected = isModuleFullySelected(group)
                const partiallySelected = isModulePartiallySelected(group)

                return (
                  <div key={group.module} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`module-${group.module}`}
                        checked={fullySelected}
                        data-state={partiallySelected ? "indeterminate" : undefined}
                        onCheckedChange={() => toggleModule(group)}
                        disabled={isSubmitting}
                        aria-label={`Select all ${group.module} permissions`}
                      />
                      <label
                        htmlFor={`module-${group.module}`}
                        className="text-foreground cursor-pointer text-sm font-semibold capitalize select-none"
                      >
                        {group.module.replace("_", " ")}
                      </label>
                    </div>

                    <div className="ml-6 space-y-1.5">
                      {group.permissions.map((permission) => (
                        <div key={permission.id} className="flex items-start gap-2">
                          <Checkbox
                            id={`perm-${permission.id}`}
                            checked={selectedIds.has(permission.id)}
                            onCheckedChange={() => togglePermission(permission.id)}
                            disabled={isSubmitting}
                            className="mt-0.5"
                          />
                          <label
                            htmlFor={`perm-${permission.id}`}
                            className="cursor-pointer select-none"
                          >
                            <span className="text-foreground font-mono text-sm">
                              {permission.scope}
                            </span>
                            {permission.description && (
                              <span className="text-muted-foreground block text-xs">
                                {permission.description}
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <Separator />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || loadingPermissions}
            loading={isSubmitting}
          >
            {isSubmitting
              ? isEditing
                ? "Saving…"
                : "Creating…"
              : isEditing
                ? "Save changes"
                : "Create role"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
