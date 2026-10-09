"use client"

import { useMemo, useState } from "react"
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
import { ACCOUNT_MANAGER_TEAM } from "@/features/projects/lib/project-teams"

// The My Tasks weekly sheet read the other way: the project is fixed and the rows are its people.

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
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const teamsInScope = useMemo(
    () => (activeTeamId === "all" ? teams : teams.filter((t) => t.id === activeTeamId)),
    [teams, activeTeamId],
  )

  /** `canPlan` mirrors the create endpoint (own row, a managed team's row, or project admin), so no cell 403s. */
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
        // Two teams are worth naming; past that, just a count.
        caption:
          teamNames.length > 2 ? `${teamNames.length} teams` : [...new Set(teamNames)].join(" · "),
      }))
      .filter((p) => assigneeFilter === "all" || p.id === assigneeFilter)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [teamsInScope, isAdmin, currentUserId, assigneeFilter])

  // Deduped by id: older data can list one person under several teams.
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
  const sheetProject = useMemo(
    () => ({
      // The URL ref, not the uuid: this page's query keys are built from it.
      id: projectId,
      name: project?.name ?? "This project",
      code: project?.code ?? "",
      slug: project?.slug ?? null,
    }),
    [projectId, project?.name, project?.code, project?.slug],
  )

  /** Teams are looked up for their manager, as the server does, so a line locks exactly when a PATCH would fail. */
  const sheetTasks = useMemo<SheetTask[]>(() => {
    const teamById = new Map(teams.map((t) => [t.id, t]))
    return (tasksData?.data ?? [])
      .filter((t) => {
        // Rejected tasks are history, not work: the sheet never shows them.
        if (t.approvalStatus === "REJECTED") return false
        if (activeTeamId !== "all" && t.teamId !== activeTeamId) return false
        if (statusFilter !== "ALL" && t.status !== statusFilter) return false
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

  // Memoised: the sheet rebuilds its rows off this.
  const axis = useMemo(
    () => ({ by: "person" as const, project: sheetProject, people }),
    [sheetProject, people],
  )

  const openTask: ProjectTask | null = useMemo(
    () => (tasksData?.data ?? []).find((t) => t.id === openTaskId) ?? null,
    [tasksData, openTaskId],
  )
  const openTaskTeam = openTask?.teamId ? teams.find((t) => t.id === openTask.teamId) : undefined

  // Narrowing the team can strand the person filter on someone outside it; reset to everyone.
  if (
    assigneeFilter !== "all" &&
    assigneeFilter !== "unassigned" &&
    !assignableMembers.some((m) => m.id === assigneeFilter)
  ) {
    setAssigneeFilter("all")
  }

  // Default the Team filter to the team the viewer manages, once on load.
  const [teamDefaulted, setTeamDefaulted] = useState(false)
  if (!teamDefaulted && teams.length > 0) {
    setTeamDefaulted(true)
    const managed = teams.filter((t) => t.managerId === currentUserId)
    // The AM team rarely holds tasks, so start on another team they run when there is one.
    const mine = managed.find((t) => t.name !== ACCOUNT_MANAGER_TEAM) ?? managed[0]
    if (mine) setActiveTeamId(mine.id)
  }

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
        <Button
          variant="outline"
          className="ml-auto gap-1.5"
          onClick={() => setRequirementOpen(true)}
        >
          <HelpCircle className="h-4 w-4" /> Raise requirement
        </Button>
        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Task
        </Button>
      </div>

      {tasksLoading ? (
        <Skeleton className="h-64 rounded-sm" />
      ) : (
        // Before any empty check: an empty week is when the grid is needed most.
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
