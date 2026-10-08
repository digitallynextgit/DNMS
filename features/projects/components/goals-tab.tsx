"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  MoreHorizontal,
  Target,
  CalendarDays,
  ChevronRight,
  Trash2,
  TriangleAlert,
  History,
  RotateCcw,
  EyeOff,
  Pencil,
  ListChecks,
} from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { DateField } from "@/components/shared/date-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useProjectGoals } from "../hooks/use-goals"
import { useAssignableEmployees, useProjectTeams } from "../hooks/use-projects"
import {
  EMPTY_SUMMARY,
  NEEDS_REASON,
  ProgressBar,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_STYLE,
  SlippingChip,
  StatusBadge,
  fmtDate,
  fmtWhen,
  type GoalEvent,
  type GoalNode,
  type GoalsSummary,
  type Status,
} from "./goal-status"
import {
  GoalFilterBar,
  NO_GOAL_FILTERS,
  filterGoals,
  goalFiltersActive,
  type GoalFilters,
} from "./goal-filters"
import { GoalTagInput, GoalTagList } from "./goal-tag-input"
import { GoalTasks } from "./goal-tasks"
import { GoalTargets } from "./goal-targets"

/** Radix Select cannot carry "" as a value; this stands in for "no owner". */
const NO_OWNER = "__none__"

/** AT_RISK and DISCARDED need a reason (the server 422s without one); the status applies only once given. */
function ReasonDialog({
  open,
  status,
  goalTitle,
  onCancel,
  onConfirm,
  pending,
}: {
  open: boolean
  status: Status | null
  goalTitle: string
  onCancel: () => void
  onConfirm: (reason: string) => void
  pending: boolean
}) {
  const [reason, setReason] = React.useState("")
  const [prevOpen, setPrevOpen] = React.useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setReason("")
  }

  const isRisk = status === "AT_RISK"
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isRisk ? "Flag this goal at risk" : "Discard this goal"}</DialogTitle>
          <DialogDescription>
            {isRisk
              ? `What has put "${goalTitle}" at risk? This is recorded in the goal's history.`
              : `Why is "${goalTitle}" being dropped? Discarded goals stay visible with their reason, and stop counting towards progress.`}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
          placeholder={
            isRisk ? "e.g. Blocked on client sign-off since 12 Aug" : "e.g. Superseded by Q4 plan"
          }
          aria-label="Reason"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(reason)} disabled={!reason.trim() || pending}>
            {isRisk ? "Flag at risk" : "Discard goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Edits title, target date and owner. Keyed per goal by the caller, so the fields seed from props. */
function EditDialog({
  goal,
  onCancel,
  onSave,
  people,
  allTags,
  pending,
}: {
  goal: GoalNode
  onCancel: () => void
  onSave: (patch: {
    title: string
    targetDate: string | null
    ownerId: string | null
    tags: string[]
  }) => void
  people: { id: string; firstName: string; lastName: string }[]
  allTags: string[]
  pending: boolean
}) {
  const [title, setTitle] = React.useState(goal.title)
  const [date, setDate] = React.useState(goal.targetDate ?? "")
  const [owner, setOwner] = React.useState(goal.ownerId ?? "")
  const [tags, setTags] = React.useState<string[]>(goal.tags)

  const trimmed = title.trim()
  const tagsChanged =
    tags.length !== goal.tags.length ||
    tags.some((t, i) => t.toLowerCase() !== goal.tags[i]?.toLowerCase())
  // Nothing changed means nothing to save; the button stays disabled.
  const changed =
    trimmed !== goal.title ||
    (date || null) !== goal.targetDate ||
    (owner || null) !== goal.ownerId ||
    tagsChanged
  const submit = () => {
    if (!trimmed || !changed) return
    onSave({ title: trimmed, targetDate: date || null, ownerId: owner || null, tags })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit goal</DialogTitle>
          <DialogDescription>
            Changes are recorded in this goal&rsquo;s history, with who made them and when.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label required className="text-muted-foreground text-[11px]">
              Title
            </Label>
            <Input
              autoFocus
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="What is this goal?"
              aria-label="Goal title"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Target date</Label>
            {/* modal: the calendar pops over a dialog and has to layer above it. */}
            <DateField value={date} onChange={setDate} placeholder="No target date" modal />
            {date && (
              <button
                type="button"
                onClick={() => setDate("")}
                className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-4"
              >
                Clear the date
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Owner</Label>
            {/* Accountable for it landing; blank reads as the account manager. */}
            <Select
              value={owner || NO_OWNER}
              onValueChange={(v) => setOwner(v === NO_OWNER ? "" : v)}
            >
              <SelectTrigger className="h-8 text-xs" aria-label="Goal owner">
                <SelectValue placeholder="Account manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_OWNER} className="text-xs">
                  Account manager (default)
                </SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Tags</Label>
            <GoalTagInput value={tags} onChange={setTags} suggestions={allTags} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!trimmed || !changed || pending}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Deactivate is the default; permanent delete sits behind a checkbox. */
function DeleteDialog({
  goal,
  onCancel,
  onConfirm,
  pending,
}: {
  goal: GoalNode | null
  onCancel: () => void
  onConfirm: (permanent: boolean) => void
  pending: boolean
}) {
  const [permanent, setPermanent] = React.useState(false)
  const [prevGoal, setPrevGoal] = React.useState(goal)
  if (goal !== prevGoal) {
    setPrevGoal(goal)
    if (goal) setPermanent(false)
  }

  const subCount = goal?.children.length ?? 0
  return (
    <Dialog open={Boolean(goal)} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove &ldquo;{goal?.title}&rdquo;?</DialogTitle>
          <DialogDescription>
            By default this only deactivates the goal. It disappears from the board and stops
            counting towards progress, and you can restore it at any time.
            {subCount > 0 && ` Its ${subCount} sub-goal${subCount === 1 ? "" : "s"} go with it.`}
          </DialogDescription>
        </DialogHeader>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-colors",
            permanent ? "border-destructive/50 bg-destructive/5" : "border-border",
          )}
        >
          <Checkbox
            checked={permanent}
            onCheckedChange={(c) => setPermanent(c === true)}
            className="mt-0.5"
            aria-label="Delete permanently"
          />
          <span className="text-sm">
            <span className="font-medium">Delete permanently</span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              Destroys the goal, its sub-goals and its entire history. This cannot be undone.
            </span>
          </span>
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={permanent ? "destructive" : "default"}
            onClick={() => onConfirm(permanent)}
            disabled={pending}
          >
            {permanent ? "Delete permanently" : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HistoryDialog({ goal, onClose }: { goal: GoalNode | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(goal)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <History className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{goal?.title}</span>
            {goal && <StatusBadge status={goal.status} />}
          </DialogTitle>
          <DialogDescription>
            Every status change, edit and removal, with the reason given at the time.
          </DialogDescription>
        </DialogHeader>
        {/* Capped: a dialog taller than the viewport can't be dismissed. */}
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          <HistoryPanel events={goal?.events ?? []} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function HistoryPanel({ events }: { events: GoalEvent[] }) {
  if (events.length === 0) {
    return <p className="text-muted-foreground px-1 py-2 text-xs">No history yet.</p>
  }
  return (
    <ol className="space-y-2.5">
      {events.map((e) => (
        <li key={e.id} className="flex gap-2.5 text-xs">
          <span
            aria-hidden
            className={cn(
              "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
              e.toStatus ? STATUS_STYLE[e.toStatus].dot : "bg-muted-foreground/40",
            )}
          />
          <div className="min-w-0">
            <p>
              {e.type === "CREATED" && "Goal created"}
              {e.type === "STATUS_CHANGED" && (
                <>
                  <span className={e.fromStatus ? STATUS_STYLE[e.fromStatus].text : undefined}>
                    {e.fromStatus ? STATUS_LABEL[e.fromStatus] : "?"}
                  </span>
                  <span className="text-muted-foreground"> → </span>
                  <span
                    className={cn(
                      "font-semibold",
                      e.toStatus ? STATUS_STYLE[e.toStatus].text : undefined,
                    )}
                  >
                    {e.toStatus ? STATUS_LABEL[e.toStatus] : "?"}
                  </span>
                </>
              )}
              {e.type === "DEACTIVATED" && "Deactivated"}
              {e.type === "REACTIVATED" && "Restored"}
              {e.type === "EDITED" && "Edited"}
              <span className="text-muted-foreground">
                {" · "}
                {fmtWhen(e.at)}
                {e.actorName ? ` · ${e.actorName}` : ""}
              </span>
            </p>
            {e.reason && (
              <p className="text-muted-foreground border-border/60 mt-1 border-l-2 pl-2 italic">
                {e.reason}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Progress is never typed: a parent fills with the share of its countable sub-goals that are done. */
export function GoalsTab({
  projectId,
  canManage,
  currentUserId,
}: {
  projectId: string
  canManage: boolean
  /** Whose standing decides whether they may staff a goal - see canStaff. */
  currentUserId?: string
}) {
  const qc = useQueryClient()
  const [showInactive, setShowInactive] = React.useState(false)
  const { data, isLoading } = useProjectGoals(projectId, showInactive)

  // What was promised is the account manager's (canManage); staffing it is also the team manager's (canStaff).
  const teams = useProjectTeams(projectId)
  const teamRows = React.useMemo(() => teams.data?.data ?? [], [teams.data])
  const myTeams = React.useMemo(
    () =>
      (canManage ? teamRows : teamRows.filter((t) => t.managerId === currentUserId)).map((t) => ({
        id: t.id,
        name: t.name,
      })),
    [teamRows, canManage, currentUserId],
  )
  const canStaff =
    canManage || Boolean(currentUserId && teamRows.some((t) => t.managerId === currentUserId))

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project-goals", projectId] })
  const json = { "Content-Type": "application/json" }

  // Owner candidates for the edit dialog; only managers can open it.
  const people = useAssignableEmployees(projectId, canManage)

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/projects/${projectId}/goals`, {
        method: "POST",
        headers: json,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiFetch(`/api/projects/${projectId}/goals/${id}`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: ({ id, permanent }: { id: string; permanent: boolean }) =>
      apiFetch(`/api/projects/${projectId}/goals/${id}${permanent ? "?permanent=1" : ""}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  })
  const restore = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/projects/${projectId}/goals/${id}/reactivate`, { method: "POST" }),
    onSuccess: invalidate,
  })

  const [adding, setAdding] = React.useState(false)
  /** Which goal is having a target added, so the button can live in its footer. */
  const [targetFor, setTargetFor] = React.useState<string | null>(null)
  /** Same for work: the card offers these once, not once per row. */
  const [taskFor, setTaskFor] = React.useState<string | null>(null)
  const [linkFor, setLinkFor] = React.useState<string | null>(null)
  /** Collapsed by default so the whole list reads in one screen. */
  const [openGoals, setOpenGoals] = React.useState<Set<string>>(new Set())
  const toggleGoal = (id: string) =>
    setOpenGoals((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const [newGoal, setNewGoal] = React.useState("")
  const [newDate, setNewDate] = React.useState("")
  const [newTags, setNewTags] = React.useState<string[]>([])
  const [subFor, setSubFor] = React.useState<string | null>(null)
  const [subTitle, setSubTitle] = React.useState("")
  const [subDate, setSubDate] = React.useState("")
  const [subTags, setSubTags] = React.useState<string[]>([])
  const [filters, setFilters] = React.useState<GoalFilters>(NO_GOAL_FILTERS)
  const [historyFor, setHistoryFor] = React.useState<GoalNode | null>(null)
  const [editing, setEditing] = React.useState<GoalNode | null>(null)
  const [deleting, setDeleting] = React.useState<GoalNode | null>(null)
  const [reasonFor, setReasonFor] = React.useState<{
    id: string
    title: string
    status: Status
  } | null>(null)

  if (isLoading) return <Skeleton className="h-64 rounded-sm" />

  const full: GoalsSummary = data ?? EMPTY_SUMMARY

  // The board (summary included) uses the filtered view; `full` keeps the tag vocabulary and "N of M" readout.
  const view = filterGoals(full, filters)
  const summary = view.summary
  const filtering = goalFiltersActive(filters)

  // Real sub-goal counts, so a card can say what the filter is holding back.
  const fullChildCount = new Map(full.goals.map((g) => [g.id, g.children.length]))

  const toggleTag = (tag: string) =>
    setFilters((f) => ({
      ...f,
      tags: f.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? f.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...f.tags, tag],
    }))

  const addMain = () => {
    if (!newGoal.trim()) return
    create.mutate({ title: newGoal, targetDate: newDate || null, tags: newTags })
    setNewGoal("")
    setNewDate("")
    setNewTags([])
    setAdding(false)
  }
  const addSub = (parentId: string) => {
    if (!subTitle.trim()) return
    create.mutate({ title: subTitle, parentId, targetDate: subDate || null, tags: subTags })
    setSubTitle("")
    setSubDate("")
    setSubTags([])
    setSubFor(null)
  }

  const changeStatus = (goal: GoalNode, status: Status) => {
    if (NEEDS_REASON.has(status)) {
      setReasonFor({ id: goal.id, title: goal.title, status })
      return
    }
    update.mutate({ id: goal.id, status })
  }

  // Derived statuses (from sub-goals or tasks) get no dropdown - a pick would be overwritten.
  const statusControl = (goal: GoalNode) =>
    canManage && goal.isActive && !goal.progressIsDerived ? (
      <Select value={goal.status} onValueChange={(v) => changeStatus(goal, v as Status)}>
        <SelectTrigger
          className={cn("h-8 w-36 shrink-0 text-xs font-medium", STATUS_STYLE[goal.status].trigger)}
          aria-label={`Status for ${goal.title}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              <span className="flex items-center gap-2">
                <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", STATUS_STYLE[s].dot)} />
                {STATUS_LABEL[s]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <StatusBadge status={goal.status} />
    )

  /** One menu, not four icons per row. */
  const rowActions = (goal: GoalNode) => {
    const canEdit = canManage && goal.isActive
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${goal.title}`}
            title="Actions"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditing(goal)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit goal
            </DropdownMenuItem>
          )}
          {/* Sub-goals have no footer, so their way to a target is here. */}
          {canEdit && (
            <DropdownMenuItem onClick={() => setTargetFor(goal.id)}>
              <Target className="mr-2 h-3.5 w-3.5" /> Add target
            </DropdownMenuItem>
          )}
          {canStaff && goal.isActive && (
            <>
              <DropdownMenuItem onClick={() => setTaskFor(goal.id)}>
                <Plus className="mr-2 h-3.5 w-3.5" /> Add task
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLinkFor(goal.id)}>
                <ListChecks className="mr-2 h-3.5 w-3.5" /> Link tasks
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => setHistoryFor(goal)}>
            <History className="mr-2 h-3.5 w-3.5" /> History
          </DropdownMenuItem>
          {canManage && <DropdownMenuSeparator />}
          {canManage &&
            (goal.isActive ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                // The unfiltered node, so the confirm counts every sub-goal that goes with it.
                onClick={() => setDeleting(full.goals.find((g) => g.id === goal.id) ?? goal)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => restore.mutate(goal.id)}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Restore
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Target className="text-primary h-4 w-4" />
                Project goals
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                {filtering
                  ? "These numbers describe the filtered goals only."
                  : "What this project is for, and how far along it is."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              <Stat label="Overall" value={`${summary.overallProgress}%`} accent />
              <Stat
                label="Done"
                value={`${summary.doneGoals}`}
                suffix={`/ ${summary.totalGoals}`}
              />
              <Stat
                label="Overdue"
                value={`${summary.overdueGoals}`}
                tone={summary.overdueGoals > 0 ? "bad" : "muted"}
              />
              {/* Only when non-zero, so it doesn't become a tile people skip. */}
              {summary.slippingGoals > 0 && (
                <Stat label="Slipping" value={`${summary.slippingGoals}`} tone="warn" />
              )}
              <Stat label="Next target" value={fmtDate(summary.nextTargetDate)} small />
            </div>
          </div>
          <ProgressBar value={summary.overallProgress} className="mt-4" />

          {/* Visibility comes from the unfiltered project, so a filter can't strand the toggle. */}
          {(full.discardedGoals > 0 || full.inactiveGoals > 0 || showInactive) && (
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {summary.discardedGoals > 0 && (
                <span>{summary.discardedGoals} discarded (not counted)</span>
              )}
              {summary.inactiveGoals > 0 && <span>{summary.inactiveGoals} deactivated</span>}
              <button
                type="button"
                onClick={() => setShowInactive((v) => !v)}
                className="hover:text-foreground inline-flex items-center gap-1.5 underline underline-offset-4"
              >
                <EyeOff className="h-3 w-3" />
                {showInactive ? "Hide deactivated" : "Show deactivated"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">
          Goals
          <span className="text-muted-foreground ml-2 text-xs font-normal tabular-nums">
            {summary.goals.length}
          </span>
        </h3>
        {summary.goals.length > 0 && (
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() =>
              setOpenGoals((cur) =>
                cur.size > 0 ? new Set() : new Set(summary.goals.map((g) => g.id)),
              )
            }
          >
            {openGoals.size > 0 ? "Collapse all" : "Expand all"}
          </Button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <GoalFilterBar
            value={filters}
            onChange={setFilters}
            allTags={full.allTags}
            shown={summary.goals.length}
            total={full.goals.length}
            hiddenSubs={view.hiddenSubs}
          />
          {canManage && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add goal
            </Button>
          )}
        </div>
      </div>

      {canManage && adding && (
        <Dialog open onOpenChange={(o) => !o && setAdding(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add a goal</DialogTitle>
              <DialogDescription>
                What this project is for. Break it into sub-goals once it exists.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label required className="text-muted-foreground text-[11px]">
                  Goal
                </Label>
                <Input
                  autoFocus
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMain()}
                  placeholder="e.g. Launch the new storefront"
                  aria-label="Goal title"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[11px]">Target date</Label>
                <DateField value={newDate} onChange={setNewDate} placeholder="Target date" modal />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[11px]">Tags</Label>
                <GoalTagInput value={newTags} onChange={setNewTags} suggestions={full.allTags} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button onClick={addMain} disabled={!newGoal.trim() || create.isPending}>
                <Plus className="h-4 w-4" /> Add goal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Unlinked work is allowed (forcing a goal makes junk goals), but the manager should sort it. */}
      {canManage && full.unlinkedOpenTasks > 0 && (
        <p className="text-muted-foreground border-border/60 flex items-center gap-2 rounded-sm border border-dashed px-4 py-2.5 text-xs">
          <ListChecks className="h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="text-foreground font-medium">
              {full.unlinkedOpenTasks} open task{full.unlinkedOpenTasks === 1 ? "" : "s"}
            </span>{" "}
            on this project {full.unlinkedOpenTasks === 1 ? "isn't" : "aren't"} tied to any goal.
            Use <span className="text-foreground">Link tasks</span> on a goal below, or add the goal
            that is missing.
          </span>
        </p>
      )}

      {summary.goals.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Target className="text-muted-foreground/40 mx-auto h-8 w-8" />
            {/* An empty board and a filtered-empty board get different words; the filtered one can be cleared. */}
            {filtering ? (
              <>
                <p className="mt-3 text-sm font-medium">No goals match these filters</p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
                  This project has {full.goals.length} goal
                  {full.goals.length === 1 ? "" : "s"}, none of them in the range or tags you
                  picked. Goals with no target date never match a date range.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setFilters(NO_GOAL_FILTERS)}
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm font-medium">No goals yet</p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
                  {canManage
                    ? "Add the outcome this project is aiming at, then break it into sub-goals with their own dates."
                    : "The project manager has not set any goals for this project yet."}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {summary.goals.map((goal, gi) => {
            // A parent emptied by the filter is still a parent: its status stays server-derived.
            const isLeaf = !goal.progressIsDerived
            const hiddenHere =
              (fullChildCount.get(goal.id) ?? goal.children.length) - goal.children.length
            const isOpen = openGoals.has(goal.id)
            const taskCount = goal.tasks.length
            return (
              <Card key={goal.id} className={cn("overflow-hidden", !goal.isActive && "opacity-60")}>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3 p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => toggleGoal(goal.id)}
                    aria-expanded={isOpen}
                    className="text-muted-foreground hover:text-foreground -ml-1 shrink-0 pt-0.5"
                    title={isOpen ? "Collapse" : "Expand"}
                  >
                    <ChevronRight
                      className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
                    />
                  </button>
                  <div className="min-w-48 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Rung n={String(gi + 1)} />
                      <h4
                        className={cn(
                          "cursor-pointer leading-tight font-semibold",
                          STATUS_STYLE[goal.status].title,
                        )}
                        onClick={() => toggleGoal(goal.id)}
                      >
                        {goal.title}
                      </h4>
                      {(!canManage || !goal.isActive || !isLeaf) && (
                        <StatusBadge status={goal.status} />
                      )}
                      {!goal.isActive && (
                        <span className="border-border text-muted-foreground rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                          Deactivated
                        </span>
                      )}
                      {goal.overdue && (
                        <span className="text-destructive inline-flex items-center gap-1 text-[11px] font-medium">
                          <TriangleAlert className="h-3 w-3" /> Past target
                        </span>
                      )}
                      {/* Beside "Past target", not instead: a goal can be both overdue and slipping. */}
                      {goal.slipping && <SlippingChip />}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                      {[
                        goal.children.length > 0 &&
                          `${goal.children.length} sub-goal${goal.children.length === 1 ? "" : "s"}`,
                        taskCount > 0 && `${taskCount} task${taskCount === 1 ? "" : "s"}`,
                        goal.targets.length > 0 &&
                          `${goal.targets.length} target${goal.targets.length === 1 ? "" : "s"}`,
                        !isLeaf && `${goal.doneChildren} of ${goal.countableChildren} done`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "nothing under it yet"}
                    </p>
                    {isOpen && (
                      <>
                        <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs empty:hidden">
                          {goal.targetDate && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {fmtDate(goal.targetDate)}
                            </span>
                          )}
                          {hiddenHere > 0 && (
                            <span className="italic">
                              {hiddenHere} sub-goal{hiddenHere === 1 ? "" : "s"} hidden by filters
                            </span>
                          )}
                          {goal.ownerName && (
                            <span title="Accountable for this goal landing">
                              owner {goal.ownerName}
                            </span>
                          )}
                        </p>
                        <GoalTagList
                          tags={goal.tags}
                          activeTags={filters.tags}
                          onToggle={toggleTag}
                          className="mt-1.5"
                        />
                        {goal.statusReason && (
                          <p className="text-muted-foreground border-border/60 mt-2 border-l-2 pl-2 text-xs italic">
                            {goal.statusReason}
                          </p>
                        )}
                        <GoalTargets
                          projectId={projectId}
                          goal={goal}
                          canManage={canManage}
                          className="mt-2"
                          adding={targetFor === goal.id}
                          onAddingChange={(v) => setTargetFor(v ? goal.id : null)}
                        />
                      </>
                    )}
                  </div>

                  {isLeaf ? (
                    statusControl(goal)
                  ) : (
                    <div className="w-36 shrink-0">
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground text-[10px] tracking-widest uppercase">
                          {goal.targets.length > 0 ? "Delivered" : "Progress"}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">{goal.progress}%</span>
                      </div>
                      <ProgressBar value={goal.progress} className="mt-1.5" />
                      {/* With targets the bar shows output; task progress goes underneath. */}
                      {goal.targets.length > 0 && goal.taskProgress !== null && (
                        <p
                          className="text-muted-foreground mt-1 text-[10px] tabular-nums"
                          title="How much of the linked work is done"
                        >
                          tasks {goal.taskProgress}%
                        </p>
                      )}
                    </div>
                  )}

                  {rowActions(goal)}
                </div>

                {isOpen && goal.children.length > 0 && (
                  <div className="border-border/60 bg-muted/30 divide-border/60 divide-y border-t">
                    {goal.children.map((sub, si) => (
                      <div key={sub.id}>
                        <div className="border-primary/25 relative ml-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 py-2.5 pr-4 pl-4 sm:ml-6">
                          <span
                            aria-hidden
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full ring-2",
                              STATUS_STYLE[sub.status].dot,
                              "ring-background",
                            )}
                          />
                          <div className="min-w-36 flex-1">
                            <p
                              className={cn(
                                "flex items-center gap-2 text-sm",
                                STATUS_STYLE[sub.status].title,
                              )}
                            >
                              <Rung sub n={`${gi + 1}.${si + 1}`} />
                              {sub.title}
                            </p>
                            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-[11px] empty:hidden">
                              {sub.targetDate && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  {fmtDate(sub.targetDate)}
                                </span>
                              )}
                              {sub.overdue && (
                                <span className="text-destructive font-medium">past target</span>
                              )}
                              {sub.slipping && <SlippingChip />}
                              <GoalTagList
                                tags={sub.tags}
                                activeTags={filters.tags}
                                onToggle={toggleTag}
                              />
                            </p>
                            {sub.statusReason && (
                              <p className="text-muted-foreground border-border/60 mt-1 border-l-2 pl-2 text-[11px] italic">
                                {sub.statusReason}
                              </p>
                            )}
                            <GoalTargets
                              projectId={projectId}
                              goal={sub}
                              canManage={canManage}
                              className="mt-1.5"
                              adding={targetFor === sub.id}
                              onAddingChange={(v) => setTargetFor(v ? sub.id : null)}
                            />
                          </div>
                          {statusControl(sub)}
                          {rowActions(sub)}
                        </div>
                        <GoalTasks
                          projectId={projectId}
                          goal={sub}
                          canStaff={canStaff}
                          teams={myTeams}
                          compact
                          adding={taskFor === sub.id}
                          onAddingChange={(v) => setTaskFor(v ? sub.id : null)}
                          linking={linkFor === sub.id}
                          onLinkingChange={(v) => setLinkFor(v ? sub.id : null)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Progress derives from these tasks once any exist. */}
                {isOpen && (
                  <GoalTasks
                    projectId={projectId}
                    goal={goal}
                    canStaff={canStaff}
                    teams={myTeams}
                    adding={taskFor === goal.id}
                    onAddingChange={(v) => setTaskFor(v ? goal.id : null)}
                    linking={linkFor === goal.id}
                    onLinkingChange={(v) => setLinkFor(v ? goal.id : null)}
                  />
                )}

                {isOpen && canManage && goal.isActive && (
                  <div className="border-border/60 border-t px-4 py-2.5 sm:px-5">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => {
                          setSubFor(goal.id)
                          setSubTitle("")
                          setSubDate("")
                          setSubTags([])
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Sub-goal
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => setTaskFor(goal.id)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Task
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => setLinkFor(goal.id)}
                      >
                        <ListChecks className="h-3.5 w-3.5" /> Link tasks
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => setTargetFor(goal.id)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Target
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={subFor !== null} onOpenChange={(o) => !o && setSubFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a sub-goal</DialogTitle>
            <DialogDescription>
              A step towards &ldquo;
              {summary.goals.find((g) => g.id === subFor)?.title ?? "this goal"}&rdquo;. The parent
              goal&rsquo;s progress is derived from its sub-goals.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label required className="text-muted-foreground text-[11px]">
                Sub-goal
              </Label>
              <Input
                autoFocus
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && subFor && addSub(subFor)}
                placeholder="What needs to happen?"
                aria-label="Sub-goal title"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Target date</Label>
              <DateField value={subDate} onChange={setSubDate} placeholder="Target date" modal />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Tags</Label>
              <GoalTagInput value={subTags} onChange={setSubTags} suggestions={full.allTags} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubFor(null)}>
              Cancel
            </Button>
            <Button onClick={() => subFor && addSub(subFor)} disabled={!subTitle.trim()}>
              <Plus className="h-4 w-4" /> Add sub-goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        goal={deleting}
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={(permanent) => {
          if (deleting) remove.mutate({ id: deleting.id, permanent })
          setDeleting(null)
        }}
      />
      {/* Keyed by goal so each opens a fresh form seeded from its own values. */}
      {editing && (
        <EditDialog
          key={editing.id}
          goal={editing}
          people={people.data?.data ?? []}
          allTags={full.allTags}
          pending={update.isPending}
          onCancel={() => setEditing(null)}
          onSave={(patch) => {
            update.mutate({ id: editing.id, ...patch })
            setEditing(null)
          }}
        />
      )}
      <HistoryDialog goal={historyFor} onClose={() => setHistoryFor(null)} />
      <ReasonDialog
        open={Boolean(reasonFor)}
        status={reasonFor?.status ?? null}
        goalTitle={reasonFor?.title ?? ""}
        pending={update.isPending}
        onCancel={() => setReasonFor(null)}
        onConfirm={(reason) => {
          if (reasonFor) update.mutate({ id: reasonFor.id, status: reasonFor.status, reason })
          setReasonFor(null)
        }}
      />
    </div>
  )
}

/** "1", or "1.2" for a sub-goal. */
function Rung({ n, sub }: { n: string; sub?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm font-semibold tabular-nums",
        sub
          ? "text-muted-foreground min-w-8 text-[11px]"
          : "bg-primary/10 text-primary min-w-7 px-1.5 py-0.5 text-xs",
      )}
    >
      {n}
    </span>
  )
}

function Stat({
  label,
  value,
  suffix,
  accent,
  tone,
  small,
}: {
  label: string
  value: string
  suffix?: string
  accent?: boolean
  tone?: "bad" | "warn" | "muted"
  small?: boolean
}) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] tracking-widest uppercase">{label}</p>
      <p
        className={cn(
          "font-bold tabular-nums",
          small ? "text-sm" : "text-xl",
          accent && "text-primary",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-amber-500",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
        {suffix && <span className="text-muted-foreground text-sm font-normal"> {suffix}</span>}
      </p>
    </div>
  )
}
