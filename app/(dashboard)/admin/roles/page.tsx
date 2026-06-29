"use client"

/**
 * /admin/roles – Role Management page.
 *
 * Displays all roles in a data table.  Users with the ROLE_WRITE permission
 * can create, edit, and delete roles.  System roles are protected from
 * deletion and name-slug changes.
 */

import { useEffect, useMemo, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pagination } from "@/components/shared/pagination"
import { EmptyState } from "@/components/shared/empty-state"
import { TableSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { RoleForm } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

const PAGE_SIZE = 10

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function RolesPage() {
  const { data: session } = useSession()
  const canWrite =
    session?.user?.roles?.includes("admin_") ||
    session?.user?.permissions?.includes(PERMISSIONS.ROLE_WRITE)

  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)

  // Client-side pagination over the full reused /api/roles list.
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(roles.length / PAGE_SIZE))
  const pagedRoles = useMemo(
    () => roles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [roles, page],
  )

  // Keep the current page in range when the list size changes (e.g. after a delete).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  // Sheet (create/edit) state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // -----------------------------------------------------------------------
  // Fetch roles
  // -----------------------------------------------------------------------
  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/roles")
      if (!res.ok) throw new Error("Failed to fetch roles")
      const json = await res.json()
      setRoles(json.data)
    } catch {
      toast.error("Could not load roles")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
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
      fetchRoles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Role Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage permission roles assigned to employees
          </p>
        </div>

        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        )}
      </div>

      {/* Roles table */}
      <div className="border-border bg-card overflow-hidden rounded border">
        {loading ? (
          <TableSkeleton rows={6} cols={canWrite ? 6 : 5} />
        ) : roles.length === 0 ? (
          <EmptyState title="No roles found." compact />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Permissions</TableHead>
                <TableHead className="text-center">Employees</TableHead>
                <TableHead className="text-center">Type</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>

            <TableBody>
              {pagedRoles.map((role) => (
                <TableRow key={role.id}>
                  {/* Name */}
                  <TableCell>
                    <div>
                      <p className="text-foreground font-medium">{role.displayName}</p>
                      <p className="text-muted-foreground font-mono text-xs">{role.name}</p>
                    </div>
                  </TableCell>

                  {/* Description */}
                  <TableCell className="text-muted-foreground max-w-xs truncate text-sm">
                    {role.description ?? <span className="text-muted-foreground italic">-</span>}
                  </TableCell>

                  {/* Permissions count */}
                  <TableCell className="text-center">
                    <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {role._count.rolePermissions}
                    </span>
                  </TableCell>

                  {/* Employees count */}
                  <TableCell className="text-center">
                    <span className="bg-muted text-muted-foreground inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                      {role._count.employeeRoles}
                    </span>
                  </TableCell>

                  {/* System badge */}
                  <TableCell className="text-center">
                    {role.isSystem ? (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        System
                      </Badge>
                    ) : (
                      <Badge variant="outline">Custom</Badge>
                    )}
                  </TableCell>

                  {/* Actions */}
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(role)}
                          className="h-8 w-8 p-0"
                          aria-label={`Edit ${role.displayName}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {!role.isSystem && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(role)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                            aria-label={`Delete ${role.displayName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!loading && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={roles.length}
          onPageChange={setPage}
          itemLabel="role"
        />
      )}

      {/* Create / Edit Sheet */}
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

      {/* Delete confirmation dialog */}
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
