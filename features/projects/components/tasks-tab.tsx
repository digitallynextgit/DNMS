"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useProjectTeams,
  useTeamTasks,
  useCreateTask,
  useApproveTask,
  useRejectTask,
  useUpdateTask,
  useDeleteTask,
  type ProjectTask,
  type ProjectTeam,
} from "@/features/projects/hooks/use-projects"
import {
  Plus,
  Check,
  X,
  AlertTriangle,
  Trash2,
  Clock,
  Milestone,
  MessageSquare,
  LayoutList,
  Kanban,
} from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/constants"
import { StatusBadge } from "@/components/shared/status-badge"
import { TaskDetailSheet } from "./task-detail-sheet"
import { KanbanView, formatHours } from "./kanban-view"

interface Props {
  projectId: string
  currentUserId: string
  isAdmin?: boolean
}

export function TasksTab({ projectId, currentUserId, isAdmin = false }: Props) {
  const { data: teamsData, isLoading: teamsLoading } = useProjectTeams(projectId)
  const teams = teamsData?.data ?? []
  const [activeTeamId, setActiveTeamId] = useState<string | "all">("all")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [showPendingOnly, setShowPendingOnly] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list")

  if (teamsLoading) return <Skeleton className="h-64 rounded" />
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
        {viewMode === "list" && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="TODO">To Do</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="IN_REVIEW">In Review</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={showPendingOnly}
                onChange={(e) => setShowPendingOnly(e.target.checked)}
              />
              Pending approval only
            </label>
          </>
        )}

        {/* View toggle */}
        <div className="ml-auto flex items-center overflow-hidden rounded border">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 rounded-none border-0 px-3"
            onClick={() => setViewMode("list")}
          >
            <LayoutList className="mr-1.5 h-3.5 w-3.5" />
            List
          </Button>
          <Button
            variant={viewMode === "kanban" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 rounded-none border-0 border-l px-3"
            onClick={() => setViewMode("kanban")}
          >
            <Kanban className="mr-1.5 h-3.5 w-3.5" />
            Board
          </Button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <KanbanView
          projectId={projectId}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          teamFilter={activeTeamId}
        />
      ) : activeTeamId === "all" ? (
        teams.map((team) => (
          <TeamTasksSection
            key={team.id}
            team={team}
            projectId={projectId}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            statusFilter={statusFilter}
            showPendingOnly={showPendingOnly}
          />
        ))
      ) : (
        (() => {
          const team = teams.find((t) => t.id === activeTeamId)
          if (!team) return null
          return (
            <TeamTasksSection
              team={team}
              projectId={projectId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              statusFilter={statusFilter}
              showPendingOnly={showPendingOnly}
            />
          )
        })()
      )}
    </div>
  )
}

function TeamTasksSection({
  team,
  projectId,
  currentUserId,
  isAdmin,
  statusFilter,
  showPendingOnly,
}: {
  team: ProjectTeam
  projectId: string
  currentUserId: string
  isAdmin: boolean
  statusFilter: string
  showPendingOnly: boolean
}) {
  const { data, isLoading } = useTeamTasks(projectId, team.id)
  const tasks = data?.data ?? []
  const isManager = team.managerId === currentUserId || isAdmin
  const isMember = team.members.some((m) => m.employeeId === currentUserId) || isAdmin
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (showPendingOnly && t.approvalStatus !== "PENDING_APPROVAL") return false
      if (!showPendingOnly && t.approvalStatus === "REJECTED") return false
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false
      return true
    })
  }, [tasks, showPendingOnly, statusFilter])

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">{team.name}</h4>
            <p className="text-muted-foreground text-xs">
              {filtered.length} task{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          {isMember && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              New Task
            </Button>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-32 rounded" />
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground py-6 text-center text-xs">
            No tasks match the filters.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isManager={isManager}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}

        <CreateTaskDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          team={team}
          projectId={projectId}
          isManager={isManager}
          currentUserId={currentUserId}
        />
      </CardContent>
    </Card>
  )
}

function TaskRow({
  task,
  isManager,
  currentUserId,
}: {
  task: ProjectTask
  isManager: boolean
  currentUserId: string
}) {
  const approve = useApproveTask()
  const reject = useRejectTask()
  const update = useUpdateTask()
  const del = useDeleteTask()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isAssignee = task.assigneeId === currentUserId
  const isPending = task.approvalStatus === "PENDING_APPROVAL"
  const isRejected = task.approvalStatus === "REJECTED"
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE"

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 rounded border p-2.5",
          isPending &&
            "border-amber-300 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20",
          isRejected && "border-red-300 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20",
          !isPending && !isRejected && "border-border",
        )}
      >
        <Select
          value={task.status}
          disabled={!isManager && !isAssignee}
          onValueChange={(v) =>
            update.mutate({ taskId: task.id, body: { status: v }, silent: true })
          }
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODO">To Do</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="IN_REVIEW">In Review</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
          </SelectContent>
        </Select>

        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setDetailOpen(true)}>
          <div className="flex items-center gap-2">
            {task.isMilestone && <Milestone className="h-3.5 w-3.5 shrink-0 text-purple-600" />}
            <p className="truncate text-sm font-medium hover:underline">{task.title}</p>
            {isPending && (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-100 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              >
                <Clock className="mr-1 inline h-3 w-3" />
                Pending approval
              </Badge>
            )}
            {isRejected && (
              <Badge
                variant="outline"
                className="border-red-200 bg-red-100 text-[10px] text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
              >
                Rejected
              </Badge>
            )}
            {isOverdue && (
              <Badge
                variant="outline"
                className="border-red-200 bg-red-50 text-[10px] text-red-700"
              >
                <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                Overdue
              </Badge>
            )}
          </div>
          {task.rejectionReason && (
            <p className="mt-0.5 text-[11px] text-red-700 dark:text-red-400">
              Reason: {task.rejectionReason}
            </p>
          )}
          <div className="text-muted-foreground mt-1 flex items-center gap-3 text-[11px]">
            <StatusBadge
              status={task.priority}
              colorMap={TASK_PRIORITY_COLORS}
              labelMap={TASK_PRIORITY_LABELS}
              size="xs"
            />
            {task.dueDate && <span>Due {formatDate(task.dueDate)}</span>}
            {task.estimatedHours != null && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {formatHours(task.estimatedHours)}
              </span>
            )}
            {task.assignee && (
              <span className="flex items-center gap-1">
                <AvatarDisplay
                  firstName={task.assignee.firstName}
                  lastName={task.assignee.lastName}
                  size="xs"
                  className="h-4 w-4"
                />
                {task.assignee.firstName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-7 w-7"
            title="Open task detail"
            onClick={() => setDetailOpen(true)}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          {isPending && isManager && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-emerald-700 dark:text-emerald-400"
                onClick={() => approve.mutate(task.id)}
              >
                <Check className="mr-0.5 h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive h-7"
                onClick={() => setRejectOpen(true)}
              >
                <X className="mr-0.5 h-3.5 w-3.5" />
                Reject
              </Button>
            </>
          )}
          {isManager && !isPending && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-7 w-7"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <RejectDialog
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          onConfirm={(reason) => {
            reject.mutate({ taskId: task.id, reason }, { onSuccess: () => setRejectOpen(false) })
          }}
        />

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete task"
          description={`Delete task "${task.title}"?`}
          confirmLabel="Delete"
          variant="destructive"
          isLoading={del.isPending}
          onConfirm={() => del.mutate(task.id, { onSuccess: () => setConfirmOpen(false) })}
        />
      </div>

      <TaskDetailSheet
        task={task}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        currentUserId={currentUserId}
        isManager={isManager}
      />
    </>
  )
}

function RejectDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState("")
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Reason</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why this task is being rejected..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={!reason.trim()}>
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateTaskDialog({
  open,
  onClose,
  team,
  projectId,
  isManager,
  currentUserId,
}: {
  open: boolean
  onClose: () => void
  team: ProjectTeam
  projectId: string
  isManager: boolean
  currentUserId: string
}) {
  // Default assignee: self if I'm a member, else the team manager, else first member
  const callerIsTeamMember = team.members.some((m) => m.employeeId === currentUserId)
  const defaultAssignee = callerIsTeamMember
    ? currentUserId
    : (team.managerId ?? team.members[0]?.employeeId ?? "")

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("MEDIUM")
  const [assigneeId, setAssigneeId] = useState(defaultAssignee)
  const [dueDate, setDueDate] = useState("")
  const [estHours, setEstHours] = useState("")
  const [estMinutes, setEstMinutes] = useState("")
  const create = useCreateTask(projectId, team.id)

  function handleCreate() {
    if (!title.trim()) return
    const hrs = parseInt(estHours || "0", 10)
    const mins = parseInt(estMinutes || "0", 10)
    const estimatedHours = hrs + mins / 60 || undefined
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeId: isManager ? assigneeId : currentUserId,
        dueDate: dueDate || undefined,
        ...(estimatedHours !== undefined && { estimatedHours }),
      },
      {
        onSuccess: () => {
          setTitle("")
          setDescription("")
          setDueDate("")
          setEstHours("")
          setEstMinutes("")
          setAssigneeId(defaultAssignee)
          onClose()
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Task - {team.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isManager && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              This will be a <strong>self-task</strong>. It needs the team manager's approval before
              becoming active.
            </div>
          )}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
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
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Time Required</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="number"
                  min="0"
                  max="999"
                  value={estHours}
                  onChange={(e) => setEstHours(e.target.value)}
                  placeholder="0"
                  className="pr-8"
                />
                <span className="text-muted-foreground absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
                  h
                </span>
              </div>
              <div className="relative flex-1">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={estMinutes}
                  onChange={(e) => setEstMinutes(e.target.value)}
                  placeholder="0"
                  className="pr-8"
                />
                <span className="text-muted-foreground absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
                  m
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            {isManager ? (
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {team.members.map((m) => (
                    <SelectItem key={m.employeeId} value={m.employeeId}>
                      {m.employee.firstName} {m.employee.lastName}
                      {m.employeeId === currentUserId && " (me)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-muted-foreground text-xs">
                Self-assigned (only the manager can assign to others)
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim() || create.isPending}>
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
