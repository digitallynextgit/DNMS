"use client"

/**
 * RoleForm – create or edit a role.
 *
 * Features:
 *  - name (text slug, auto-normalised to lowercase_with_underscores)
 *  - displayName (human-readable label)
 *  - description (optional textarea)
 *  - Permission selection grouped by module, with a "select all" toggle per
 *    module group
 *  - On submit: POST /api/roles (create) or PATCH /api/roles/:id (edit)
 *  - Success toast + parent callback on completion
 *
 * Props:
 *   role       – when provided, the form operates in "edit" mode
 *   onSuccess  – called after a successful save
 *   onCancel   – called when the user clicks "Cancel"
 */

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

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

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const roleFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores are allowed"),
  displayName: z.string().min(1, "Display name is required").max(80),
  description: z.string().max(500).optional(),
})

type RoleFormValues = z.infer<typeof roleFormSchema>

// ---------------------------------------------------------------------------
// Permission types (mirror Prisma Permission model)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Existing-role shape (what the parent passes in when editing)
// ---------------------------------------------------------------------------
interface RoleInput {
  id: string
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  rolePermissions?: { permission: Permission }[]
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface RoleFormProps {
  role?: RoleInput
  onSuccess: () => void
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function RoleForm({ role, onSuccess, onCancel }: RoleFormProps) {
  const isEditing = !!role

  // Permission groups fetched from the API
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([])
  const [loadingPermissions, setLoadingPermissions] = useState(true)

  // Currently selected permission ids
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Form
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: role?.name ?? "",
      displayName: role?.displayName ?? "",
      description: role?.description ?? "",
    },
  })

  const { isSubmitting } = form.formState

  // ---------------------------------------------------------------------------
  // Load permissions from API + pre-select existing ones when editing
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadPermissions() {
      setLoadingPermissions(true)
      try {
        // Fetch all available permissions
        const [permsRes, roleRes] = await Promise.all([
          fetch("/api/permissions"),
          // If editing, also fetch the full role detail to get its permissions
          role?.id ? fetch(`/api/roles/${role.id}`) : Promise.resolve(null),
        ])

        if (!permsRes.ok) throw new Error("Failed to load permissions")
        const permsJson = await permsRes.json()
        setPermissionGroups(permsJson.data)

        // Pre-select from the fetched role detail
        if (roleRes && roleRes.ok) {
          const roleJson = await roleRes.json()
          const existingIds: string[] = (roleJson.data?.rolePermissions ?? []).map(
            (rp: { permission: Permission }) => rp.permission.id,
          )
          setSelectedIds(new Set(existingIds))
        } else if (role?.rolePermissions) {
          // Fallback: use what the parent passed in
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

  // ---------------------------------------------------------------------------
  // Toggle helpers
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Auto-normalise the name slug as the user types
  // ---------------------------------------------------------------------------
  function handleNameInput(e: React.ChangeEvent<HTMLInputElement>) {
    const normalized = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
    form.setValue("name", normalized, { shouldValidate: true })
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name slug */}
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

        {/* Display name */}
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. HR Manager" disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
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
                  disabled={isSubmitting}
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* Permissions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
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
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading permissions…
            </div>
          ) : (
            <div className="space-y-5">
              {permissionGroups.map((group) => {
                const fullySelected = isModuleFullySelected(group)
                const partiallySelected = isModulePartiallySelected(group)

                return (
                  <div key={group.module} className="space-y-2">
                    {/* Module header with "select all" checkbox */}
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

                    {/* Individual permissions */}
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

        {/* Footer buttons */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || loadingPermissions}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
