"use client"

import { useState, useEffect, useMemo } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Loader2, Pencil, Power, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { SearchInput } from "@/components/shared/search-input"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { useRowSelection } from "@/hooks/use-row-selection"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"

interface Department {
  id: string
  name: string
  code: string
  description: string | null
  headId: string | null
  isActive: boolean
  _count: { employees: number; jobPostings: number }
}

async function fetchDepartments(): Promise<{ data: Department[] }> {
  const body = await apiFetch<{ data: Department[] }>("/api/departments?includeInactive=true")
  return { data: body.data as Department[] }
}

async function saveDepartment(body: {
  id?: string
  name: string
  code: string
  description?: string
}): Promise<{ data: Department }> {
  const res = body.id
    ? await apiFetch<{ data: Department }>(`/api/departments/${body.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: body.name,
          code: body.code,
          description: body.description,
        }),
      })
    : await apiFetch<{ data: Department }>("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: body.name, code: body.code, description: body.description }),
      })
  return { data: res.data as Department }
}

async function patchActive(id: string, isActive: boolean): Promise<void> {
  await apiFetch<{ data: Department }>(`/api/departments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  })
}

async function purgeDepartment(id: string): Promise<void> {
  await apiFetch<{ data: { message: string } }>(`/api/departments/${id}?permanent=true`, {
    method: "DELETE",
  })
}

export default function DepartmentsPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.EMPLOYEE_WRITE)
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useUrlPage()
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["departments-admin"],
    queryFn: fetchDepartments,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["departments-admin"] })
    queryClient.invalidateQueries({ queryKey: ["departments"] })
  }

  const saveMut = useMutation({
    mutationFn: saveDepartment,
    onSuccess: () => {
      invalidate()
      toast.success(editing ? "Department updated" : "Department created")
      closeDialog()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const activeMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => patchActive(id, isActive),
    onSuccess: (_d, v) => {
      invalidate()
      toast.success(v.isActive ? "Department activated" : "Department deactivated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const purgeMut = useMutation({
    mutationFn: purgeDepartment,
    onSuccess: () => {
      invalidate()
      toast.success("Department deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setName("")
    setCode("")
    setDescription("")
    setDialogOpen(true)
  }

  function openEdit(d: Department) {
    setEditing(d)
    setName(d.name)
    setCode(d.code)
    setDescription(d.description ?? "")
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setName("")
    setCode("")
    setDescription("")
  }

  const departments = data?.data ?? []

  // ── Client-side search + slot-of-10 pagination ────────────────────────────
  // getDepartments is reused as a lookup (filters/forms), so the list is
  // fetched in full and paginated here on the client.
  const PAGE_SIZE = 10
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return departments
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.description?.toLowerCase().includes(q) ?? false),
    )
  }, [departments, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  // Reset to page 1 when the search changes.
  useEffect(() => {
    setPage(1)
  }, [search])

  // Clamp the current page if it exceeds the available pages (e.g. after a delete).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const selection = useRowSelection(rows.map((d) => d.id))
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)

  async function handleBulkDeactivate() {
    setBulkPending(true)
    try {
      for (const id of selection.selectedIds) {
        await patchActive(id, false)
      }
      invalidate()
      selection.clear()
      setBulkOpen(false)
      toast.success("Departments deactivated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to deactivate")
    } finally {
      setBulkPending(false)
    }
  }

  const columns: DataTableColumn<Department>[] = [
    {
      header: "Name",
      cell: (d) => <span className={cn("font-medium", !d.isActive && "opacity-60")}>{d.name}</span>,
    },
    {
      header: "Code",
      cell: (d) => (
        <span
          className={cn("text-muted-foreground font-mono text-xs", !d.isActive && "opacity-60")}
        >
          {d.code}
        </span>
      ),
    },
    {
      header: "Description",
      cell: (d) => (
        <span className={cn("text-muted-foreground", !d.isActive && "opacity-60")}>
          {d.description ?? "-"}
        </span>
      ),
    },
    {
      header: "Employees",
      cell: (d) => (
        <span className={cn("text-muted-foreground tabular-nums", !d.isActive && "opacity-60")}>
          {d._count.employees}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (d) => (
        <span className={cn(!d.isActive && "opacity-60")}>
          <Badge variant="outline" className="text-xs">
            {d.isActive ? "Active" : "Inactive"}
          </Badge>
        </span>
      ),
    },
    ...(canWrite
      ? [
          {
            header: "Actions",
            align: "right" as const,
            cell: (d: Department) => (
              <div
                className={cn("flex items-center justify-end gap-1", !d.isActive && "opacity-60")}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Edit"
                  onClick={() => openEdit(d)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title={d.isActive ? "Deactivate" : "Activate"}
                  disabled={activeMut.isPending}
                  onClick={() => activeMut.mutate({ id: d.id, isActive: !d.isActive })}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
                {d._count.employees === 0 && d._count.jobPostings === 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 h-7 w-7"
                    title="Delete permanently"
                    disabled={purgeMut.isPending}
                    onClick={() => setDeleteTarget(d)}
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
        title="Departments"
        description={`${departments.length} department${departments.length !== 1 ? "s" : ""} total`}
        actions={
          canWrite ? (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Department
            </Button>
          ) : undefined
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search departments..."
        className="max-w-sm"
      />

      {canWrite && (
        <BulkActionBar count={selection.count} onClear={selection.clear}>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkOpen(true)}
            disabled={bulkPending}
          >
            <Power className="mr-1.5 h-3.5 w-3.5" />
            Deactivate
          </Button>
        </BulkActionBar>
      )}

      {isLoading ? (
        <div className="bg-card rounded border">
          <ListSkeleton rows={5} height="h-12" className="p-4" />
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-card rounded border">
          <EmptyState title="No departments yet." compact />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-card rounded border">
          <EmptyState title="No departments match your search." compact />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(d) => d.id}
          showSerial
          serialOffset={(page - 1) * PAGE_SIZE}
          selection={canWrite ? selection : undefined}
        />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        onPageChange={setPage}
        itemLabel="department"
      />

      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">Name</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Engineering"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-code">Code</Label>
              <Input
                id="dept-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ENG"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-desc">Description</Label>
              <Textarea
                id="dept-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || !code.trim() || saveMut.isPending}
              onClick={() =>
                saveMut.mutate({
                  id: editing?.id,
                  name: name.trim(),
                  code: code.trim(),
                  description: description.trim() || undefined,
                })
              }
            >
              {saveMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editing ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Deactivate ${selection.count} department${selection.count === 1 ? "" : "s"}?`}
        description="The selected departments will be deactivated. Employees stay assigned; you can reactivate them later."
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={handleBulkDeactivate}
        isLoading={bulkPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete department?"
        description={
          deleteTarget ? `Permanently delete "${deleteTarget.name}"? This cannot be undone.` : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) purgeMut.mutate(deleteTarget.id)
          setDeleteTarget(null)
        }}
        isLoading={purgeMut.isPending}
      />
    </div>
  )
}
