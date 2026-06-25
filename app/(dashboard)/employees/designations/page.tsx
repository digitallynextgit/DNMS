"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { SearchInput } from "@/components/shared/search-input"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} from "@/features/employees"

interface Designation {
  id: string
  title: string
  level: number
  isActive: boolean
  _count: { employees: number }
}

async function fetchDesignations(): Promise<{ data: Designation[] }> {
  const r = await getDesignations({ includeInactive: true })
  if (!r.ok) throw new Error(r.error)
  return { data: r.data as Designation[] }
}

async function saveDesignation(body: {
  id?: string
  title: string
  level: number
}): Promise<{ data: Designation }> {
  const r = body.id
    ? await updateDesignation(body.id, { title: body.title, level: body.level })
    : await createDesignation({ title: body.title, level: body.level })
  if (!r.ok) throw new Error(r.error)
  return { data: r.data as Designation }
}

async function patchActive(id: string, isActive: boolean): Promise<void> {
  const r = await updateDesignation(id, { isActive })
  if (!r.ok) throw new Error(r.error)
}

async function purgeDesignation(id: string): Promise<void> {
  const r = await deleteDesignation(id, true)
  if (!r.ok) throw new Error(r.error)
}

export default function DesignationsPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.EMPLOYEE_WRITE)
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Designation | null>(null)
  const [title, setTitle] = useState("")
  const [level, setLevel] = useState<string>("1")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Designation | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["designations-admin"],
    queryFn: fetchDesignations,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["designations-admin"] })
    queryClient.invalidateQueries({ queryKey: ["designations"] })
  }

  const saveMut = useMutation({
    mutationFn: saveDesignation,
    onSuccess: () => {
      invalidate()
      toast.success(editing ? "Designation updated" : "Designation created")
      closeDialog()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const activeMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => patchActive(id, isActive),
    onSuccess: (_d, v) => {
      invalidate()
      toast.success(v.isActive ? "Designation activated" : "Designation deactivated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const purgeMut = useMutation({
    mutationFn: purgeDesignation,
    onSuccess: () => {
      invalidate()
      toast.success("Designation deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setTitle("")
    setLevel("1")
    setDialogOpen(true)
  }

  function openEdit(d: Designation) {
    setEditing(d)
    setTitle(d.title)
    setLevel(String(d.level))
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setTitle("")
    setLevel("1")
  }

  const designations = data?.data ?? []

  // ── Client-side search + slot-of-10 pagination ────────────────────────────
  // getDesignations is reused as a lookup (filters/forms), so the list is
  // fetched in full and paginated here on the client.
  const PAGE_SIZE = 10
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return designations
    return designations.filter((d) => d.title.toLowerCase().includes(q))
  }, [designations, search])

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

  const columns: DataTableColumn<Designation>[] = [
    {
      header: "Title",
      cell: (d) => (
        <span className={cn("font-medium", !d.isActive && "opacity-60")}>{d.title}</span>
      ),
    },
    {
      header: "Level",
      cell: (d) => (
        <span className={cn("text-muted-foreground", !d.isActive && "opacity-60")}>L{d.level}</span>
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
            cell: (d: Designation) => (
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
                {d._count.employees === 0 && (
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
        title="Designations"
        description={`${designations.length} designation${designations.length !== 1 ? "s" : ""} total`}
        actions={
          canWrite ? (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Designation
            </Button>
          ) : undefined
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search designations..."
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="bg-card rounded border">
          <ListSkeleton rows={5} height="h-12" className="p-4" />
        </div>
      ) : designations.length === 0 ? (
        <div className="bg-card rounded border">
          <EmptyState title="No designations yet." compact />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-card rounded border">
          <EmptyState title="No designations match your search." compact />
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(d) => d.id} />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        onPageChange={setPage}
        itemLabel="designation"
      />

      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Designation" : "Add Designation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="desig-title">Title</Label>
              <Input
                id="desig-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desig-level">Level (1–13)</Label>
              <Input
                id="desig-level"
                type="number"
                min={1}
                max={13}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              disabled={!title.trim() || saveMut.isPending}
              onClick={() =>
                saveMut.mutate({
                  id: editing?.id,
                  title: title.trim(),
                  level: Number(level) || 1,
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
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete designation?"
        description={
          deleteTarget ? `Permanently delete "${deleteTarget.title}"? This cannot be undone.` : ""
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
