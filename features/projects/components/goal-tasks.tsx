"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Link2, ListChecks, PackageCheck, TriangleAlert, Unlink } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateField } from "@/components/shared/date-field"
import { StatusBadge } from "@/components/shared/status-badge"
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/constants"
import { ACCOUNT_MANAGER_TEAM } from "../lib/project-teams"
import { useAssignableEmployees, useUpdateTask } from "../hooks/use-projects"
import { useTaskList } from "./progress-task-list"
import type { GoalNode } from "./goal-status"

export interface StaffableTeam {
  id: string
  name: string
}

const NONE = "__none__"

/** Every read that shows a goal's tasks or a task's goal. */
export function useInvalidateGoalWork(projectId: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["project-goals", projectId] })
    qc.invalidateQueries({ queryKey: ["goals-portfolio"] })
    qc.invalidateQueries({ queryKey: ["progress-tasks"] })
    qc.invalidateQueries({ queryKey: ["project-tasks", projectId] })
    qc.invalidateQueries({ queryKey: ["team-tasks", projectId] })
    qc.invalidateQueries({ queryKey: ["my-tasks"] })
  }
}

function LinkTasksDialog({
  projectId,
  goal,
  open,
  onOpenChange,
}: {
  projectId: string
  goal: GoalNode
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data, isLoading } = useTaskList({ projectId, unlinked: true, state: "open" }, open)
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set())
  const invalidate = useInvalidateGoalWork(projectId)
  const link = useMutation({
    mutationFn: (taskIds: string[]) =>
      apiFetch<{ data: { linked: number } }>(`/api/projects/${projectId}/goals/${goal.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      }).then((r) => r.data),
    onSuccess: (r) => {
      invalidate()
      toast.success(`${r.linked} task${r.linked === 1 ? "" : "s"} linked to "${goal.title}"`)
      setPicked(new Set())
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const rows = data?.data ?? []
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link tasks to &ldquo;{goal.title}&rdquo;</DialogTitle>
          <DialogDescription>
            Open tasks on this project that serve no goal yet. Tick the ones that belong here.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Every open task on this project already serves a goal.
          </p>
        ) : (
          <ul className="divide-border/60 max-h-[50vh] divide-y overflow-y-auto rounded-sm border">
            {rows.map((t) => (
              <li key={t.id}>
                <label className="hover:bg-muted/40 flex cursor-pointer items-center gap-3 px-3 py-2 text-xs">
                  <Checkbox checked={picked.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.title}</span>
                    <span className="text-muted-foreground">
                      {t.assignee?.name ?? "Unassigned"}
                      {t.team ? ` · ${t.team.name}` : ""}
                      {t.dueDate ? ` · due ${formatDate(t.dueDate)}` : ""}
                    </span>
                  </span>
                  <StatusBadge
                    status={t.status}
                    colorMap={TASK_STATUS_COLORS}
                    labelMap={TASK_STATUS_LABELS}
                    size="xs"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={picked.size === 0 || link.isPending}
            onClick={() => link.mutate([...picked])}
          >
            Link {picked.size > 0 ? picked.size : ""} {picked.size === 1 ? "task" : "tasks"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Asks for the team and "produces output" explicitly rather than guessing them from the project. */
function AddTaskForm({
  projectId,
  goal,
  teams,
  onDone,
}: {
  projectId: string
  goal: GoalNode
  /** Teams this person may staff into. Empty = no picker, server decides. */
  teams: StaffableTeam[]
  onDone: () => void
}) {
  const [title, setTitle] = React.useState("")
  const [assigneeId, setAssigneeId] = React.useState(NONE)
  const [dueDate, setDueDate] = React.useState(goal.targetDate ?? "")
  const [hours, setHours] = React.useState("")
  // A team is required (blank is a 400); skip AM, which rarely holds the work, when there's another.
  const [teamId, setTeamId] = React.useState(
    () => (teams.find((t) => t.name !== ACCOUNT_MANAGER_TEAM) ?? teams[0])?.id ?? NONE,
  )
  const [producesOutput, setProducesOutput] = React.useState(true)
  const people = useAssignableEmployees(projectId)
  const invalidate = useInvalidateGoalWork(projectId)
  const create = useMutation({
    mutationFn: () =>
      apiFetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          assigneeId: assigneeId === NONE ? null : assigneeId,
          dueDate: dueDate || null,
          estimatedHours: hours ? Number(hours) : null,
          goalId: goal.id,
          teamId: teamId === NONE ? null : teamId,
          producesOutput,
        }),
      }),
    onSuccess: () => {
      invalidate()
      toast.success("Task added under this goal")
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && title.trim() && create.mutate()}
        placeholder="What needs doing for this goal?"
        aria-label="Task title"
        className="min-w-56 flex-1"
        maxLength={200}
      />
      <Select value={assigneeId} onValueChange={setAssigneeId}>
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder="Assign to" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Unassigned</SelectItem>
          {(people.data?.data ?? []).map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {teams.length > 0 && (
        <Select value={teamId} onValueChange={setTeamId}>
          <SelectTrigger className="h-9 w-40" aria-label="Team">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No team</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <DateField value={dueDate} onChange={setDueDate} placeholder="Due" className="w-40" />
      <Input
        type="number"
        min={0}
        step={0.5}
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        placeholder="Hours"
        aria-label="Estimated hours"
        className="w-24"
      />
      {/* On by default: most goal work produces what the goal promised. */}
      <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-[11px]">
        <Checkbox
          checked={producesOutput}
          onCheckedChange={(c) => setProducesOutput(c === true)}
          aria-label="Produces output"
        />
        Produces output
      </label>
      <Button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending}>
        Add
      </Button>
      <Button variant="ghost" onClick={onDone}>
        Cancel
      </Button>
    </div>
  )
}

/** `canStaff`, not `canManage`: team managers may staff goals too; targets stay manage-only (as on the server). */
export function GoalTasks({
  projectId,
  goal,
  canStaff,
  teams = [],
  compact = false,
  adding: addingProp,
  onAddingChange,
  linking: linkingProp,
  onLinkingChange,
}: {
  projectId: string
  goal: GoalNode
  canStaff: boolean
  teams?: StaffableTeam[]
  compact?: boolean
  /** Controlled add/link state, owned by the goal card (which offers those buttons once). */
  adding?: boolean
  onAddingChange?: (v: boolean) => void
  linking?: boolean
  onLinkingChange?: (v: boolean) => void
}) {
  const [addingSelf, setAddingSelf] = React.useState(false)
  const [linkingSelf, setLinkingSelf] = React.useState(false)
  const adding = addingProp ?? addingSelf
  const setAdding = onAddingChange ?? setAddingSelf
  const linking = linkingProp ?? linkingSelf
  const setLinking = onLinkingChange ?? setLinkingSelf
  const controlled = addingProp !== undefined || linkingProp !== undefined
  const invalidate = useInvalidateGoalWork(projectId)
  const updateTask = useUpdateTask()
  const tasks = goal.tasks

  if (tasks.length === 0 && (!canStaff || (controlled && !adding && !linking))) return null

  return (
    <div
      className={cn(
        "border-border/60 border-t",
        compact ? "bg-muted/20 px-4 py-2 pl-10 sm:pl-12" : "bg-muted/10 px-4 py-2.5 sm:px-5",
      )}
    >
      {tasks.length > 0 && (
        <div className="mb-1.5 flex items-center gap-2 text-[11px]">
          <ListChecks className="text-muted-foreground h-3 w-3" />
          <span className="font-medium">
            {goal.doneTasks} of {goal.countableTasks} tasks done
          </span>
          {goal.hoursProgress !== null && (
            <span
              className="text-muted-foreground tabular-nums"
              title="Done estimated hours over estimated hours"
            >
              {goal.hoursProgress}% by hours
            </span>
          )}
          {goal.outputCount > 0 && (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <PackageCheck className="h-3 w-3" /> {goal.outputCount} output
              {goal.outputCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
      {tasks.length > 0 && (
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              <StatusBadge
                status={t.status}
                colorMap={TASK_STATUS_COLORS}
                labelMap={TASK_STATUS_LABELS}
                size="xs"
                className="w-20 justify-center"
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  t.status === "DONE" && "text-muted-foreground",
                )}
              >
                {t.title}
              </span>
              {t.assigneeName && <span className="text-muted-foreground">{t.assigneeName}</span>}
              {t.dueDate && (
                <span
                  className={cn(
                    "tabular-nums",
                    t.overdue ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {t.overdue && <TriangleAlert className="mr-0.5 inline h-3 w-3" />}
                  {formatDate(t.dueDate)}
                </span>
              )}
              {t.outputs > 0 && (
                <span className="text-muted-foreground inline-flex items-center gap-0.5">
                  <PackageCheck className="h-3 w-3" /> {t.outputs}
                </span>
              )}
              {/* "Not logged yet" (chase it) and "nothing to log" (leave it) get different weights. */}
              {t.status === "DONE" &&
                t.producesOutput &&
                t.outputs === 0 &&
                (t.outputSkipped ? (
                  <span className="text-muted-foreground">nothing to log</span>
                ) : (
                  <span className="text-amber-500">no output logged</span>
                ))}
              {canStaff && goal.isActive && (
                <button
                  type="button"
                  onClick={() =>
                    updateTask.mutate(
                      { taskId: t.id, body: { goalId: null }, silent: true },
                      {
                        onSuccess: () => {
                          invalidate()
                          toast.success(`"${t.title}" no longer serves this goal`)
                        },
                        onError: (e: Error) => toast.error(e.message),
                      },
                    )
                  }
                  disabled={updateTask.isPending}
                  aria-label={`Unlink ${t.title} from this goal`}
                  title="Unlink from this goal - the task itself is untouched"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Unlink className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canStaff && goal.isActive && (
        <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add a task</DialogTitle>
              <DialogDescription>
                Work that serves &ldquo;{goal.title}&rdquo;. It is linked to the goal from the
                moment it exists, so the goal&rsquo;s progress counts it.
              </DialogDescription>
            </DialogHeader>
            <AddTaskForm
              projectId={projectId}
              goal={goal}
              teams={teams}
              onDone={() => setAdding(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {canStaff && goal.isActive && !controlled && (
        <div className={cn(tasks.length > 0 && "mt-2")}>
          {adding ? null : (
            <div className="flex flex-wrap gap-1">
              <Button
                variant="ghost"
                className="text-muted-foreground gap-1"
                onClick={() => setAdding(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Add task
              </Button>
              <Button
                variant="ghost"
                className="text-muted-foreground gap-1"
                onClick={() => setLinking(true)}
              >
                <Link2 className="h-3.5 w-3.5" /> Link tasks
              </Button>
            </div>
          )}
        </div>
      )}

      {canStaff && (
        <LinkTasksDialog
          projectId={projectId}
          goal={goal}
          open={linking}
          onOpenChange={setLinking}
        />
      )}
    </div>
  )
}
