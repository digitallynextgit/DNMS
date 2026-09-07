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
  // WHY this work exists. Optional: forcing a goal here produces junk goals to
  // satisfy the form; an unlinked task is shown to the manager instead.
  const [goalId, setGoalId] = React.useState("")
  // Is there supposed to be a THING at the end of this? Default yes, because a
  // wrong yes costs one nudge somebody skips and a wrong no costs output that
  // never gets counted.
  const [producesOutput, setProducesOutput] = React.useState(true)

  // Adhoc is a sentinel, not a real project id - every project-scoped fetch
  // below has to be told so, or each one fires a request for "__adhoc__".
  const isAdhoc = projectId === ADHOC_ROW_ID
  const realProjectId = isAdhoc ? "" : projectId

  // The project's goals, flattened to "Goal › Milestone" so a task can be filed
  // under either. Fetched only once a real project is picked.
  const { data: goalsData } = useProjectGoals(realProjectId)
  const goalOptions = React.useMemo(
    () =>
      (goalsData?.goals ?? []).flatMap((g) => [
        { id: g.id, label: g.title },
        ...g.children.map((c) => ({ id: c.id, label: `${g.title} › ${c.title}` })),
      ]),
    [goalsData],
  )

  // Sites tracked under this project. Only offered when the project actually has
  // more than the implicit "whole project" scope.
  const { data: seoData } = useSeoSites(realProjectId)
  const sites = realProjectId ? (seoData?.properties ?? []) : []

  const { data: teamsData } = useProjectTeams(realProjectId || undefined)
  const teams = React.useMemo(() => teamsData?.data ?? [], [teamsData])

  // ── Who may this person allocate work to? ────────────────────────────────
  // Mirrors the rules the API enforces on POST .../teams/[teamId]/tasks:
  //   • a project admin / Account Manager may post to any team,
  //   • a team MANAGER may post to their team and assign anyone in it,
  //   • a plain member may only raise a task on themselves (which then goes for
  //     manager approval).
  // Offering more than that just produced a 403 after the form was filled in.
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

  // One team to choose from is not a choice - pick it so the form is usable in
  // one less click (a team manager's normal case).
  React.useEffect(() => {
    if (open && !teamId && selectableTeams.length === 1) setTeamId(selectableTeams[0]!.id)
  }, [open, teamId, selectableTeams])

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
      setProducesOutput(true)
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

  // Adhoc work belongs to no client, so it has no project and no team to file
  // under - it goes to the plain task endpoint instead of a team's.
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(isAdhoc ? `/api/tasks` : `/api/projects/${projectId}/teams/${teamId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      // Adhoc work is on no project board, so there is nothing else to refresh.
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
      // Only a goal from the project currently picked - a stale choice after
      // switching project would 404.
      goalId: goalOptions.some((g) => g.id === goalId) ? goalId : undefined,
      // Adhoc work produces nothing to log by definition - a meeting is not a
      // deliverable - and the endpoint it goes to says so itself.
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
            <Label>
              Project<span className="text-destructive"> *</span>
            </Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {/* Not a client, so it sits apart from the account list. */}
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

        {/* Adhoc work has no team - there is nothing to pick, and the line
            manager stands in for the team manager on approval. */}
        {!isAdhoc && (
          <div className="space-y-2">
            <Label>
              Team<span className="text-destructive"> *</span>
            </Label>
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

        {/* Adhoc work has no team to pick an assignee from, so it is raised on
            yourself - which is what a meeting or an interview is. */}
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
          <Label>
            Title<span className="text-destructive"> *</span>
          </Label>
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

        {/* Adhoc work is a meeting or an interview - there is nothing at the end
            of it to point at, so the question is not asked. */}
        {!isAdhoc && (
          <div className="flex items-center justify-between gap-3 rounded-sm border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="task-produces-output" className="mb-0 cursor-pointer text-sm">
                Produces output
              </Label>
              <p className="text-muted-foreground text-xs">
                A page, a video, a design — something to log when done.
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
