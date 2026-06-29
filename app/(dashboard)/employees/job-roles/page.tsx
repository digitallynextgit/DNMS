"use client"

import { useState } from "react"
import { Plus, Loader2, Pencil, Power, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import {
  useJobRoles,
  useCreateJobRole,
  useUpdateJobRole,
  useDeleteJobRole,
  useDepartments,
  type JobRole,
} from "@/features/employees"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { cn } from "@/lib/utils"

export default function JobRolesPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.EMPLOYEE_WRITE)

  const { data: roles, isLoading } = useJobRoles({ includeInactive: true })
  const { data: deptsData } = useDepartments()
  const departments = deptsData?.data ?? []

  const createRole = useCreateJobRole()
  const updateRole = useUpdateJobRole()
  const deleteRole = useDeleteJobRole()

  const [deptFilter, setDeptFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<JobRole | null>(null)
  const [name, setName] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<JobRole | null>(null)

  const list = (roles ?? []).filter((r) => deptFilter === "all" || r.departmentId === deptFilter)

  function openCreate() {
    setEditing(null)
    setName("")
    setDepartmentId(deptFilter !== "all" ? deptFilter : "")
    setDialogOpen(true)
  }
  function openEdit(r: JobRole) {
    setEditing(r)
    setName(r.name)
    setDepartmentId(r.departmentId)
    setDialogOpen(true)
  }
  function save() {
    if (!name.trim() || !departmentId) return
    if (editing) {
      updateRole.mutate(
        { id: editing.id, body: { name: name.trim(), departmentId } },
        { onSuccess: () => setDialogOpen(false) },
      )
    } else {
      createRole.mutate(
        { name: name.trim(), departmentId },
        { onSuccess: () => setDialogOpen(false) },
      )
    }
  }

  const columns: DataTableColumn<JobRole>[] = [
    {
      header: "Role",
      cell: (r) => <span className={cn("font-medium", !r.isActive && "opacity-60")}>{r.name}</span>,
    },
    {
      header: "Department",
      className: "text-muted-foreground",
      cell: (r) => r.department.name,
    },
    {
      header: "Employees",
      className: "text-muted-foreground tabular-nums",
      cell: (r) => r._count.employees,
    },
    {
      header: "Status",
      cell: (r) => (
        <Badge variant="outline" className="text-xs">
          {r.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(canWrite
      ? [
          {
            header: "Actions",
            align: "right" as const,
            cell: (r: JobRole) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Edit"
                  onClick={() => openEdit(r)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title={r.isActive ? "Deactivate" : "Activate"}
                  disabled={updateRole.isPending}
                  onClick={() => updateRole.mutate({ id: r.id, body: { isActive: !r.isActive } })}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
                {r._count.employees === 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 h-7 w-7"
                    title="Delete permanently"
                    disabled={deleteRole.isPending}
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
        title="Job Roles"
        description="Specific roles within each department (e.g. Web Development → Full Stack Developer)."
        actions={
          canWrite ? (
            <Button onClick={openCreate} className="gap-2" disabled={departments.length === 0}>
              <Plus className="h-4 w-4" />
              Add Role
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} height="h-12" />
      ) : list.length === 0 ? (
        <EmptyState
          variant="card"
          title="No job roles yet."
          action={
            canWrite && departments.length > 0
              ? { label: "Add First Role", onClick: openCreate }
              : undefined
          }
        />
      ) : (
        <DataTable columns={columns} rows={list} rowKey={(r) => r.id} showSerial />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Job Role" : "Add Job Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jr-dept">Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="jr-dept">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jr-name">Role name</Label>
              <Input
                id="jr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Full Stack Developer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !name.trim() || !departmentId || createRole.isPending || updateRole.isPending
              }
              onClick={save}
            >
              {(createRole.isPending || updateRole.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete job role?"
        description={
          deleteTarget ? `Permanently delete "${deleteTarget.name}"? This cannot be undone.` : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteRole.isPending}
        onConfirm={() => {
          if (deleteTarget)
            deleteRole.mutate(
              { id: deleteTarget.id, permanent: true },
              { onSuccess: () => setDeleteTarget(null) },
            )
        }}
      />
    </div>
  )
}
