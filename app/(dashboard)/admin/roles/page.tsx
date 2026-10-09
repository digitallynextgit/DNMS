"use client"

// System roles can't be deleted or have their slug changed.

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { RoleForm } from "@/features/admin/components/role-form"
import { PERMISSIONS } from "@/lib/constants"

interface RoleRow {
  id: string
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  createdAt: string
  _count: {
    rolePermissions: number
    employeeRoles: number
  }
}

export default function RolesPage() {
  const { data: session } = useSession()
  const canWrite =
    session?.user?.roles?.includes("admin_") ||
    session?.user?.permissions?.includes(PERMISSIONS.ROLE_WRITE)

  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Sets state only in the promise callbacks; `loading` starts true and refetches set it first.
  const fetchRoles = useCallback(
    () =>
      fetch("/api/roles")
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch roles")
          const json = await res.json()
          setRoles(json.data)
        })
        .catch(() => {
          toast.error("Could not load roles")
        })
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  function openCreate() {
    setEditingRole(null)
    setSheetOpen(true)
  }

  function openEdit(role: RoleRow) {
    setEditingRole(role)
    setSheetOpen(true)
  }

  function handleFormSuccess() {
    setSheetOpen(false)
    setLoading(true)
    fetchRoles()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/roles/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message ?? "Delete failed")
      }
      toast.success(`Role "${deleteTarget.displayName}" deleted`)
      setDeleteTarget(null)
      setLoading(true)
      fetchRoles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  const columns: DataTableColumn<RoleRow>[] = [
    {
      header: "Name",
      sortValue: (role) => role.displayName,
      cell: (role) => (
        <div>
          <p className="text-foreground font-medium">{role.displayName}</p>
          <p className="text-muted-foreground font-mono text-xs">{role.name}</p>
        </div>
      ),
    },
    {
      header: "Description",
      className: "text-muted-foreground max-w-[280px] truncate text-sm",
      cell: (role) =>
        role.description ? (
          <span title={role.description}>{role.description}</span>
        ) : (
          <span className="text-muted-foreground italic">-</span>
        ),
    },
    {
      header: "Permissions",
      align: "center",
      sortValue: (role) => role._count.rolePermissions,
      cell: (role) => (
        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-sm bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          {role._count.rolePermissions}
        </span>
      ),
    },
    {
      header: "Employees",
      align: "center",
      sortValue: (role) => role._count.employeeRoles,
      cell: (role) => (
        <span className="bg-muted text-muted-foreground inline-flex min-w-[2rem] items-center justify-center rounded-sm px-2.5 py-0.5 text-xs font-medium">
          {role._count.employeeRoles}
        </span>
      ),
    },
    {
      header: "Type",
      align: "center",
      sortValue: (role) => (role.isSystem ? "System" : "Custom"),
      cell: (role) =>
        role.isSystem ? (
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            System
          </Badge>
        ) : (
          <Badge variant="outline">Custom</Badge>
        ),
    },
    ...(canWrite
      ? [
          {
            header: "",
            align: "right" as const,
            cell: (role: RoleRow) => (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => openEdit(role)}
                  className="w-8 p-0"
                  aria-label={`Edit ${role.displayName}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>

                {!role.isSystem && (
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteTarget(role)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 w-8 p-0"
                    aria-label={`Delete ${role.displayName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role Management"
        description="Manage permission roles assigned to employees"
        actions={
          canWrite ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          ) : undefined
        }
      />

      {loading || roles.length > 0 ? (
        <DataTable
          tableId="roles"
          itemLabel="role"
          columns={columns}
          rows={roles}
          rowKey={(role) => role.id}
          showSerial
          loading={loading}
          mobileCard={(role) => (
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{role.displayName}</p>
                  <p className="text-muted-foreground truncate font-mono text-[11px]">
                    {role.name}
                  </p>
                </div>
                {role.isSystem ? (
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    System
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0">
                    Custom
                  </Badge>
                )}
              </div>

              {role.description && (
                <p className="text-muted-foreground text-xs">{role.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">
                  <span className="text-foreground font-medium">{role._count.rolePermissions}</span>{" "}
                  permissions
                </span>
                <span className="text-muted-foreground">
                  <span className="text-foreground font-medium">{role._count.employeeRoles}</span>{" "}
                  employees
                </span>
              </div>

              {canWrite && (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <Button className="gap-1.5" variant="outline" onClick={() => openEdit(role)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {!role.isSystem && (
                    <Button
                      variant="outline"
                      className="text-destructive gap-1.5"
                      onClick={() => setDeleteTarget(role)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        />
      ) : (
        <EmptyState variant="card" title="No roles found." />
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editingRole ? `Edit Role: ${editingRole.displayName}` : "Create Role"}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6">
            <RoleForm
              role={editingRole ?? undefined}
              onSuccess={handleFormSuccess}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete Role"
        description={
          deleteTarget
            ? `Are you sure you want to delete the role "${deleteTarget.displayName}"? This action cannot be undone. Employees assigned this role will lose its permissions immediately.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleting}
      />
    </div>
  )
}
