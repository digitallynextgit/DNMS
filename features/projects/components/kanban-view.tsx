"use client"

import { useState, type CSSProperties } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { useQueryClient } from "@tanstack/react-query"
import {
  useProjectAllTasks,
  useUpdateTask,
  type ProjectTask,
} from "@/features/projects/hooks/use-projects"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskDetailSheet } from "./task-detail-sheet"
import { TaskStatusReasonDialog } from "./task-status-reason-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { cn, formatDate } from "@/lib/utils"
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS } from "@/lib/constants"
import { formatHours } from "../lib/format-hours"
import { AlertTriangle, Clock, Milestone, GripVertical } from "lucide-react"

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: "TODO", label: "To-do", color: "bg-slate-100 dark:bg-slate-800" },
  { id: "IN_PROGRESS", label: "In Process", color: "bg-blue-50 dark:bg-blue-950/30" },
  { id: "DONE", label: "Completed", color: "bg-emerald-50 dark:bg-emerald-950/30" },
  { id: "ON_HOLD", label: "On Hold", color: "bg-amber-50 dark:bg-amber-950/30" },
  { id: "DISCARDED", label: "Discarded", color: "bg-red-50 dark:bg-red-950/30" },
]

interface Props {
  projectId: string
  currentUserId: string
  isAdmin: boolean
  teamFilter: string // "all" or teamId
  statusFilter?: string // "ALL" or a status
  showPendingOnly?: boolean
}

export function KanbanView({
  projectId,
  currentUserId,
  isAdmin,
  teamFilter,
  statusFilter = "ALL",
  showPendingOnly = false,
}: Props) {
  const qc = useQueryClient()
  const { data, isLoading } = useProjectAllTasks(projectId)
  const update = useUpdateTask()
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  // A drag onto On Hold / Discarded pauses here to collect the required reason.
  const [holdDrag, setHoldDrag] = useState<{
    taskId: string
    mode: "ON_HOLD" | "DISCARDED"
  } | null>(null)

  const allTasks = (data?.data ?? []).filter((t) => {
    if (showPendingOnly) {
      if (t.approvalStatus !== "PENDING_APPROVAL") return false
    } else if (t.approvalStatus === "REJECTED") {
      return false
    }
    if (teamFilter !== "all" && t.teamId !== teamFilter) return false
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false
    return true
  })

  function commitStatus(taskId: string, body: Record<string, unknown>) {
    qc.setQueryData(
      ["project-all-tasks", projectId],
      (old: { data: ProjectTask[] } | undefined) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map((t) =>
            t.id === taskId ? { ...t, status: body.status as ProjectTask["status"] } : t,
          ),
        }
      },
    )
    update.mutate(
      { taskId, body, silent: true },
      { onError: () => qc.invalidateQueries({ queryKey: ["project-all-tasks", projectId] }) },
    )
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const { draggableId, destination, source } = result
    if (destination.droppableId === source.droppableId) return

    const newStatus = destination.droppableId

    // On Hold / Discarded need a reason (+ date for hold): pause and prompt.
    if (newStatus === "ON_HOLD" || newStatus === "DISCARDED") {
      setHoldDrag({ taskId: draggableId, mode: newStatus })
      return
    }

    commitStatus(draggableId, { status: newStatus })
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((c) => (
          <div key={c.id} className="space-y-2">
            <Skeleton className="h-6 w-24 rounded" />
            <Skeleton className="h-24 rounded" />
            <Skeleton className="h-24 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const byStatus: Record<string, ProjectTask[]> = {}
  for (const col of COLUMNS) byStatus[col.id] = []
  for (const t of allTasks) {
    if (byStatus[t.status]) byStatus[t.status].push(t)
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((col) => (
            <div key={col.id} className="flex min-w-0 flex-col">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {col.label}
                </span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {byStatus[col.id].length}
                </Badge>
              </div>

              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "min-h-24 flex-1 space-y-2 rounded p-2 transition-colors",
                      col.color,
                      snapshot.isDraggingOver && "ring-primary/40 ring-2",
                    )}
                  >
                    {byStatus[col.id].map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(drag, snap) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            style={drag.draggableProps.style as CSSProperties}
                            className={cn(
                              "bg-background cursor-pointer rounded border p-3 shadow-sm select-none",
                              snap.isDragging && "ring-primary/50 rotate-1 shadow-lg ring-2",
                              task.approvalStatus === "PENDING_APPROVAL" && "border-amber-300",
                            )}
                            onClick={() => {
                              setSelectedTask(task)
                              setSheetOpen(true)
                            }}
                          >
                            {/* Drag handle */}
                            <div
                              {...drag.dragHandleProps}
                              className="mb-2 flex items-start justify-between gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="text-muted-foreground/40 mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <div className="min-w-0 flex-1" />
                              {task.isMilestone && (
                                <Milestone className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                              )}
                            </div>

                            <p className="-mt-4 line-clamp-2 pl-5 text-sm leading-snug font-medium">
                              {task.title}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-1">
                              <StatusBadge
                                status={task.priority}
                                colorMap={TASK_PRIORITY_COLORS}
                                labelMap={TASK_PRIORITY_LABELS}
                                size="xs"
                                className="py-0"
                              />
                              {task.approvalStatus === "PENDING_APPROVAL" && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 py-0 text-[10px] text-amber-700"
                                >
                                  <Clock className="mr-0.5 h-2.5 w-2.5" />
                                  Pending
                                </Badge>
                              )}
                              {task.dueDate &&
                                new Date(task.dueDate) < new Date() &&
                                task.status !== "DONE" && (
                                  <Badge
                                    variant="outline"
                                    className="border-red-300 py-0 text-[10px] text-red-700"
                                  >
                                    <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                                    Overdue
                                  </Badge>
                                )}
                            </div>

                            {task.estimatedHours != null && (
                              <p className="text-muted-foreground mt-1.5 text-[10px]">
                                {formatHours(task.estimatedHours)}
                              </p>
                            )}

                            <div className="mt-2 flex items-center justify-between">
                              {task.dueDate && (
                                <span className="text-muted-foreground text-[10px]">
                                  {formatDate(task.dueDate)}
                                </span>
                              )}
                              <div className="ml-auto">
                                {task.assignee && (
                                  <AvatarDisplay
                                    src={task.assignee.profilePhoto}
                                    firstName={task.assignee.firstName}
                                    lastName={task.assignee.lastName}
                                    size="xs"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {byStatus[col.id].length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-muted-foreground/60 py-4 text-center text-[11px]">Empty</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <TaskDetailSheet
        task={selectedTask}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        currentUserId={currentUserId}
        isManager={isAdmin}
      />

      <TaskStatusReasonDialog
        mode={holdDrag?.mode ?? null}
        onOpenChange={(o) => {
          if (!o) {
            // Cancelled the reason: undo the visual move.
            qc.invalidateQueries({ queryKey: ["project-all-tasks", projectId] })
            setHoldDrag(null)
          }
        }}
        onConfirm={(payload) => {
          if (holdDrag) commitStatus(holdDrag.taskId, { ...payload })
          setHoldDrag(null)
        }}
      />
    </>
  )
}
