"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FormDialog } from "@/components/shared/form-dialog"
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
import { DateField } from "@/components/shared/date-field"
import { apiFetch } from "@/lib/api-fetch"
import { TASK_PRIORITY_LABELS } from "@/lib/constants"
import { useProjects, useProjectTeams } from "@/features/projects/hooks/use-projects"
import { useSeoSites } from "@/features/seo"

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]

/**
 * Create a task from anywhere (e.g. My Tasks): pick the project, then a team in
 * it, then optionally an assignee from that team - plus title/description/
 * priority/due-date/estimate. New tasks start in "To-do"; a task you assign to
 * yourself goes to your manager for approval (server rule).
 *
 * Opened from INSIDE a project (`lockProject`), the project is already decided,
 * so the picker is hidden rather than shown pre-filled and un-changeable.
 */
export function TaskCreateDialog({
  open,
  onOpenChange,
  defaultProjectId,
  lockProject = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectId?: string
  /** Hide the project picker - the caller already scoped it. */
  lockProject?: boolean
}) {
  const qc = useQueryClient()
  // Only needed to populate the picker; skip the fetch when it isn't rendered.
  const { data: projectsData } = useProjects({ enabled: !lockProject })
  const projects = projectsData?.data ?? []

  const [projectId, setProjectId] = React.useState(defaultProjectId ?? "")
  const [teamId, setTeamId] = React.useState("")
  const [assigneeId, setAssigneeId] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [priority, setPriority] = React.useState("MEDIUM")
  const [dueDate, setDueDate] = React.useState("")
  // Estimate is captured as hours + minutes but stored as decimal hours, which
  // is what ProjectTask.estimatedHours (Float) and every report already expect.
  const [estHours, setEstHours] = React.useState("")
  const [estMinutes, setEstMinutes] = React.useState("")
  const [seoPropertyId, setSeoPropertyId] = React.useState("")

  // Sites tracked under this project. Only offered when the project actually has
  // more than the implicit "whole project" scope.
  const { data: seoData } = useSeoSites(projectId)
  const sites = projectId ? (seoData?.properties ?? []) : []

  const { data: teamsData } = useProjectTeams(projectId || undefined)
  const teams = teamsData?.data ?? []
  const team = teams.find((t) => t.id === teamId)
  const assignees = team?.members ?? []

  // Reset on open, and clear dependent selects when the parent changes.
  React.useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId ?? "")
      setTeamId("")
      setAssigneeId("")
      setTitle("")
      setDescription("")
      setPriority("MEDIUM")
      setDueDate("")
      setEstHours("")
      setEstMinutes("")
      setSeoPropertyId("")
    }
  }, [open, defaultProjectId])
  React.useEffect(() => {
    setTeamId("")
    setAssigneeId("")
    setSeoPropertyId("")
  }, [projectId])
  React.useEffect(() => {
    setAssigneeId("")
  }, [teamId])

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/projects/${projectId}/teams/${teamId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      qc.invalidateQueries({ queryKey: ["team-tasks", projectId, teamId] })
      qc.invalidateQueries({ queryKey: ["project-all-tasks", projectId] })
      toast.success("Task created")
      onOpenChange(false)
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to create task"),
  })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    create.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeId: assigneeId || undefined,
      priority,
      dueDate: dueDate || undefined,
      estimatedHours: estimateInHours,
      seoPropertyId: seoPropertyId || undefined,
    })
  }

  // Round to 2dp so 20 minutes stores as 0.33 rather than 0.3333333333333333.
  const rawEstimate = (Number(estHours) || 0) + (Number(estMinutes) || 0) / 60
  const estimateInHours = rawEstimate > 0 ? Math.round(rawEstimate * 100) / 100 : undefined

  const canSubmit = !!projectId && !!teamId && !!title.trim()

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New Task"
      isPending={create.isPending}
      submitDisabled={!canSubmit}
      submitLabel="Create task"
      size="md"
      onSubmit={handleSubmit}
    >
      <div className="space-y-4">
        {!lockProject && (
          <div className="space-y-2">
            <Label>
              Project<span className="text-destructive"> *</span>
            </Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>
            Team<span className="text-destructive"> *</span>
          </Label>
          <Select value={teamId} onValueChange={setTeamId} disabled={!projectId}>
            <SelectTrigger>
              <SelectValue placeholder={projectId ? "Select a team" : "Pick a project first"} />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {sites.length > 0 && (
          <div className="space-y-2">
            <Label>Site</Label>
            <Select
              value={seoPropertyId || "all"}
              onValueChange={(v) => setSeoPropertyId(v === "all" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Whole project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Whole project</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.label} — {site.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Which of this project&apos;s {sites.length} tracked sites this work is for.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Assignee</Label>
          <Select
            value={assigneeId || "auto"}
            onValueChange={(v) => setAssigneeId(v === "auto" ? "" : v)}
            disabled={!teamId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Team manager (default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Team manager (default)</SelectItem>
              {assignees.map((m) => (
                <SelectItem key={m.employeeId} value={m.employeeId}>
                  {m.employee.firstName} {m.employee.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Assign it to yourself and it goes to your manager for approval.
          </p>
        </div>

        <div className="space-y-2">
          <Label>
            Title<span className="text-destructive"> *</span>
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Details, context, links…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p] ?? p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            {/* modal: the popover must layer above the dialog it sits in. */}
            <DateField value={dueDate} onChange={setDueDate} modal />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Estimated time</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="1"
                value={estHours}
                onChange={(e) => setEstHours(e.target.value)}
                placeholder="0"
                className="pr-12"
                aria-label="Estimated hours"
              />
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
                hours
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="59"
                step="5"
                value={estMinutes}
                onChange={(e) => setEstMinutes(e.target.value)}
                placeholder="0"
                className="pr-12"
                aria-label="Estimated minutes"
              />
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
                mins
              </span>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            {estimateInHours ? `Stored as ${estimateInHours} h` : "Optional"}
          </p>
        </div>
      </div>
    </FormDialog>
  )
}
