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
import { apiFetch } from "@/lib/api-fetch"
import { TASK_PRIORITY_LABELS } from "@/lib/constants"
import { useProjects, useProjectTeams } from "@/features/projects/hooks/use-projects"

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]

/**
 * Create a task from anywhere (e.g. My Tasks): pick the project, then a team in
 * it, then optionally an assignee from that team - plus title/description/
 * priority/due-date/estimate. New tasks start in "To-do"; a task you assign to
 * yourself goes to your manager for approval (server rule).
 */
export function TaskCreateDialog({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectId?: string
}) {
  const qc = useQueryClient()
  const { data: projectsData } = useProjects()
  const projects = projectsData?.data ?? []

  const [projectId, setProjectId] = React.useState(defaultProjectId ?? "")
  const [teamId, setTeamId] = React.useState("")
  const [assigneeId, setAssigneeId] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [priority, setPriority] = React.useState("MEDIUM")
  const [dueDate, setDueDate] = React.useState("")
  const [estimatedHours, setEstimatedHours] = React.useState("")

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
      setEstimatedHours("")
    }
  }, [open, defaultProjectId])
  React.useEffect(() => {
    setTeamId("")
    setAssigneeId("")
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
      estimatedHours: estimatedHours || undefined,
    })
  }

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
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Estimated hours</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
    </FormDialog>
  )
}
