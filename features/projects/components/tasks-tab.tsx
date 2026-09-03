"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useProject,
  useProjectAllTasks,
  useProjectTeams,
  type ProjectTask,
} from "@/features/projects/hooks/use-projects"
import { Plus, HelpCircle } from "lucide-react"
import { TaskCreateDialog } from "@/features/projects/components/task-create-dialog"
import { RequirementDialog } from "@/features/projects/components/requirement-dialog"
import { TaskDetailSheet } from "@/features/projects/components/task-detail-sheet"
import {
  TasksSheetView,
  type SheetPerson,
  type SheetTask,
} from "@/features/projects/components/tasks-sheet-view"
import { TASK_STATUS_LABELS, TASK_WORKFLOW_STATUSES } from "@/lib/constants"

// =============================================================================
// A project's TASKS tab: the same weekly allocation sheet as My Tasks, read
// down the other axis.
//
// My Tasks is one person's week across their clients. Here the client is fixed
// and the rows are the PEOPLE on it, so a manager sees the whole account's week
// - who is doing what, on which day, with the hours - in the shape the team
// already plans in. The board this replaced could only say which pile a task
// was in, never when it was meant to happen or what it cost.
// =============================================================================

interface Props {
  projectId: string
  currentUserId: string
  isAdmin?: boolean
}

export function TasksTab({ projectId, currentUserId, isAdmin = false }: Props) {
  const { data: teamsData, isLoading: teamsLoading } = useProjectTeams(projectId)
  const teams = useMemo(() => teamsData?.data ?? [], [teamsData])
  // Already in the cache - the project page fetched it to render this tab.
  const { data: projectData } = useProject(projectId)
  const { data: tasksData, isLoading: tasksLoading } = useProjectAllTasks(projectId)

  const [activeTeamId, setActiveTeamId] = useState<string | "all">("all")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [requirementOpen, setRequirementOpen] = useState(false)
  /** The task whose full record is open - comments, checklist, files. */
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const teamsInScope = useMemo(
    () => (activeTeamId === "all" ? teams : teams.filter((t) => t.id === activeTeamId)),
    [teams, activeTeamId],
  )

  /**
   * The rows: everyone on the project, or on the chosen team.
   *
   * `canPlan` mirrors what the create endpoint allows, so the sheet never opens
   * a cell whose contents would come back 403: your own row, a row on a team you
   * manage, or anybody's if you administer the project. Everyone else's row
   * still SHOWS their week - it just cannot be typed into.
   */
  const people = useMemo<SheetPerson[]>(() => {
    const byId = new Map<string, { person: SheetPerson; teamNames: string[] }>()
    for (const team of teamsInScope) {
      const managed = isAdmin || team.managerId === currentUserId
      for (const m of team.members) {
        const existing = byId.get(m.employeeId)
        if (existing) {
          existing.teamNames.push(team.name)
          existing.person.canPlan = existing.person.canPlan || managed
          continue
        }
        byId.set(m.employeeId, {
          person: {
            id: m.employeeId,
            name: `${m.employee.firstName} ${m.employee.lastName}`.trim(),
            canPlan: managed || m.employeeId === currentUserId,
          },
          teamNames: [team.name],
        })
      }
    }
    return [...byId.values()]
      .map(({ person, teamNames }) => ({
        ...person,
        // Which hat they are wearing here. Two teams is common and worth saying;
        // the full list is not, so past that it is just a count.
        caption:
          teamNames.length > 2 ? `${teamNames.length} teams` : [...new Set(teamNames)].join(" · "),
      }))
      .filter((p) => assigneeFilter === "all" || p.id === assigneeFilter)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [teamsInScope, isAdmin, currentUserId, assigneeFilter])

  // Who the Employee picker offers: the chosen team's members, or everyone on
  // the project when no team is chosen. Deduped by id because one person can
  // (in older data) appear under more than one team.
  const assignableMembers = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>()
    for (const team of teamsInScope) {
      for (const m of team.members) {
        byId.set(m.employeeId, {
          id: m.employeeId,
          name: `${m.employee.firstName} ${m.employee.lastName}`.trim(),
        })
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [teamsInScope])

  const project = projectData?.data
  /** What the sheet files new work against, and what its rows are titled with. */
  const sheetProject = useMemo(
    () => ({
      // The ref from the URL, not the resolved uuid: every query key on this
      // page is built from it, and the sheet invalidates those by hand.
      id: projectId,
      name: project?.name ?? "This project",
      code: project?.code ?? "",
      slug: project?.slug ?? null,
    }),
    [projectId, project?.name, project?.code, project?.slug],
  )

  /**
   * The week's work, in the shape the sheet reads.
   *
   * The team is looked up rather than sent: the API returns a task's teamId, and
   * the sheet needs the team's MANAGER to know who may edit each line. Same
   * resolution the server does, so a line is locked here exactly when a PATCH
   * would be refused.
   */
  const sheetTasks = useMemo<SheetTask[]>(() => {
    const teamById = new Map(teams.map((t) => [t.id, t]))
    return (tasksData?.data ?? [])
      .filter((t) => {
        // Rejected tasks are history, not work: the sheet never shows them.
        if (t.approvalStatus === "REJECTED") return false
        if (activeTeamId !== "all" && t.teamId !== activeTeamId) return false
        if (statusFilter !== "ALL" && t.status !== statusFilter) return false
        // "unassigned" is a real answer to "whose work is this", not a missing
        // value - a task nobody owns is exactly what a manager goes looking for.
        if (assigneeFilter === "unassigned" && t.assigneeId) return false
        if (
          assigneeFilter !== "all" &&
          assigneeFilter !== "unassigned" &&
          t.assigneeId !== assigneeFilter
        )
          return false
        return true
      })
      .map((t) => {
        const team = t.teamId ? teamById.get(t.teamId) : undefined
        return {
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          dueDate: t.dueDate,
          estimatedHours: t.estimatedHours,
          loggedHours: t.loggedHours,
          links: t.links ?? [],
          inProgressSince: t.inProgressSince,
          approvalStatus: t.approvalStatus,
          creatorId: t.creatorId,
          createdAt: t.createdAt,
          project: sheetProject,
          team: team ? { id: team.id, name: team.name, managerId: team.managerId } : null,
          assignee: t.assignee
            ? {
                id: t.assignee.id,
                firstName: t.assignee.firstName,
                lastName: t.assignee.lastName,
              }
            : null,
        }
      })
  }, [tasksData, teams, activeTeamId, statusFilter, assigneeFilter, sheetProject])

  // Held steady: the sheet rebuilds its rows (and re-reads who is away) off
  // this, so handing it a fresh object on every render would redo that work for
  // nothing.
  const axis = useMemo(
    () => ({ by: "person" as const, project: sheetProject, people }),
    [sheetProject, people],
  )

  const openTask: ProjectTask | null = useMemo(
    () => (tasksData?.data ?? []).find((t) => t.id === openTaskId) ?? null,
    [tasksData, openTaskId],
  )
  const openTaskTeam = openTask?.teamId ? teams.find((t) => t.id === openTask.teamId) : undefined

  // Narrowing the team can strand a selection on someone who is not in it, which
  // would silently show an empty sheet. Drop back to "everyone" instead.
  useEffect(() => {
    if (assigneeFilter === "all" || assigneeFilter === "unassigned") return
    if (!assignableMembers.some((m) => m.id === assigneeFilter)) setAssigneeFilter("all")
  }, [assignableMembers, assigneeFilter])

  // Default the Team filter to the team the viewer manages (once, on load) - a
  // manager lands straight on their own team's week.
  const initedRef = useRef(false)
  useEffect(() => {
    if (initedRef.current || teams.length === 0) return
    initedRef.current = true
    const mine = teams.find((t) => t.managerId === currentUserId)
    if (mine) setActiveTeamId(mine.id)
  }, [teams, currentUserId])

  if (teamsLoading) return <Skeleton className="h-64 rounded-sm" />
  if (teams.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-muted-foreground py-12 text-center text-sm">
          Add a team to this project first to start creating tasks.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Team</Label>
          <Select value={activeTeamId} onValueChange={(v) => setActiveTeamId(v)}>
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Employee</Label>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {assignableMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {TASK_WORKFLOW_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABELS[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Second entry point for requirements: you notice the blocker while
            looking at the week, not while browsing a separate tab. */}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto gap-1.5"
          onClick={() => setRequirementOpen(true)}
        >
          <HelpCircle className="h-4 w-4" /> Raise requirement
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Task
        </Button>
      </div>

      {tasksLoading ? (
        <Skeleton className="h-64 rounded-sm" />
      ) : (
        // Before any empty check: an empty week is exactly when the grid is
        // wanted, because the blank cells are what the plan gets typed into.
        <TasksSheetView
          tasks={sheetTasks}
          axis={axis}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onOpenTask={(t) => setOpenTaskId(t.id)}
        />
      )}

      <TaskDetailSheet
        task={openTask}
        open={!!openTask}
        onClose={() => setOpenTaskId(null)}
        currentUserId={currentUserId}
        isManager={isAdmin || openTaskTeam?.managerId === currentUserId}
      />

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectId={projectId}
        lockProject
      />

      <RequirementDialog
        open={requirementOpen}
        onOpenChange={setRequirementOpen}
        projectId={projectId}
      />
    </div>
  )
}
