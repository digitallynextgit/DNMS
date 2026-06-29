"use client"

import { useState, useRef, useEffect } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { formatHours } from "../lib/format-hours"
import {
  useTaskComments,
  useAddComment,
  useDeleteComment,
  useTaskChecklist,
  useAddChecklistItem,
  useToggleChecklistItem,
  useDeleteChecklistItem,
  useUpdateTask,
  type ProjectTask,
} from "@/features/projects/hooks/use-projects"
import { cn, formatDate } from "@/lib/utils"
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/constants"
import {
  MessageSquare,
  CheckSquare2,
  Square,
  Plus,
  Trash2,
  Milestone,
  Clock,
  AlertTriangle,
  Send,
  CalendarDays,
  Flag,
} from "lucide-react"

interface Props {
  task: ProjectTask | null
  open: boolean
  onClose: () => void
  currentUserId: string
  isManager: boolean
}

const PRIORITY_ACCENT: Record<string, string> = {
  LOW: "from-slate-400",
  MEDIUM: "from-blue-500",
  HIGH: "from-amber-500",
  URGENT: "from-red-500",
}

export function TaskDetailSheet({ task, open, onClose, currentUserId, isManager }: Props) {
  if (!task) return null

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE"

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden border-l p-0 sm:max-w-120">
        {/* Priority accent bar */}
        <div
          className={cn(
            "h-1 w-full bg-linear-to-r to-transparent",
            PRIORITY_ACCENT[task.priority] ?? "from-slate-400",
          )}
        />

        {/* Header */}
        <div className="bg-muted/30 space-y-3 border-b px-5 pt-4 pr-12 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base leading-snug font-semibold tracking-tight">{task.title}</h2>
            </div>
            {task.isMilestone && (
              <Badge className="h-5 shrink-0 gap-1 border border-purple-200 bg-purple-100 px-1.5 text-[10px] font-medium text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                <Milestone className="h-2.5 w-2.5" />
                Milestone
              </Badge>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={task.status}
              colorMap={TASK_STATUS_COLORS}
              labelMap={TASK_STATUS_LABELS}
              className="h-5 border px-2 text-[11px]"
            />
            <StatusBadge
              status={task.priority}
              colorMap={TASK_PRIORITY_COLORS}
              labelMap={TASK_PRIORITY_LABELS}
              className="h-5 border px-2 text-[11px]"
            />
            {task.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-medium",
                  isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                )}
              >
                {isOverdue ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <CalendarDays className="h-3 w-3" />
                )}
                Due {formatDate(task.dueDate)}
              </span>
            )}
            {task.estimatedHours != null && (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-medium">
                <Clock className="h-3 w-3" />
                {formatHours(task.estimatedHours)}
              </span>
            )}
          </div>

          {/* Assignee */}
          {task.assignee && (
            <div className="flex items-center gap-2">
              <AvatarDisplay
                src={task.assignee.profilePhoto}
                firstName={task.assignee.firstName}
                lastName={task.assignee.lastName}
                size="xs"
                className="h-6 w-6"
                fallbackClassName="bg-primary/10 text-primary"
              />
              <span className="text-muted-foreground text-xs">
                Assigned to{" "}
                <span className="text-foreground font-medium">
                  {task.assignee.firstName} {task.assignee.lastName}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Description */}
          {task.description && (
            <div className="border-b px-5 py-4">
              <p className="text-muted-foreground text-sm leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Milestone toggle - managers only */}
          {isManager && (
            <div className="border-b px-5 py-3">
              <MilestoneToggle task={task} />
            </div>
          )}

          {/* Checklist */}
          <div className="border-b px-5 py-4">
            <ChecklistSection taskId={task.id} />
          </div>

          {/* Comments */}
          <div className="px-5 py-4">
            <CommentsSection taskId={task.id} currentUserId={currentUserId} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MilestoneToggle({ task }: { task: ProjectTask }) {
  const update = useUpdateTask()
  const active = task.isMilestone

  return (
    <button
      className={cn(
        "group flex w-full items-center gap-2.5 rounded border px-3 py-2 text-sm transition-all",
        active
          ? "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30"
          : "border-border border-dashed hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/10",
      )}
      onClick={() => update.mutate({ taskId: task.id, body: { isMilestone: !task.isMilestone } })}
      disabled={update.isPending}
    >
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded",
          active
            ? "bg-purple-600 text-white"
            : "bg-muted text-muted-foreground group-hover:bg-purple-100 group-hover:text-purple-700",
        )}
      >
        <Flag className="h-3 w-3" />
      </div>
      <span
        className={cn(
          "text-xs font-medium",
          active ? "text-purple-700 dark:text-purple-300" : "text-muted-foreground",
        )}
      >
        {active ? "Remove milestone flag" : "Mark as milestone"}
      </span>
      {active && (
        <Badge className="ml-auto h-4 border-0 bg-purple-600 px-1.5 text-[10px] text-white">
          Active
        </Badge>
      )}
    </button>
  )
}

function ChecklistSection({ taskId }: { taskId: string }) {
  const { data, isLoading } = useTaskChecklist(taskId)
  const items = data?.data ?? []
  const add = useAddChecklistItem(taskId)
  const toggle = useToggleChecklistItem(taskId)
  const del = useDeleteChecklistItem(taskId)
  const [text, setText] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const checked = items.filter((i) => i.isChecked).length
  const total = items.length
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0

  function handleAdd() {
    if (!text.trim()) return
    add.mutate(text.trim(), {
      onSuccess: () => {
        setText("")
        inputRef.current?.focus()
      },
    })
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare2 className="text-muted-foreground h-3.5 w-3.5" />
          <span className="text-xs font-semibold">Checklist</span>
          {total > 0 && (
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {checked}/{total}
            </span>
          )}
        </div>
        {total > 0 && (
          <span
            className={cn(
              "text-[10px] font-semibold tabular-nums",
              pct === 100 ? "text-emerald-600" : "text-muted-foreground",
            )}
          >
            {pct}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              pct === 100 ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Items */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
        </div>
      ) : (
        <div className="space-y-1">
          {items.length === 0 && (
            <EmptyState compact icon={CheckSquare2} title="No items yet" className="py-3" />
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="group hover:bg-muted/50 flex items-center gap-2.5 rounded px-2 py-1.5 transition-colors"
            >
              <button
                className="shrink-0"
                onClick={() => toggle.mutate({ itemId: item.id, isChecked: !item.isChecked })}
              >
                {item.isChecked ? (
                  <CheckSquare2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Square className="text-muted-foreground/60 hover:text-muted-foreground h-4 w-4" />
                )}
              </button>
              <span
                className={cn(
                  "flex-1 text-sm leading-none",
                  item.isChecked && "text-muted-foreground line-through",
                )}
              >
                {item.text}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={() => del.mutate(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add input */}
      <div className="mt-1 flex items-center gap-2">
        <input
          ref={inputRef}
          className="bg-background placeholder:text-muted-foreground/60 focus:ring-ring/30 flex-1 rounded border px-3 py-2 text-sm transition focus:ring-2 focus:outline-none"
          placeholder="Add an item…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-9 w-9 shrink-0 p-0"
          onClick={handleAdd}
          disabled={!text.trim() || add.isPending}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function CommentsSection({ taskId, currentUserId }: { taskId: string; currentUserId: string }) {
  const { data, isLoading } = useTaskComments(taskId)
  const comments = data?.data ?? []
  const add = useAddComment(taskId)
  const del = useDeleteComment(taskId)
  const [text, setText] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (comments.length) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments.length])

  function handlePost() {
    if (!text.trim()) return
    add.mutate(text.trim(), { onSuccess: () => setText("") })
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Comments</span>
        {comments.length > 0 && (
          <Badge variant="secondary" className="h-4 rounded-full px-1.5 text-[10px]">
            {comments.length}
          </Badge>
        )}
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 rounded" />
          <Skeleton className="h-14 rounded" />
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          compact
          icon={MessageSquare}
          title="No comments yet"
          description="Be the first to start the conversation"
        />
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const isOwn = c.authorId === currentUserId
            return (
              <div key={c.id} className="group flex gap-3">
                <AvatarDisplay
                  src={c.author.profilePhoto}
                  firstName={c.author.firstName}
                  lastName={c.author.lastName}
                  size="xs"
                  className="ring-background mt-0.5 h-7 w-7 shrink-0 ring-2"
                  fallbackClassName="bg-primary/10 text-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="bg-muted/60 rounded rounded-tl-sm px-3 py-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold">
                        {c.author.firstName} {c.author.lastName}
                        {isOwn && (
                          <span className="text-muted-foreground ml-1 font-normal">(you)</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground text-[10px]">
                          {formatDate(c.createdAt)}
                        </span>
                        {isOwn && (
                          <button
                            className="text-muted-foreground hover:text-destructive rounded p-0.5 opacity-0 transition-all group-hover:opacity-100"
                            onClick={() => del.mutate(c.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                      {c.content}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Composer */}
      <div className="space-y-1.5 pt-1">
        <div className="relative">
          <Textarea
            className="border-muted-foreground/20 bg-muted/30 min-h-20 resize-none rounded pr-12 text-sm focus-visible:ring-1"
            placeholder="Add a comment…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost()
            }}
          />
          <Button
            size="icon"
            className="absolute right-2.5 bottom-2.5 h-7 w-7"
            onClick={handlePost}
            disabled={!text.trim() || add.isPending}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-muted-foreground/60 text-[10px]">Ctrl+Enter to post</p>
      </div>
    </div>
  )
}
