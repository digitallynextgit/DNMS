"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useEmployees } from "@/features/employees"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS, PROJECT_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/constants"
import { Loader2, IndianRupee } from "lucide-react"
import { cn, getInitials } from "@/lib/utils"

interface ProjectFormValues {
  name: string
  code?: string // legacy, ignored on create (auto-generated)
  description: string
  status: string
  priority: string
  startDate: string // labelled "Onboarding Date" in UI
  budget: string
  accountManagerId: string
}

const EMPTY_FORM: ProjectFormValues = {
  name: "",
  description: "",
  status: "PLANNING",
  priority: "MEDIUM",
  startDate: "",
  budget: "",
  accountManagerId: "",
}

interface Props {
  open: boolean
  onClose: () => void
  mode: "create" | "edit"
  projectId?: string
  initial?: Partial<ProjectFormValues>
  onSuccess?: (projectId: string) => void
}

export function ProjectFormDialog({ open, onClose, mode, projectId, initial, onSuccess }: Props) {
  const qc = useQueryClient()
  const { can } = usePermissions()
  const canSeeBudget = can(PERMISSIONS.PROJECT_WRITE)

  const [form, setForm] = useState<ProjectFormValues>(EMPTY_FORM)
  const [search, setSearch] = useState("")

  // Reset / hydrate when dialog opens
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, ...initial })
      setSearch("")
    }
  }, [open, initial])

  const { data: empsData } = useEmployees({ status: "ACTIVE", limit: 100 })
  const employees = (empsData?.data ?? []).filter((e) =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()),
  )
  const selectedManager = (empsData?.data ?? []).find((e) => e.id === form.accountManagerId)

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create project" }))
        throw new Error(err.error || "Failed to create project")
      }
      return res.json()
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["projects"] })
      toast.success("Project created")
      onSuccess?.(data?.data?.id)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update project" }))
        throw new Error(err.error || "Failed to update project")
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] })
      qc.invalidateQueries({ queryKey: ["project", projectId] })
      toast.success("Project updated")
      onSuccess?.(projectId!)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const isPending = create.isPending || update.isPending
  const canSubmit = form.name.trim() && form.accountManagerId

  function handleSubmit() {
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      startDate: form.startDate || null,
      accountManagerId: form.accountManagerId,
    }
    if (canSeeBudget) {
      payload.budget = form.budget ? Number(form.budget) : null
    }
    if (mode === "create") {
      // code is auto-generated server-side as DN##
      create.mutate(payload)
    } else {
      update.mutate(payload)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Project" : "Edit Project"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project Name *</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Website Redesign"
            />
            {mode === "create" && (
              <p className="text-muted-foreground text-[11px]">
                A code <span className="font-mono font-medium">DN#####</span> will be auto-generated
                for this project.
              </p>
            )}
            {mode === "edit" && form.code && (
              <p className="text-muted-foreground text-[11px]">
                Code: <span className="font-mono font-medium">{form.code}</span> (auto-generated,
                cannot be changed)
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-desc">Description</Label>
            <Textarea
              id="project-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="What is this project about?"
            />
          </div>

          {/* Account Manager */}
          <div className="space-y-1.5">
            <Label>Account Manager *</Label>
            <p className="text-muted-foreground text-xs">
              The lead manager under whom all teams will be created for this project.
            </p>
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {selectedManager && !search && (
              <div className="bg-muted/30 flex items-center gap-2 rounded border px-3 py-2">
                <Avatar className="h-7 w-7">
                  {selectedManager.profilePhoto && (
                    <AvatarImage src={selectedManager.profilePhoto} />
                  )}
                  <AvatarFallback className="text-[10px]">
                    {getInitials(selectedManager.firstName, selectedManager.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {selectedManager.firstName} {selectedManager.lastName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {selectedManager.employeeNo} · {selectedManager.designation?.title ?? "—"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setForm((f) => ({ ...f, accountManagerId: "" }))}
                >
                  Change
                </Button>
              </div>
            )}
            {(search || !selectedManager) && (
              <div className="max-h-44 divide-y overflow-y-auto rounded border">
                {employees.length === 0 ? (
                  <p className="text-muted-foreground p-3 text-center text-xs">
                    No matching employees
                  </p>
                ) : (
                  employees.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={cn(
                        "hover:bg-muted/50 flex w-full items-center gap-2 p-2 text-left text-sm",
                        form.accountManagerId === e.id && "bg-accent",
                      )}
                      onClick={() => {
                        setForm((f) => ({ ...f, accountManagerId: e.id }))
                        setSearch("")
                      }}
                    >
                      <Avatar className="h-6 w-6">
                        {e.profilePhoto && <AvatarImage src={e.profilePhoto} />}
                        <AvatarFallback className="text-[9px]">
                          {getInitials(e.firstName, e.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {e.firstName} {e.lastName}
                        </p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {e.employeeNo} · {e.designation?.title ?? "—"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="onboarding-date">Onboarding Date</Label>
            <Input
              id="onboarding-date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
            <p className="text-muted-foreground text-[11px]">
              The day the client / project was onboarded.
            </p>
          </div>

          {/* Budget - admin only */}
          {canSeeBudget && (
            <div className="space-y-1.5">
              <Label htmlFor="project-budget">
                Budget{" "}
                <span className="text-muted-foreground font-normal">
                  (optional, admin-only field)
                </span>
              </Label>
              <div className="relative">
                <IndianRupee className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  id="project-budget"
                  type="number"
                  min="0"
                  step="1000"
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  placeholder="500000"
                  className="pl-7"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Project" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
