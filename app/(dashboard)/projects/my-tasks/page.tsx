"use client"

import { useEffect, useMemo, useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { useUpdateEffect } from "@/hooks/use-update-effect"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Link from "next/link"
import { AlertTriangle, Clock, Inbox } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
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
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
} from "@/lib/constants"
import { formatDate, cn } from "@/lib/utils"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"

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

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateTask(id, { status }),
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
  const overdueCount = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE",
  ).length

  const columns: DataTableColumn<MyTask>[] = [
    {
      header: "Status",
      headClassName: "w-32",
      cell: (task) => (
        <Select
          value={task.status}
          disabled={
            task.approvalStatus === "PENDING_APPROVAL" || task.approvalStatus === "REJECTED"
          }
          onValueChange={(v) => updateMut.mutate({ id: task.id, status: v })}
        >
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODO">To Do</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="IN_REVIEW">In Review</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
          </SelectContent>
        </Select>
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
      <PageHeader title="My Tasks" description="Tasks assigned to you across all projects." />

      {/* Summary strip */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-border grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            <Stat label="Total" value={tasks.length} />
            <Stat
              label="Done"
              value={tasks.filter((t) => t.status === "DONE").length}
              tone="emerald"
            />
            <Stat
              label="Pending approval"
              value={pendingApproval.length}
              tone={pendingApproval.length > 0 ? "amber" : "default"}
            />
            <Stat
              label="Overdue"
              value={overdueCount}
              tone={overdueCount > 0 ? "red" : "default"}
            />
          </div>
        </CardContent>
      </Card>

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
              <SelectItem value="TODO">To Do</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="IN_REVIEW">In Review</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Groups or table */}
      {isLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : grouped.length === 0 ? (
        <EmptyState icon={Inbox} variant="card" title="No tasks match the filter." />
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
                        "flex items-center gap-3 rounded-lg border p-2.5",
                        isOverdue &&
                          "border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20",
                        isPending &&
                          "border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20",
                        isRejected && "border-red-200 bg-red-50/40",
                        !isOverdue && !isPending && !isRejected && "border-border",
                      )}
                    >
                      <Select
                        value={task.status}
                        disabled={isPending || isRejected}
                        onValueChange={(v) => updateMut.mutate({ id: task.id, status: v })}
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

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "emerald" | "amber" | "red"
}) {
  const color =
    tone === "emerald" && value > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber" && value > 0
        ? "text-amber-600 dark:text-amber-400"
        : tone === "red" && value > 0
          ? "text-red-600 dark:text-red-400"
          : "text-foreground"
  return (
    <div className="px-4 py-3">
      <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums", color)}>{value}</p>
    </div>
  )
}
