"use client"

import * as React from "react"
import { Plus, Sparkles, Trash2 } from "lucide-react"

import { formatDate } from "@/lib/utils"
import { TASK_STATUS_LABELS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { DateField } from "@/components/shared/date-field"
import { useDeliverableTasks, useSplitDeliverable } from "../hooks/use-task-work"
import type { DeliverableTasks } from "../server/deliverable-tasks.service"
import { markAiSuggestionUsed, useAiSuggest, useProjectAi } from "../hooks/use-project-ai"

export interface SplitTarget {
  id: string
  title: string
  quantity: number
  dueOn: string | null
  team: { name: string } | null
}

interface Line {
  key: string
  title: string
  assigneeId: string
  dueDate: string
  hours: string
}

const key = () => Math.random().toString(36).slice(2)

/** The tasks a deliverable is split into, and splitting it further. */
export function DeliverableSplitDialog({
  projectId,
  row,
  currentUserId,
  onClose,
}: {
  projectId: string
  row: SplitTarget | null
  currentUserId?: string
  onClose: () => void
}) {
  return (
    <Dialog open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {row && (
          <Body
            key={row.id}
            projectId={projectId}
            row={row}
            currentUserId={currentUserId}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  projectId,
  row,
  currentUserId,
  onClose,
}: {
  projectId: string
  row: SplitTarget
  currentUserId?: string
  onClose: () => void
}) {
  const { data, isLoading } = useDeliverableTasks(projectId, row.id)
  if (isLoading || !data) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Tasks · {row.title}</DialogTitle>
          <DialogDescription>Loading its tasks…</DialogDescription>
        </DialogHeader>
        <Skeleton className="h-32 rounded-sm" />
      </>
    )
  }
  return (
    <SplitForm
      projectId={projectId}
      row={row}
      data={data}
      currentUserId={currentUserId}
      onClose={onClose}
    />
  )
}

/** Mounted once the tasks are in, so the first line can start on the right person. */
function SplitForm({
  projectId,
  row,
  data,
  currentUserId,
  onClose,
}: {
  projectId: string
  row: SplitTarget
  data: DeliverableTasks
  currentUserId?: string
  onClose: () => void
}) {
  const split = useSplitDeliverable(projectId)
  const assignable = data.assignable
  const defaultAssignee =
    assignable.find((p) => p.id === currentUserId)?.id ?? assignable[0]?.id ?? ""
  const [lines, setLines] = React.useState<Line[]>(() =>
    data.canSplit
      ? [
          {
            key: key(),
            title: data.tasks.length === 0 ? row.title : "",
            assigneeId: defaultAssignee,
            dueDate: row.dueOn ?? "",
            hours: "",
          },
        ]
      : [],
  )

  const setLine = (k: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)))
  const ready = lines.filter((l) => l.title.trim() && l.assigneeId)

  // AI drafts the tasks (with what to log when done); they land as lines to edit, assign or drop.
  const aiReady = useProjectAi(projectId)
  const suggest = useAiSuggest(projectId, "tasks")
  const [hints, setHints] = React.useState<Record<string, string>>({})
  const suggestTasks = () =>
    suggest.mutate(
      { deliverableId: row.id },
      {
        onSuccess: (r) => {
          const drafted = r.tasks.map((t) => ({
            key: key(),
            title: t.title,
            assigneeId: defaultAssignee,
            dueDate: row.dueOn ?? "",
            hours: t.estimatedHours === null ? "" : String(t.estimatedHours),
            hint: t.logHint,
          }))
          setLines((ls) => [
            ...ls.filter((l) => l.title.trim() && l.title !== row.title),
            ...drafted.map(({ hint: _hint, ...l }) => l),
          ])
          setHints((h) => ({
            ...h,
            ...Object.fromEntries(drafted.filter((d) => d.hint).map((d) => [d.key, d.hint])),
          }))
          markAiSuggestionUsed(projectId, r.id)
        },
      },
    )

  const submit = () => {
    if (ready.length === 0 || split.isPending) return
    split.mutate(
      {
        deliverableId: row.id,
        tasks: ready.map((l) => ({
          title: l.title.trim(),
          assigneeId: l.assigneeId,
          dueDate: l.dueDate || null,
          estimatedHours: l.hours === "" ? null : Number(l.hours),
        })),
      },
      { onSuccess: onClose },
    )
  }

  const tasks = data.tasks
  return (
    <>
      <DialogHeader>
        <DialogTitle>Tasks · {row.title}</DialogTitle>
        <DialogDescription>
          {row.quantity > 1 ? `${row.quantity} to make` : "One to make"}
          {row.team ? ` · owed by ${row.team.name}` : ""}. Each task is part of this deliverable;
          what its person logs (and how many they made) adds to the count.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {tasks.length > 0 && (
          <ul className="divide-y rounded-sm border text-xs">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                <span className="text-muted-foreground">{t.assigneeName ?? "unassigned"}</span>
                <span className="text-muted-foreground">
                  {TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? t.status}
                </span>
                {t.dueDate && (
                  <span className="text-muted-foreground">
                    due {formatDate(t.dueDate, "d MMM")}
                  </span>
                )}
                {t.logged > 0 && <span className="tabular-nums">{t.logged} made</span>}
              </li>
            ))}
          </ul>
        )}

        {data.canSplit ? (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-[11px]">
              {tasks.length > 0 ? "Add tasks" : "Split into tasks"}
            </Label>
            {lines.map((l) => (
              <div key={l.key} className="space-y-1">
                <div className="grid gap-2 sm:grid-cols-[1.6fr_1fr_8.5rem_4.5rem_auto]">
                  <Input
                    value={l.title}
                    onChange={(e) => setLine(l.key, { title: e.target.value })}
                    placeholder="What is the task?"
                    maxLength={200}
                    aria-label="Task title"
                  />
                  <Select
                    value={l.assigneeId}
                    onValueChange={(v) => setLine(l.key, { assigneeId: v })}
                  >
                    <SelectTrigger aria-label="Who does it">
                      <SelectValue placeholder="Who" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignable.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.id === currentUserId ? `${p.name} (you)` : p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DateField
                    value={l.dueDate}
                    onChange={(v) => setLine(l.key, { dueDate: v })}
                    placeholder="Due"
                    modal
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={l.hours}
                    onChange={(e) => setLine(l.key, { hours: e.target.value })}
                    placeholder="Hrs"
                    aria-label="Estimated hours"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remove this task"
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {hints[l.key] && (
                  <p className="text-muted-foreground flex items-center gap-1 pl-1 text-[11px]">
                    <Sparkles className="h-3 w-3 shrink-0" /> Log when done: {hints[l.key]}
                  </p>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() =>
                setLines((ls) => [
                  ...ls,
                  {
                    key: key(),
                    title: "",
                    assigneeId: defaultAssignee,
                    dueDate: row.dueOn ?? "",
                    hours: "",
                  },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Another task
            </Button>
            {aiReady && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={suggestTasks}
                loading={suggest.isPending}
              >
                <Sparkles className="h-3.5 w-3.5" /> Suggest tasks
              </Button>
            )}
            <p className="text-muted-foreground text-[11px]">
              You can give tasks to yourself or to people who report to you on this team; the team
              manager and account manager can pick anyone on it.
            </p>
          </div>
        ) : (
          tasks.length === 0 && (
            <p className="text-muted-foreground text-xs">
              No tasks yet. The team that owes this, or its managers, can split it.
            </p>
          )
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        {data.canSplit && (
          <Button onClick={submit} disabled={ready.length === 0} loading={split.isPending}>
            Create {ready.length > 0 ? ready.length : ""} task{ready.length === 1 ? "" : "s"}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
