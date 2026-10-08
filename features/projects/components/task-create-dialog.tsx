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
import { Switch } from "@/components/ui/switch"
import { apiFetch } from "@/lib/api-fetch"
import { PERMISSIONS, TASK_PRIORITY_LABELS } from "@/lib/constants"
import { useProject, useProjects, useProjectTeams } from "@/features/projects/hooks/use-projects"
import { useProjectGoals } from "@/features/projects/hooks/use-goals"
import { NONE_OPTION, SearchPicker } from "./search-picker"

/** Radix Select cannot hold "" as a value, so "no goal" needs a sentinel. */
const NO_GOAL = NONE_OPTION
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { useSeoSites } from "@/features/seo/hooks/use-seo"
import {
  ADHOC_DESCRIPTION,
  ADHOC_LABEL,
  ADHOC_ROW_ID,
} from "@/features/projects/lib/task-permissions"
import { useSession } from "next-auth/react"

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]

/** Self-assigned tasks go to your manager for approval (server rule). `lockProject` hides the project picker. */
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
  // Captured as hours + minutes, stored as decimal hours.
  const [estHours, setEstHours] = React.useState("")
  const [estMinutes, setEstMinutes] = React.useState("")
  const [seoPropertyId, setSeoPropertyId] = React.useState("")
  // Optional on purpose: forcing a goal produces junk goals.
  const [goalId, setGoalId] = React.useState("")
  // Default yes: a wrong yes costs one skipped nudge, a wrong no loses output.
  const [producesOutput, setProducesOutput] = React.useState(true)

  // Adhoc is a sentinel, not a real project id - project-scoped fetches must skip it.
  const isAdhoc = projectId === ADHOC_ROW_ID
  const realProjectId = isAdhoc ? "" : projectId

  // Flattened to "Goal › Milestone" so a task can be filed under either.
  const { data: goalsData } = useProjectGoals(realProjectId)
  const goalOptions = React.useMemo(
    () =>
      (goalsData?.goals ?? []).flatMap((g) => [
        { id: g.id, label: g.title },
        ...g.children.map((c) => ({ id: c.id, label: `${g.title} › ${c.title}` })),
      ]),
    [goalsData],
  )

  // Only offered when the project has more than the implicit "whole project" scope.
  const { data: seoData } = useSeoSites(realProjectId)
  const sites = realProjectId ? (seoData?.properties ?? []) : []

  const { data: teamsData } = useProjectTeams(realProjectId || undefined)
  const teams = React.useMemo(() => teamsData?.data ?? [], [teamsData])

  // Mirrors the API: admins / AMs post to any team, a team manager to their team, a member only on themselves.
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ""
  const { can } = usePermissions()
  const { data: projectData } = useProject(realProjectId || undefined)
  const isProjectAdmin =
    can(PERMISSIONS.PROJECT_WRITE) || (!!userId && projectData?.data?.owner?.id === userId)

  const selectableTeams = React.useMemo(() => {
    if (isProjectAdmin) return teams
    return teams.filter(
      (t) => t.managerId === userId || t.members.some((m) => m.employeeId === userId),
    )
  }, [teams, isProjectAdmin, userId])

  const team = selectableTeams.find((t) => t.id === teamId)
  const canAssignOthers = isProjectAdmin || team?.managerId === userId
  const assignees = canAssignOthers
    ? (team?.members ?? [])
    : (team?.members ?? []).filter((m) => m.employeeId === userId)

  // Each step runs when its inputs change; the order matters when several change at once.
  const [seen, setSeen] = React.useState({
    open: false,
    defaultProjectId,
    projectId,
    teamId,
    selectableTeams,
  })
  const openChanged = open !== seen.open
  const projectChanged = projectId !== seen.projectId
  const teamChanged = teamId !== seen.teamId
  const autoPickDue = openChanged || teamChanged || selectableTeams !== seen.selectableTeams
  const resetDue = openChanged || defaultProjectId !== seen.defaultProjectId
  if (autoPickDue || resetDue || projectChanged) {
    setSeen({ open, defaultProjectId, projectId, teamId, selectableTeams })
    let nextTeamId = teamId
    // Reset on open, and clear dependent selects when the parent changes.
    const resetting = resetDue && open
    if (resetting) {
      setProjectId(defaultProjectId ?? "")
      setTeamId("")
      nextTeamId = ""
      setAssigneeId("")
      setTitle("")
      setDescription("")
      setPriority("MEDIUM")
      setDueDate("")
      setEstHours("")
      setEstMinutes("")
      setSeoPropertyId("")
      setProducesOutput(true)
    }
    if (projectChanged) {
      setTeamId("")
      setAssigneeId("")
      setSeoPropertyId("")
      nextTeamId = ""
    }
    if (teamChanged) setAssigneeId("")
    // A single team is picked automatically - last, so the resets above can't undo it. After a reset
    // to another project, that project's teams arrive on a later render and are picked then.
    const sameProject = !resetting || (defaultProjectId ?? "") === projectId
    if (open && !nextTeamId && sameProject && selectableTeams.length === 1) {
      setTeamId(selectableTeams[0]!.id)
    }
  }

  // Adhoc work has no project or team, so it goes to the plain task endpoint.
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(isAdhoc ? `/api/tasks` : `/api/projects/${projectId}/teams/${teamId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      if (realProjectId) {
        qc.invalidateQueries({ queryKey: ["team-tasks", realProjectId, teamId] })
        qc.invalidateQueries({ queryKey: ["project-all-tasks", realProjectId] })
      }
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
      // A stale goal from another project would 404.
      goalId: goalOptions.some((g) => g.id === goalId) ? goalId : undefined,
      // Adhoc work produces nothing to log.
      ...(isAdhoc ? {} : { producesOutput }),
    })
  }

  // Round to 2dp so 20 minutes stores as 0.33 rather than 0.3333333333333333.
  const rawEstimate = (Number(estHours) || 0) + (Number(estMinutes) || 0) / 60
  const estimateInHours = rawEstimate > 0 ? Math.round(rawEstimate * 100) / 100 : undefined

  const canSubmit = !!projectId && (isAdhoc || !!teamId) && !!title.trim()

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
            <Label required>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ADHOC_ROW_ID}>{ADHOC_LABEL} · no client</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdhoc && <p className="text-muted-foreground text-xs">{ADHOC_DESCRIPTION}.</p>}
          </div>
        )}

        {/* Adhoc work has no team; the line manager approves instead. */}
        {!isAdhoc && (
          <div className="space-y-2">
            <Label required>Team</Label>
            <Select value={teamId} onValueChange={setTeamId} disabled={!projectId}>
              <SelectTrigger>
                <SelectValue placeholder={projectId ? "Select a team" : "Pick a project first"} />
              </SelectTrigger>
              <SelectContent>
                {selectableTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projectId && selectableTeams.length === 0 && (
              <p className="text-muted-foreground text-xs">
                You are not on a team in this project, so there is nowhere to file a task.
              </p>
            )}
            {projectId && !isProjectAdmin && selectableTeams.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Only the {selectableTeams.length === 1 ? "team" : "teams"} you belong to.
              </p>
            )}
          </div>
        )}

        {!isAdhoc && projectId && goalOptions.length > 0 && (
          <div className="space-y-2">
            <Label>Goal</Label>
            <SearchPicker
              value={goalId || NO_GOAL}
              onChange={(v) => setGoalId(v === NO_GOAL ? "" : v)}
              noneLabel="Not tied to a goal"
              searchPlaceholder="Search goals…"
              emptyText="No goals on this project yet"
              groups={[{ label: "", options: goalOptions }]}
            />
            <p className="text-muted-foreground text-xs">
              Optional. The goal&apos;s progress moves as this task does.
            </p>
          </div>
        )}

        {sites.length > 0 && !isAdhoc && (
          <div className="space-y-2">
            <Label required>Site</Label>
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
                    {site.label} - {site.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Which of this project&apos;s {sites.length} tracked sites this work is for.
            </p>
          </div>
        )}

        {isAdhoc ? (
          <p className="text-muted-foreground text-xs">
            Raised on you. It goes to your line manager for approval.
          </p>
        ) : (
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
              {teamId && !canAssignOthers
                ? "You can only raise a task on yourself here; it goes to your team manager for approval."
                : "Assign it to yourself and it goes to your manager for approval."}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label required>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            aria-label="What needs doing?"
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Details, context, links…"
            aria-label="Details, context, links"
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

        {!isAdhoc && (
          <div className="flex items-center justify-between gap-3 rounded-sm border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="task-produces-output" className="mb-0 cursor-pointer text-sm">
                Produces output
              </Label>
              <p className="text-muted-foreground text-xs">
                A page, a video, a design - something to log when done.
              </p>
            </div>
            <Switch
              id="task-produces-output"
              checked={producesOutput}
              onCheckedChange={setProducesOutput}
            />
          </div>
        )}
      </div>
    </FormDialog>
  )
}
