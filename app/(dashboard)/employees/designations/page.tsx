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
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
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

      <div className="max-w-sm">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search designations..."
        />
      </div>

      <div className="bg-card rounded border">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded" />
            ))}
          </div>
        ) : designations.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            No designations yet.
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            No designations match your search.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Title</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Level</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Employees</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                {canWrite && (
                  <th className="text-muted-foreground px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((d) => (
                <tr
                  key={d.id}
                  className={cn("hover:bg-muted/20 transition-colors", !d.isActive && "opacity-60")}
                >
                  <td className="px-4 py-3 font-medium">{d.title}</td>
                  <td className="text-muted-foreground px-4 py-3">L{d.level}</td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {d._count.employees}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {d.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
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
                            onClick={() => {
                              if (
                                confirm(`Permanently delete "${d.title}"? This cannot be undone.`)
                              )
                                purgeMut.mutate(d.id)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
            <div className="space-y-1.5">
              <Label htmlFor="desig-title">Title</Label>
              <Input
                id="desig-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-1.5">
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
    </div>
  )
}
