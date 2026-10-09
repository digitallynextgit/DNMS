"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Pencil, Power, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FormDialog } from "@/components/shared/form-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { useRowSelection } from "@/hooks/use-row-selection"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { apiFetch } from "@/lib/api-fetch"

interface Designation {
  id: string
  title: string
  level: number
  isActive: boolean
  _count: { employees: number }
}

async function fetchDesignations(): Promise<{ data: Designation[] }> {
  const body = await apiFetch<{ data: Designation[] }>("/api/designations?includeInactive=true")
  return { data: body.data as Designation[] }
}

async function saveDesignation(body: {
  id?: string
  title: string
  level: number
}): Promise<{ data: Designation }> {
  const res = body.id
    ? await apiFetch<{ data: Designation }>(`/api/designations/${body.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: body.title, level: body.level }),
      })
    : await apiFetch<{ data: Designation }>("/api/designations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: body.title, level: body.level }),
      })
  return { data: res.data as Designation }
}

async function patchActive(id: string, isActive: boolean): Promise<void> {
  await apiFetch<{ data: Designation }>(`/api/designations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  })
}

async function purgeDesignation(id: string): Promise<void> {
  await apiFetch<{ data: { message: string } }>(`/api/designations/${id}?permanent=true`, {
    method: "DELETE",
  })
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    saveMut.mutate({
      id: editing?.id,
      title: title.trim(),
      level: Number(level) || 1,
    })
  }

  const designations = data?.data ?? []

  // The list is reused as a lookup, so it's fetched in full and the table pages it.
  const query = search.trim().toLowerCase()
  const filtered = query
    ? designations.filter((d) => d.title.toLowerCase().includes(query))
    : designations

  const selection = useRowSelection(filtered.map((d) => d.id))
  // Only ticked rows the search still shows, matching the table's "N selected".
  const picked = filtered.filter((d) => selection.isSelected(d.id))
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)

  async function handleBulkDeactivate() {
    setBulkPending(true)
    try {
      for (const d of picked) {
        await patchActive(d.id, false)
      }
      invalidate()
      selection.clear()
      setBulkOpen(false)
      toast.success("Designations deactivated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to deactivate")
    } finally {
      setBulkPending(false)
    }
  }

  const columns: DataTableColumn<Designation>[] = [
    {
      header: "Title",
      sortValue: (d) => d.title,
      cell: (d) => <span className="font-medium">{d.title}</span>,
    },
    {
      header: "Level",
      sortValue: (d) => d.level,
      cell: (d) => <span className="text-muted-foreground">L{d.level}</span>,
    },
    {
      header: "Employees",
      sortValue: (d) => d._count.employees,
      cell: (d) => <span className="text-muted-foreground tabular-nums">{d._count.employees}</span>,
    },
    {
      header: "Status",
      sortValue: (d) => (d.isActive ? "Active" : "Inactive"),
      cell: (d) => (
        <Badge variant="outline" className="text-xs">
          {d.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(canWrite
      ? [
          {
            header: "Actions",
            align: "right" as const,
            cell: (d: Designation) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(d)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
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
                    className="text-destructive hover:bg-destructive/10"
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
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Designation
            </Button>
          ) : undefined
        }
      />

      <DataTable
        tableId="designations"
        itemLabel="designation"
        columns={columns}
        rows={filtered}
        rowKey={(d) => d.id}
        showSerial
        pageKey={query}
        selection={canWrite ? selection : undefined}
        selectionActions={
          <Button variant="destructive" onClick={() => setBulkOpen(true)} disabled={bulkPending}>
            <Power className="mr-1.5 h-3.5 w-3.5" />
            Deactivate
          </Button>
        }
        rowClassName={(d) => (d.isActive ? undefined : "opacity-60")}
        loading={isLoading}
        toolbar={
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Search designations..."
            label="Search designations"
          />
        }
        empty={
          designations.length === 0 ? "No designations yet." : "No designations match your search."
        }
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}
        title={editing ? "Edit Designation" : "Add Designation"}
        isEdit={!!editing}
        isPending={saveMut.isPending}
        submitDisabled={!title.trim()}
        size="sm"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <Label required htmlFor="desig-title">
            Title
          </Label>
          <Input
            id="desig-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Software Engineer"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desig-level">Level (1 to 13)</Label>
          <Input
            id="desig-level"
            type="number"
            min={1}
            max={13}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Deactivate ${picked.length} designation${picked.length === 1 ? "" : "s"}?`}
        description="The selected designations will be deactivated. You can reactivate them later."
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={handleBulkDeactivate}
        isLoading={bulkPending}
      />

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
