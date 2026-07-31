"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { useUrlPage } from "@/hooks/use-url-state"
import { useUpdateEffect } from "@/hooks/use-update-effect"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Link from "next/link"
import { AlertTriangle, Clock, GripVertical, Inbox } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatStrip } from "@/components/shared/stat-strip"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TASK_STATUS_LABELS,
  TASK_WORKFLOW_STATUSES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
} from "@/lib/constants"
import { formatDate, cn } from "@/lib/utils"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"
import { TaskStatusSelect } from "@/features/projects/components/task-status-select"
import { TaskStatusReasonDialog } from "@/features/projects/components/task-status-reason-dialog"
import { TaskCreateDialog } from "@/features/projects/components/task-create-dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface MyTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  loggedHours: number
  estimatedHours: number | null
  approvalStatus: "APPROVED" | "PENDING_APPROVAL" | "REJECTED"
  rejectionReason: string | null
  project: { id: string; name: string; code: string }
  team?: { id: string; name: string } | null
}

async function fetchMyTasks(): Promise<{ data: MyTask[] }> {
  const res = await fetch("/api/tasks?mine=true")
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

async function updateTask(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

const PAGE_SIZE = 10

export default function MyTasksPage() {
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useUrlPage()
  const [viewMode, setViewMode] = useViewMode("my-tasks")
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ["my-tasks"], queryFn: fetchMyTasks })

  const [createOpen, setCreateOpen] = useState(false)
  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => updateTask(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      toast.success("Task updated")
    },
    onError: () => toast.error("Failed to update"),
  })

  // Full filtered list - drives summary stats, the pending-approval callout,
  // and the total used for pagination metadata.
  const tasks = useMemo(() => {
    return (data?.data ?? []).filter((t) => statusFilter === "all" || t.status === statusFilter)
  }, [data, statusFilter])

  // Reset to the first page whenever the status filter changes (skips mount so a
  // deep-linked ?page=N survives first render).
  useUpdateEffect(() => {
    setPage(1)
  }, [statusFilter])

  const total = tasks.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Clamp the page if the filtered list shrinks below the current page.
  useEffect(() => {
    if (!isLoading && page > totalPages) setPage(totalPages)
  }, [page, totalPages, isLoading])

  // Only the current page of tasks is rendered (table rows / grouped cards).
  const pageTasks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return tasks.slice(start, start + PAGE_SIZE)
  }, [tasks, page])

  // Group the current page by project → team
  const grouped = useMemo(() => {
    const groups: Record<string, { project: MyTask["project"]; tasks: MyTask[] }> = {}
    pageTasks.forEach((t) => {
      const key = t.project.id
      if (!groups[key]) groups[key] = { project: t.project, tasks: [] }
      groups[key].tasks.push(t)
    })
    return Object.values(groups)
  }, [pageTasks])

  const pendingApproval = tasks.filter((t) => t.approvalStatus === "PENDING_APPROVAL")
  const doneCount = tasks.filter((t) => t.status === "DONE").length
  const overdueCount = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE",
  ).length

  const columns: DataTableColumn<MyTask>[] = [
    {
      header: "Status",
      headClassName: "w-32",
      cell: (task) => (
        <TaskStatusSelect
          value={task.status}
          disabled={
            task.approvalStatus === "PENDING_APPROVAL" || task.approvalStatus === "REJECTED"
          }
          triggerClassName="h-7 w-32 text-xs"
          onCommit={(payload) => updateMut.mutate({ id: task.id, ...payload })}
        />
      ),
    },
    {
      header: "Task",
      cell: (task) => {
        const isOverdue =
          task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE"
        const isPending = task.approvalStatus === "PENDING_APPROVAL"
        const isRejected = task.approvalStatus === "REJECTED"
        return (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{task.title}</p>
              {isPending && (
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                >
                  <Clock className="mr-0.5 inline h-3 w-3" />
                  Pending
                </Badge>
              )}
              {isRejected && (
                <Badge variant="outline" className="bg-red-100 text-[10px] text-red-700">
                  Rejected
                </Badge>
              )}
              {isOverdue && (
                <Badge variant="outline" className="bg-red-50 text-[10px] text-red-700">
                  <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                  Overdue
                </Badge>
              )}
            </div>
            {task.rejectionReason && (
              <p className="mt-0.5 text-[11px] text-red-700">Reason: {task.rejectionReason}</p>
            )}
          </>
        )
      },
    },
    {
      header: "Project",
      cell: (task) => (
        <Link href={`/projects/${task.project.id}`} className="text-xs hover:underline">
          {task.project.name}
        </Link>
      ),
    },
    {
      header: "Team",
      className: "text-muted-foreground text-xs",
      cell: (task) => task.team?.name ?? "-",
    },
    {
      header: "Priority",
      cell: (task) => (
        <StatusBadge
          status={task.priority}
          colorMap={TASK_PRIORITY_COLORS}
          labelMap={TASK_PRIORITY_LABELS}
          size="xs"
        />
      ),
    },
    {
      header: "Due",
      className: "text-muted-foreground text-xs whitespace-nowrap",
      cell: (task) => (task.dueDate ? formatDate(task.dueDate) : "-"),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tasks"
        description="Tasks assigned to you across all projects."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Task
          </Button>
        }
      />
      <TaskCreateDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Summary strip */}
      <StatStrip
        items={[
          { label: "Total", value: tasks.length },
          {
            label: "Done",
            value: doneCount,
            tone: doneCount > 0 ? "success" : "default",
          },
          {
            label: "Pending approval",
            value: pendingApproval.length,
            tone: pendingApproval.length > 0 ? "warning" : "default",
          },
          {
            label: "Overdue",
            value: overdueCount,
            tone: overdueCount > 0 ? "danger" : "default",
          },
        ]}
      />

      {/* Pending approval callout */}
      {pendingApproval.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              <p className="text-sm font-medium">
                Awaiting manager approval ({pendingApproval.length})
              </p>
            </div>
            <ul className="text-muted-foreground space-y-1 text-xs">
              {pendingApproval.map((t) => (
                <li key={t.id}>
                  · <span className="text-foreground">{t.title}</span> - {t.project.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Filter + view toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {TASK_WORKFLOW_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABELS[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} showKanban />
      </div>

      {/* Groups or table */}
      {isLoading ? (
        <Skeleton className="h-64 rounded" />
      ) : tasks.length === 0 ? (
        <EmptyState icon={Inbox} variant="card" title="No tasks match the filter." />
      ) : viewMode === "kanban" ? (
        <MyTasksBoard
          tasks={tasks}
          onCommit={(id, payload) => updateMut.mutate({ id, ...payload })}
        />
      ) : viewMode === "table" ? (
        <DataTable
          columns={columns}
          rows={pageTasks}
          rowKey={(task) => task.id}
          showSerial
          serialOffset={(page - 1) * PAGE_SIZE}
          pagination={{
            page,
            totalPages,
            total,
            onPageChange: setPage,
            itemLabel: "task",
          }}
        />
      ) : (
        grouped.map(({ project, tasks }) => (
          <Card key={project.id}>
            <CardContent className="p-4">
              <Link
                href={`/projects/${project.id}`}
                className="mb-3 inline-block text-sm font-semibold hover:underline"
              >
                {project.name}{" "}
                <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                  {project.code}
                </Badge>
              </Link>
              <div className="space-y-2">
                {tasks.map((task) => {
                  const isOverdue =
                    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE"
                  const isPending = task.approvalStatus === "PENDING_APPROVAL"
                  const isRejected = task.approvalStatus === "REJECTED"

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center gap-3 rounded border p-2.5",
                        isOverdue &&
                          "border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20",
                        isPending &&
                          "border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20",
                        isRejected && "border-red-200 bg-red-50/40",
                        !isOverdue && !isPending && !isRejected && "border-border",
                      )}
                    >
                      <TaskStatusSelect
                        value={task.status}
                        disabled={isPending || isRejected}
                        triggerClassName="h-8 w-32 text-xs"
                        onCommit={(payload) => updateMut.mutate({ id: task.id, ...payload })}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{task.title}</p>
                          {isPending && (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                            >
                              <Clock className="mr-0.5 inline h-3 w-3" />
                              Pending
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge
                              variant="outline"
                              className="border-red-200 bg-red-100 text-[10px] text-red-700"
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
                          <p className="mt-0.5 text-[11px] text-red-700">
                            Reason: {task.rejectionReason}
                          </p>
                        )}
                        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[11px]">
                          {task.team && <span>{task.team.name}</span>}
                          {task.team && (task.dueDate || task.priority) && <span>·</span>}
                          <StatusBadge
                            status={task.priority}
                            colorMap={TASK_PRIORITY_COLORS}
                            labelMap={TASK_PRIORITY_LABELS}
                            size="xs"
                          />
                          {task.dueDate && <span>Due {formatDate(task.dueDate)}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Pagination - the table view renders its own inside <DataTable />. */}
      {!isLoading && total > 0 && !(viewMode === "table" && grouped.length > 0) && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          itemLabel="task"
        />
      )}
    </div>
  )
}

/** Colour per column, matching the project board so the two read the same. */
const BOARD_COLUMNS: Record<string, string> = {
  TODO: "bg-slate-100 dark:bg-slate-800/50",
  IN_PROGRESS: "bg-blue-50 dark:bg-blue-950/30",
  DONE: "bg-emerald-50 dark:bg-emerald-950/30",
  ON_HOLD: "bg-amber-50 dark:bg-amber-950/30",
  DISCARDED: "bg-red-50 dark:bg-red-950/30",
}

/**
 * Kanban board of the current user's tasks, grouped by workflow status.
 *
 * Drag a card between columns to change its status, the same interaction the
 * project board uses. Moving to On Hold or Discarded pauses for the required
 * reason before committing, so a drag can never write an incomplete record.
 *
 * The status dropdown stays on every card: dragging is not reachable by keyboard
 * for every user, and it is the only way to change status on a touch device
 * where the board scrolls horizontally.
 */
function MyTasksBoard({
  tasks,
  onCommit,
}: {
  tasks: MyTask[]
  onCommit: (id: string, payload: Record<string, unknown>) => void
}) {
  const qc = useQueryClient()
  // A drag onto On Hold / Discarded waits here while the reason is collected.
  const [pendingDrag, setPendingDrag] = useState<{
    taskId: string
    mode: "ON_HOLD" | "DISCARDED"
  } | null>(null)

  /** Move the card immediately, then persist. The board would otherwise snap
   *  back to the old column until the request returned. */
  function commit(taskId: string, payload: Record<string, unknown>) {
    qc.setQueryData(["my-tasks"], (old: { data: MyTask[] } | undefined) =>
      old
        ? {
            ...old,
            data: old.data.map((t) =>
              t.id === taskId ? { ...t, status: payload.status as string } : t,
            ),
          }
        : old,
    )
    onCommit(taskId, payload)
  }

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result
    if (!destination || destination.droppableId === source.droppableId) return

    const next = destination.droppableId
    if (next === "ON_HOLD" || next === "DISCARDED") {
      setPendingDrag({ taskId: draggableId, mode: next })
      return
    }
    commit(draggableId, { status: next })
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {TASK_WORKFLOW_STATUSES.map((status) => {
            const col = tasks.filter((t) => t.status === status)
            return (
              <div key={status} className="flex w-72 shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold tracking-wide uppercase">
                    {TASK_STATUS_LABELS[status] ?? status}
                  </span>
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    {col.length}
                  </Badge>
                </div>

                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "min-h-32 flex-1 space-y-2 rounded p-2 transition-colors",
                        BOARD_COLUMNS[status] ?? "bg-muted/40",
                        snapshot.isDraggingOver && "ring-primary/50 ring-2",
                      )}
                    >
                      {col.map((task, index) => {
                        const locked =
                          task.approvalStatus === "PENDING_APPROVAL" ||
                          task.approvalStatus === "REJECTED"
                        const isOverdue =
                          task.dueDate &&
                          new Date(task.dueDate) < new Date() &&
                          task.status !== "DONE"

                        return (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                            // A task awaiting approval or already rejected must not
                            // be moved by dragging past the approval gate.
                            isDragDisabled={locked}
                          >
                            {(drag, snap) => (
                              <div
                                ref={drag.innerRef}
                                {...drag.draggableProps}
                                style={drag.draggableProps.style as CSSProperties}
                                className={cn(
                                  "bg-card space-y-2 rounded border p-2.5 shadow-sm transition-shadow",
                                  !locked && "hover:border-primary/40 hover:shadow-md",
                                  snap.isDragging && "ring-primary/50 rotate-1 shadow-lg ring-2",
                                  locked && "opacity-70",
                                  isOverdue && "border-red-300 dark:border-red-900/60",
                                )}
                              >
                                <div className="flex items-start gap-1.5">
                                  <span
                                    {...drag.dragHandleProps}
                                    aria-label={locked ? "Locked" : `Drag ${task.title}`}
                                    className={cn(
                                      "mt-0.5 shrink-0",
                                      locked
                                        ? "cursor-not-allowed"
                                        : "text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing",
                                    )}
                                  >
                                    <GripVertical className="h-3.5 w-3.5" />
                                  </span>
                                  {/* Full title, wrapped rather than clipped. A task
                                      you cannot read is a task you cannot action. */}
                                  <p className="min-w-0 flex-1 text-sm leading-snug font-medium break-words">
                                    {task.title}
                                  </p>
                                </div>

                                <Link
                                  href={`/projects/${task.project.id}`}
                                  className="text-muted-foreground block truncate pl-5 text-xs hover:underline"
                                  title={task.project.name}
                                >
                                  {task.project.name}
                                </Link>

                                <div className="flex flex-wrap items-center gap-1.5 pl-5">
                                  <StatusBadge
                                    status={task.priority}
                                    colorMap={TASK_PRIORITY_COLORS}
                                    labelMap={TASK_PRIORITY_LABELS}
                                    size="xs"
                                  />
                                  {task.dueDate && (
                                    <span
                                      className={cn(
                                        "text-[11px]",
                                        isOverdue
                                          ? "font-medium text-red-600 dark:text-red-400"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {isOverdue && (
                                        <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                                      )}
                                      {formatDate(task.dueDate)}
                                    </span>
                                  )}
                                  {task.approvalStatus === "PENDING_APPROVAL" && (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-300 py-0 text-[10px] text-amber-700"
                                    >
                                      <Clock className="mr-0.5 h-2.5 w-2.5" />
                                      Pending
                                    </Badge>
                                  )}
                                </div>

                                <TaskStatusSelect
                                  value={task.status}
                                  disabled={locked}
                                  triggerClassName="h-7 w-full text-xs"
                                  onCommit={(payload) => commit(task.id, { ...payload })}
                                />
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                      {col.length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-muted-foreground/60 py-6 text-center text-[11px]">
                          Drop a task here
                        </p>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      <TaskStatusReasonDialog
        mode={pendingDrag?.mode ?? null}
        onOpenChange={(open) => {
          if (!open) {
            // Cancelled: refetch so the card returns to the column it came from.
            qc.invalidateQueries({ queryKey: ["my-tasks"] })
            setPendingDrag(null)
          }
        }}
        onConfirm={(payload) => {
          if (pendingDrag) commit(pendingDrag.taskId, { ...payload })
          setPendingDrag(null)
        }}
      />
    </>
  )
}
