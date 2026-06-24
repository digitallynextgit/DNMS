"use client"

import { useState } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/features/employees"

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
  const r = await getDepartments({ includeInactive: true })
  if (!r.ok) throw new Error(r.error)
  return { data: r.data as Department[] }
}

async function saveDepartment(body: {
  id?: string
  name: string
  code: string
  description?: string
}): Promise<{ data: Department }> {
  const r = body.id
    ? await updateDepartment(body.id, {
        name: body.name,
        code: body.code,
        description: body.description,
      })
    : await createDepartment({ name: body.name, code: body.code, description: body.description })
  if (!r.ok) throw new Error(r.error)
  return { data: r.data as Department }
}

async function patchActive(id: string, isActive: boolean): Promise<void> {
  const r = await updateDepartment(id, { isActive })
  if (!r.ok) throw new Error(r.error)
}

async function purgeDepartment(id: string): Promise<void> {
  const r = await deleteDepartment(id, true)
  if (!r.ok) throw new Error(r.error)
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

      <div className="bg-card rounded border">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-sm">No departments yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Name</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Code</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Description
                </th>
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
              {departments.map((d) => (
                <tr
                  key={d.id}
                  className={cn("hover:bg-muted/20 transition-colors", !d.isActive && "opacity-60")}
                >
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">{d.code}</td>
                  <td className="text-muted-foreground px-4 py-3">{d.description ?? "-"}</td>
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
                        {d._count.employees === 0 && d._count.jobPostings === 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 h-7 w-7"
                            title="Delete permanently"
                            disabled={purgeMut.isPending}
                            onClick={() => {
                              if (confirm(`Permanently delete "${d.name}"? This cannot be undone.`))
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

      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name">Name</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Engineering"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-code">Code</Label>
              <Input
                id="dept-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ENG"
              />
            </div>
            <div className="space-y-1.5">
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
    </div>
  )
}
