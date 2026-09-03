"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  Target,
  CalendarDays,
  Trash2,
  TriangleAlert,
  History,
  RotateCcw,
  EyeOff,
  Pencil,
} from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import {
  EMPTY_SUMMARY,
  NEEDS_REASON,
  ProgressBar,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_STYLE,
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
import { GoalTagEditor, GoalTagInput, GoalTagList } from "./goal-tag-input"

// ─────────────────────────────────────────────────────────────────────────────
// Dialogs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asks for the reason that AT_RISK and DISCARDED require.
 *
 * The server rejects those statuses without one, so collecting it here is not
 * politeness - it is the difference between the change landing and a 422. The
 * status is applied only once the reason exists, so the dropdown can never show
 * a state the database refused.
 */
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
  React.useEffect(() => {
    if (open) setReason("")
  }, [open])

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

/**
 * Change what a goal IS: its title and the date it is meant to be met by.
 *
 * The gap this fills: until now a goal was write-once. A typo in a title, or a
 * date the client moved, could only be fixed by deleting the goal and retyping
 * it - which threw away its entire history to correct a word. The server has
 * always accepted both edits (updateGoal) and has always logged them; only the
 * button was missing.
 *
 * ONE EDITOR PER FIELD, deliberately. Status has its dropdown, tags have their
 * popover, and this dialog owns the title and the date. A second way to set a
 * field is a second thing to keep in step with the first.
 *
 * Mounted fresh per goal by the caller (`key={editing.id}`) so the fields seed
 * straight from props. The alternative - one long-lived dialog reset by an
 * effect - is what the two dialogs below do, and it costs a render and a lint
 * suppression for nothing.
 */
function EditDialog({
  goal,
  onCancel,
  onSave,
  pending,
}: {
  goal: GoalNode
  onCancel: () => void
  onSave: (patch: { title: string; targetDate: string | null }) => void
  pending: boolean
}) {
  const [title, setTitle] = React.useState(goal.title)
  const [date, setDate] = React.useState(goal.targetDate ?? "")

  const trimmed = title.trim()
  // Nothing to send is not an error, it just is not a save - the server would
  // no-op anyway, and a disabled button says so before the click.
  const changed = trimmed !== goal.title || (date || null) !== goal.targetDate
  const submit = () => {
    if (!trimmed || !changed) return
    onSave({ title: trimmed, targetDate: date || null })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit goal</DialogTitle>
          <DialogDescription>
            Both changes are recorded in this goal&rsquo;s history, with who made them and when.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Title</Label>
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

/**
 * The delete dialog.
 *
 * DEACTIVATE IS THE DEFAULT and permanent deletion is behind a checkbox, because
 * the two are not the same act. Deactivating removes a goal from the board and
 * from the maths while keeping it and its history recoverable; deleting destroys
 * a record of what a team decided and when. A trash icon is a reflex, and only
 * one of those two outcomes should be reachable by reflex.
 */
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
  React.useEffect(() => {
    if (goal) setPermanent(false)
  }, [goal])

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

/**
 * One goal's audit trail, in a dialog.
 *
 * A dialog rather than an inline panel: expanding history in place pushed every
 * goal below it down the page, so reading why ONE goal slipped rearranged the
 * board you were reading it against. A modal keeps the board still and gives the
 * trail room to be legible.
 */
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
        {/* Capped and scrollable: a long-running goal can accumulate a lot, and
            a dialog that grows past the viewport cannot be dismissed. */}
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          <HistoryPanel events={goal?.events ?? []} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** One goal's audit trail, including the reason attached to each change. */
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

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Goals for a project: a main goal, its sub-goals, target dates and progress.
 *
 * PROGRESS IS NOT TYPED IN ANYWHERE. A goal is done or it is not, and a parent
 * bar fills with the share of its countable sub-goals that are. Discarded and
 * deactivated goals leave the sum rather than counting as zero, so dropping
 * scope does not read as failure.
 */
export function GoalsTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const qc = useQueryClient()
  const [showInactive, setShowInactive] = React.useState(false)
  const { data, isLoading } = useProjectGoals(projectId, showInactive)

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project-goals", projectId] })
  const json = { "Content-Type": "application/json" }

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

  // The whole board runs off the FILTERED view, summary strip included, so the
  // numbers at the top always describe the goals underneath them. `full` is kept
  // for the two things that must not narrow: the tag vocabulary, and the "N of M"
  // readout that tells you a filter is on.
  const view = filterGoals(full, filters)
  const summary = view.summary
  const filtering = goalFiltersActive(filters)

  // How many sub-goals each main goal really has, so a card can say what the
  // filter is holding back from it.
  const fullChildCount = new Map(full.goals.map((g) => [g.id, g.children.length]))

  /** Clicking a tag anywhere on the board filters by it, and again clears it. */
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
  }
  const addSub = (parentId: string) => {
    if (!subTitle.trim()) return
    create.mutate({ title: subTitle, parentId, targetDate: subDate || null, tags: subTags })
    setSubTitle("")
    setSubDate("")
    setSubTags([])
    setSubFor(null)
  }

  /** A status needing a reason opens the dialog; anything else applies at once. */
  const changeStatus = (goal: GoalNode, status: Status) => {
    if (NEEDS_REASON.has(status)) {
      setReasonFor({ id: goal.id, title: goal.title, status })
      return
    }
    update.mutate({ id: goal.id, status })
  }

  const statusControl = (goal: GoalNode) =>
    canManage && goal.isActive ? (
      <Select value={goal.status} onValueChange={(v) => changeStatus(goal, v as Status)}>
        {/* The control carries its own state's colour, so a row reads as
            "at risk" without anyone parsing the words in it. */}
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

  const rowActions = (goal: GoalNode) => (
    <div className="flex shrink-0 items-center gap-0.5">
      {/* Manage-only, and only while the goal is live: editing something that
          has been taken off the board is a way to change a record nobody is
          looking at. Restore it first. `canManage` is admin OR the project's
          account manager - the same gate the server enforces on PATCH. */}
      {canManage && goal.isActive && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${goal.title}`}
          title="Edit"
          onClick={() => setEditing(goal)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {canManage && goal.isActive && (
        <GoalTagEditor
          goalTitle={goal.title}
          tags={goal.tags}
          suggestions={full.allTags}
          pending={update.isPending}
          onSave={(tags) => update.mutate({ id: goal.id, tags })}
        />
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`History for ${goal.title}`}
        title="History"
        onClick={() => setHistoryFor(goal)}
        className="text-muted-foreground hover:text-foreground"
      >
        <History className="h-3.5 w-3.5" />
      </Button>
      {canManage &&
        (goal.isActive ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${goal.title}`}
            title="Remove"
            // The UNFILTERED node: the dialog warns how many sub-goals go with
            // it, and a filtered card carries only the sub-goals on screen. A
            // destructive confirmation that under-counts what it destroys is
            // worse than no confirmation at all.
            onClick={() => setDeleting(full.goals.find((g) => g.id === goal.id) ?? goal)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Restore ${goal.title}`}
            title="Restore"
            onClick={() => restore.mutate(goal.id)}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ))}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* ── Summary ───────────────────────────────────────────────────── */}
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
              <Stat label="Next target" value={fmtDate(summary.nextTargetDate)} small />
            </div>
          </div>
          <ProgressBar value={summary.overallProgress} className="mt-4" />

          {/* Visibility off the UNFILTERED project, counts off the filtered
              view. The toggle is a property of the project, not of the current
              filter - keying its visibility to the filtered set made it vanish
              the moment a date range excluded every deactivated goal, stranding
              anyone who filtered first and wanted to widen second. */}
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

      {/* ── Filters ───────────────────────────────────────────────────────
          Above the add-goal row and below the numbers, because narrowing the
          board is a reading action: it belongs with what you are reading, not
          with what you are about to type. */}
      <GoalFilterBar
        value={filters}
        onChange={setFilters}
        allTags={full.allTags}
        shown={summary.goals.length}
        total={full.goals.length}
        hiddenSubs={view.hiddenSubs}
      />

      {/* ── Add a goal ────────────────────────────────────────────────── */}
      {canManage && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <Input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMain()}
              placeholder="Add a goal, e.g. Launch the new storefront"
              aria-label="Add a goal"
              className="min-w-56 flex-1"
              maxLength={200}
            />
            <DateField
              value={newDate}
              onChange={setNewDate}
              placeholder="Target date"
              className="w-44"
            />
            {/* Tagged at creation, not afterwards: a tag added on the way past is
                a tag that exists, and the filter above is only as good as the
                tags people actually bothered to set. */}
            <GoalTagInput
              value={newTags}
              onChange={setNewTags}
              suggestions={full.allTags}
              className="w-56"
            />
            <Button onClick={addMain} disabled={!newGoal.trim() || create.isPending} size="sm">
              <Plus className="h-4 w-4" /> Add goal
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Goals ─────────────────────────────────────────────────────── */}
      {summary.goals.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Target className="text-muted-foreground/40 mx-auto h-8 w-8" />
            {/* An empty board and a board emptied BY A FILTER are different
                problems with different fixes, so they get different words and
                the filtered one gets the button that undoes it. */}
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
                  size="sm"
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
          {summary.goals.map((goal) => {
            // A parent stripped of every visible sub-goal by the filter IS STILL
            // A PARENT. Reading leaf-ness off `children.length` would hand it a
            // status dropdown, and the server derives a parent's status from its
            // sub-goals - so whatever was picked would be silently overwritten.
            const isLeaf = !goal.progressIsDerived
            const hiddenHere =
              (fullChildCount.get(goal.id) ?? goal.children.length) - goal.children.length
            return (
              <Card key={goal.id} className={cn("overflow-hidden", !goal.isActive && "opacity-60")}>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3 p-4 sm:p-5">
                  <div className="min-w-48 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={cn(
                          "leading-tight font-semibold",
                          STATUS_STYLE[goal.status].title,
                        )}
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
                    </div>
                    <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {fmtDate(goal.targetDate)}
                      </span>
                      {!isLeaf && (
                        <span className="tabular-nums">
                          {goal.doneChildren} of {goal.countableChildren} counted sub-goals done
                        </span>
                      )}
                      {hiddenHere > 0 && (
                        <span className="italic">
                          {hiddenHere} sub-goal{hiddenHere === 1 ? "" : "s"} hidden by filters
                        </span>
                      )}
                      {goal.createdByName && <span>set by {goal.createdByName}</span>}
                    </p>
                    {/* Under the meta line, not up beside the status badge: tags
                        are how you FIND this goal again, not part of how it is
                        doing, and putting them next to the status chip makes a
                        row of coloured pills that all look like states. */}
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
                  </div>

                  {isLeaf ? (
                    statusControl(goal)
                  ) : (
                    <div className="w-36 shrink-0">
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground text-[10px] tracking-widest uppercase">
                          Progress
                        </span>
                        <span className="text-sm font-semibold tabular-nums">{goal.progress}%</span>
                      </div>
                      <ProgressBar value={goal.progress} className="mt-1.5" />
                    </div>
                  )}

                  {rowActions(goal)}
                </div>

                {goal.children.length > 0 && (
                  <div className="border-border/60 bg-muted/30 divide-border/60 divide-y border-t">
                    {goal.children.map((sub) => (
                      <div key={sub.id}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 pl-6 sm:pl-8">
                          <span
                            aria-hidden
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              STATUS_STYLE[sub.status].dot,
                            )}
                          />
                          <div className="min-w-36 flex-1">
                            <p className={cn("text-sm", STATUS_STYLE[sub.status].title)}>
                              {sub.title}
                            </p>
                            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                              <CalendarDays className="h-3 w-3" />
                              {fmtDate(sub.targetDate)}
                              {sub.overdue && (
                                <span className="text-destructive font-medium">past target</span>
                              )}
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
                          </div>
                          {statusControl(sub)}
                          {rowActions(sub)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {canManage && goal.isActive && (
                  <div className="border-border/60 border-t px-4 py-2.5 sm:px-5">
                    {subFor === goal.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          autoFocus
                          value={subTitle}
                          onChange={(e) => setSubTitle(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addSub(goal.id)}
                          placeholder="What needs to happen?"
                          aria-label="Sub-goal title"
                          className="min-w-48 flex-1"
                          maxLength={200}
                        />
                        <DateField
                          value={subDate}
                          onChange={setSubDate}
                          placeholder="Target date"
                          className="w-44"
                        />
                        <GoalTagInput
                          value={subTags}
                          onChange={setSubTags}
                          suggestions={full.allTags}
                          className="w-52"
                        />
                        <Button
                          size="sm"
                          onClick={() => addSub(goal.id)}
                          disabled={!subTitle.trim()}
                        >
                          Add
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSubFor(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-7"
                        onClick={() => {
                          setSubFor(goal.id)
                          setSubTitle("")
                          setSubDate("")
                          setSubTags([])
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add sub-goal
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <DeleteDialog
        goal={deleting}
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={(permanent) => {
          if (deleting) remove.mutate({ id: deleting.id, permanent })
          setDeleting(null)
        }}
      />
      {/* Keyed by the goal so each one opens a fresh form seeded from its own
          values - no effect, and no stale title from the last goal edited. */}
      {editing && (
        <EditDialog
          key={editing.id}
          goal={editing}
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
  tone?: "bad" | "muted"
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
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
        {suffix && <span className="text-muted-foreground text-sm font-normal"> {suffix}</span>}
      </p>
    </div>
  )
}
