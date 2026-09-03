"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FormDialog } from "@/components/shared/form-dialog"
import { DateField } from "@/components/shared/date-field"
import { EmployeeCombobox } from "@/features/employees/components/employee-combobox"
import { useEmployees } from "@/features/employees/hooks/use-employees"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
// Concrete modules, not the clients barrel: the barrel reaches the client
// detail page, which renders THIS form for "new project for Acme" - importing
// it here would make the two features load each other.
import { ClientCombobox } from "@/features/clients/components/client-combobox"
import { ClientFormDialog } from "@/features/clients/components/client-form-dialog"
import { ProjectLogoPicker } from "./project-logo-picker"
import { PERMISSIONS, PROJECT_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/constants"
import { IndianRupee, Plus } from "lucide-react"

interface ProjectFormValues {
  name: string
  code?: string // legacy, ignored on create (auto-generated)
  description: string
  status: string
  priority: string
  startDate: string // labelled "Onboarding Date" in UI
  budget: string
  accountManagerId: string
  /** The company this is delivered for. Empty = internal. */
  clientId: string
  /** Display only: the chosen client's name, so the picker can show it before a search. */
  clientName?: string
}

const EMPTY_FORM: ProjectFormValues = {
  name: "",
  description: "",
  status: "PLANNING",
  priority: "MEDIUM",
  startDate: "",
  budget: "",
  accountManagerId: "",
  clientId: "",
}

interface Props {
  open: boolean
  onClose: () => void
  mode: "create" | "edit"
  projectId?: string
  initial?: Partial<ProjectFormValues>
  /** Current logo URL, so edit mode shows it instead of an empty placeholder. */
  logo?: string | null
  onSuccess?: (projectId: string) => void
}

export function ProjectFormDialog({
  open,
  onClose,
  mode,
  projectId,
  initial,
  logo,
  onSuccess,
}: Props) {
  const qc = useQueryClient()
  const { can } = usePermissions()
  const canSeeBudget = can(PERMISSIONS.PROJECT_WRITE)
  const canSeeClients = can(PERMISSIONS.CLIENT_READ)
  const canAddClient = can(PERMISSIONS.CLIENT_WRITE)

  const [form, setForm] = useState<ProjectFormValues>(EMPTY_FORM)
  // Create mode only: the logo can't be uploaded until the project has an id, so
  // it waits here and is POSTed the moment creation returns one.
  const [pendingLogo, setPendingLogo] = useState<File | null>(null)
  const [newClientOpen, setNewClientOpen] = useState(false)

  // Reset / hydrate ONLY on the open transition (UI-01). Depending on `initial`
  // reset the form on every parent re-render, because both callers pass `initial`
  // as an inline object literal (new identity each render) and the project page
  // re-renders on a 15s unread-count poll / window-focus refetch - which silently
  // wiped an admin's in-progress edits mid-typing. `initial` is read here but
  // deliberately not a dependency: it is only meant to seed the form on open.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      setForm({ ...EMPTY_FORM, ...initial })
      setPendingLogo(null)
    }
    wasOpen.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Resolve the currently-selected manager's name so the combobox can show it
  // before the user opens/searches (edit mode, where we only get an id).
  const { data: empsData } = useEmployees({ status: "ACTIVE", limit: 100 }, { enabled: open })
  const selectedManager = (empsData?.data ?? []).find((e) => e.id === form.accountManagerId)
  const managerLabel = useMemo(
    () =>
      selectedManager ? `${selectedManager.firstName} ${selectedManager.lastName}` : undefined,
    [selectedManager],
  )

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
    onSuccess: async (data) => {
      const newId = data?.data?.id as string | undefined
      // Send the deferred logo now that there is something to attach it to. A
      // failure here must not read as "the project wasn't created" - it was.
      if (newId && pendingLogo) {
        try {
          const body = new FormData()
          body.append("file", pendingLogo)
          const res = await fetch(`/api/projects/${newId}/logo`, { method: "POST", body })
          if (!res.ok) throw new Error("logo upload failed")
        } catch {
          toast.warning("Project created, but the logo didn't upload. Add it from Edit.")
        }
      }
      qc.invalidateQueries({ queryKey: ["projects"] })
      // The client's own page counts its projects.
      qc.invalidateQueries({ queryKey: ["clients"] })
      qc.invalidateQueries({ queryKey: ["client"] })
      toast.success("Project created")
      onSuccess?.(newId as string)
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
      qc.invalidateQueries({ queryKey: ["clients"] })
      qc.invalidateQueries({ queryKey: ["client"] })
      toast.success("Project updated")
      onSuccess?.(projectId!)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const isPending = create.isPending || update.isPending
  const canSubmit = form.name.trim() && form.accountManagerId

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || isPending) return
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      startDate: form.startDate || null,
      accountManagerId: form.accountManagerId,
    }
    // Only someone who can see the picker can change the client. Anyone else
    // leaves the field out entirely, so an edit never silently clears it.
    if (canSeeClients) payload.clientId = form.clientId || null
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
    <>
      <FormDialog
        open={open}
        onOpenChange={(o) => !o && !isPending && onClose()}
        title={mode === "create" ? "New Project" : "Edit Project"}
        isEdit={mode === "edit"}
        isPending={isPending}
        submitDisabled={!canSubmit}
        submitLabel={mode === "create" ? "Create Project" : "Save Changes"}
        onSubmit={handleSubmit}
        contentClassName="sm:max-w-lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Logo</Label>
            <ProjectLogoPicker
              projectId={mode === "edit" ? projectId : undefined}
              value={mode === "edit" ? logo : null}
              onPendingFileChange={setPendingLogo}
            />
          </div>

          <div className="space-y-2">
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

          {/* Client - the company this is delivered for. One project per
              website or engagement, filed under the client it is for. */}
          {canSeeClients && (
            <div className="space-y-2">
              <Label>Client</Label>
              <p className="text-muted-foreground text-xs">
                The company this project is delivered for. Leave empty for internal work.
              </p>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {/* Keyed on the id so a client created from the "New" button
                      remounts the picker with its name already shown. */}
                  <ClientCombobox
                    key={form.clientId}
                    value={form.clientId || undefined}
                    onChange={(v) => setForm((f) => ({ ...f, clientId: v ?? "" }))}
                    initialLabel={form.clientName}
                    placeholder="Search clients..."
                  />
                </div>
                {canAddClient && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0 gap-1"
                    onClick={() => setNewClientOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> New
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label>Account Manager *</Label>
            <p className="text-muted-foreground text-xs">
              The lead manager under whom all teams will be created for this project.
            </p>
            <EmployeeCombobox
              value={form.accountManagerId || undefined}
              onChange={(v) => setForm((f) => ({ ...f, accountManagerId: v ?? "" }))}
              initialLabel={managerLabel}
              placeholder="Search employees..."
              modal
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
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
            <div className="space-y-2">
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

          <div className="space-y-2">
            <Label>Onboarding Date</Label>
            {/* Shared shadcn calendar popover - the same picker the employee forms
                use, so dates look and behave identically across the app. `modal`
                because this sits inside a Dialog. */}
            <DateField
              value={form.startDate}
              onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
              placeholder="Pick the onboarding date"
              modal
            />
            <p className="text-muted-foreground text-[11px]">
              The day the client / project was onboarded.
            </p>
          </div>

          {/* Budget - admin only */}
          {canSeeBudget && (
            <div className="space-y-2">
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
      </FormDialog>

      {/* Stacked on top of the project form, so "the client isn't in the list
          yet" does not mean abandoning a half-filled project. */}
      {canAddClient && (
        <ClientFormDialog
          open={newClientOpen}
          onClose={() => setNewClientOpen(false)}
          mode="create"
          onSuccess={(client) =>
            setForm((f) => ({ ...f, clientId: client.id, clientName: client.name }))
          }
        />
      )}
    </>
  )
}
