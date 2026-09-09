"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Link2, Plus, Trash2, Upload, X, ExternalLink, FileText } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/shared/spinner"
import { DateField, toDateString } from "@/components/shared/date-field"
import { useAssignableEmployees } from "../hooks/use-projects"
import { useProjectGoals } from "../hooks/use-goals"
import {
  useDeliverableMutations,
  type DeliverableRow,
  type DeliverableStatus,
} from "../hooks/use-deliverables"
import { isOpenStatus, latestCalendarDay } from "../lib/deliverable-lifecycle"
import { isSafeHttpUrl, linkLabel } from "../lib/task-links"
import { MAX_LINKS, MAX_QUANTITY, MAX_TYPE_LENGTH } from "../lib/deliverable-types"
import { formatHours } from "../lib/format-hours"
import { SearchPicker } from "./search-picker"

// ─────────────────────────────────────────────────────────────────────────────
// Logging what was made.
//
// TWO STEPS, ONE DIALOG. Files need an entry to hang off, so a new entry is
// saved first and the dialog then stays open in edit mode with the Files
// section revealed - "Logged. Add files below." Closing after the first step is
// fine; the entry exists and files can come later from the row's edit button.
//
// The type is free text with a type-ahead: the project's own vocabulary first,
// then the team's starter set (see lib/deliverable-types.ts). The server snaps
// a match onto the existing casing, so "reel" cannot split "Reel"'s count.
//
// ── THE SAME FORM PLANS AND LOGS ─────────────────────────────────────────────
// A deliverable that is OWED and one that was MADE are the same row at two
// points in its life, so they get one form. What changes is which date is
// asked for: owed work has a DUE date and no completion, made work has the
// reverse. `initial.status` opens it in the right mode; `submitStatus` moves
// the row on save, which is how the capture prompt turns a planned row into a
// delivered one without a second dialog.
// ─────────────────────────────────────────────────────────────────────────────

const NONE = "__none__"

interface TaskOption {
  id: string
  title: string
  status: string
  assigneeId: string | null
  /** The goal this work serves, so the entry can inherit it. */
  goal?: { id: string; title: string } | null
}

/** The goal picker's options, flattened: "Launch storefront › Product pages". */
interface GoalOption {
  id: string
  label: string
}

export function DeliverableFormDialog({
  projectId,
  open,
  onOpenChange,
  entry,
  onCreated,
  canManage,
  currentUserId,
  suggestedTypes,
  initial,
  prompt,
  submitStatus,
  submitLabel,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Set = editing this row (and files are attachable). Null = new. */
  entry: DeliverableRow | null
  /** Called with the new id so the parent can flip the dialog into edit mode. */
  onCreated: (id: string) => void
  /** Admin / account manager: may log on behalf of anyone on the project. */
  canManage: boolean
  currentUserId: string
  suggestedTypes: string[]
  /** Prefill for a NEW entry - the capture prompt seeds these from the task. */
  initial?: {
    title?: string
    links?: string[]
    taskId?: string | null
    startedOn?: string | null
    type?: string
    /** Opens the form as a PLAN (due date, no completion) rather than a log. */
    status?: DeliverableStatus
    dueOn?: string | null
    goalId?: string | null
  }
  /** Replaces the default description - the capture prompt's "what did it produce?" */
  prompt?: string
  /**
   * Save the row AT this status rather than leaving it where it is.
   *
   * The one thing a plain edit cannot do: "Mark delivered" on an owed row is a
   * status move and a form save at once, and doing it as two requests leaves a
   * window where the row is delivered with last week's details on it.
   */
  submitStatus?: DeliverableStatus
  /** Overrides the primary button's text - "Mark delivered", "Plan it". */
  submitLabel?: string
}) {
  // Keyed remount by the parent (key={entry?.id ?? "new"}), so state seeds
  // straight from props with no effect.
  const [employeeId, setEmployeeId] = React.useState(entry?.employee.id ?? currentUserId)
  const [type, setType] = React.useState(entry?.type ?? initial?.type ?? "")
  const [title, setTitle] = React.useState(entry?.title ?? initial?.title ?? "")
  const [quantity, setQuantity] = React.useState(String(entry?.quantity ?? 1))
  const [startedOn, setStartedOn] = React.useState(entry?.startedOn ?? initial?.startedOn ?? "")
  const [completedOn, setCompletedOn] = React.useState(
    entry?.completedOn ?? toDateString(new Date()),
  )
  const [dueOn, setDueOn] = React.useState(entry?.dueOn ?? initial?.dueOn ?? "")
  const [goalId, setGoalId] = React.useState(entry?.goal?.id ?? initial?.goalId ?? NONE)
  // Once somebody picks a goal by hand, choosing a task stops overwriting it.
  const [goalTouched, setGoalTouched] = React.useState(Boolean(entry?.goal?.id ?? initial?.goalId))
  const [links, setLinks] = React.useState<string[]>(entry?.links ?? initial?.links ?? [])
  const [linkDraft, setLinkDraft] = React.useState("")
  const [notes, setNotes] = React.useState(entry?.notes ?? "")
  const [taskId, setTaskId] = React.useState(entry?.task?.id ?? initial?.taskId ?? NONE)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const typeListId = React.useId()

  const m = useDeliverableMutations(projectId)
  const people = useAssignableEmployees(projectId, canManage)
  // Every task on the project, grouped in the picker by who holds it. Fetching
  // only the maker's own tasks looked broken the moment somebody logged work
  // for a task that was never assigned to them (or to anyone).
  const tasks = useQuery({
    queryKey: ["project-tasks-for", projectId],
    queryFn: () =>
      apiFetch<{ data: TaskOption[] }>(`/api/projects/${projectId}/tasks`).then((r) => r.data),
    enabled: open && !!projectId,
    staleTime: 60_000,
  })

  const editing = Boolean(entry)
  const pending = m.create.isPending || m.update.isPending
  const qty = Number(quantity)

  // Where the row will BE once this saves - which decides whether it needs a
  // completion date or a due date, not where it happens to be right now.
  const status: DeliverableStatus = submitStatus ?? entry?.status ?? initial?.status ?? "DELIVERED"
  const owed = isOpenStatus(status)

  // The furthest day a picker may legitimately point at. A local calendar can
  // be a day ahead of UTC, so "today" alone would reject a perfectly ordinary
  // entry logged at 01:00 in Delhi; the server applies the same tolerance.
  const maxDay = React.useMemo(() => latestCalendarDay().toISOString().slice(0, 10), [])
  const future = (d: string) => Boolean(d) && d > maxDay

  const goals = useProjectGoals(projectId)
  const goalOptions = React.useMemo<GoalOption[]>(() => {
    const out: GoalOption[] = []
    for (const g of goals.data?.goals ?? []) {
      out.push({ id: g.id, label: g.title })
      for (const sub of g.children) out.push({ id: sub.id, label: `${g.title} › ${sub.title}` })
    }
    return out
  }, [goals.data])

  const chosenTask = (tasks.data ?? []).find((t) => t.id === taskId)

  // Own tasks first, then the unowned ones anybody may claim. Other people's
  // tasks are a manager's business - a maker attaching their output to a
  // colleague's task is a mistake, not a feature.
  const taskGroups = React.useMemo(() => {
    const all = tasks.data ?? []
    const mine = all.filter((t) => t.assigneeId === employeeId)
    const unassigned = all.filter((t) => !t.assigneeId)
    const others = canManage ? all.filter((t) => t.assigneeId && t.assigneeId !== employeeId) : []
    return { mine, unassigned, others, total: mine.length + unassigned.length + others.length }
  }, [tasks.data, employeeId, canManage])
  const maker = (people.data?.data ?? []).find((p) => p.id === employeeId)
  const makerName =
    employeeId === currentUserId ? "you" : maker ? `${maker.firstName} ${maker.lastName}` : "them"
  // The task already knows which goal it serves; making somebody restate it is
  // how the two end up disagreeing.
  const effectiveGoalId = goalTouched ? goalId : (chosenTask?.goal?.id ?? goalId)
  const inheritedGoal = !goalTouched && chosenTask?.goal ? chosenTask.goal.title : null

  const valid =
    type.trim().length > 0 &&
    type.trim().length <= MAX_TYPE_LENGTH &&
    title.trim().length > 0 &&
    Number.isInteger(qty) &&
    qty >= 1 &&
    qty <= MAX_QUANTITY &&
    (owed || completedOn.length > 0) &&
    !future(startedOn) &&
    (owed || !future(completedOn)) &&
    (owed || !startedOn || startedOn <= completedOn)

  const addLink = () => {
    const l = linkDraft.trim()
    if (!l) return
    if (!isSafeHttpUrl(l)) return
    if (links.includes(l) || links.length >= MAX_LINKS) return
    setLinks([...links, l])
    setLinkDraft("")
  }

  const submit = () => {
    if (!valid) return
    const body = {
      employeeId,
      type: type.trim(),
      title: title.trim(),
      quantity: qty,
      startedOn: startedOn || null,
      // Owed work has not been completed, and sending today's date "to fill the
      // column" would make the ledger claim it landed.
      completedOn: owed ? null : completedOn,
      dueOn: dueOn || null,
      goalId: effectiveGoalId === NONE ? null : effectiveGoalId,
      links,
      notes: notes.trim() || null,
      taskId: taskId === NONE ? null : taskId,
      ...(submitStatus || (!entry && initial?.status) ? { status } : {}),
    }
    if (entry) {
      m.update.mutate({ id: entry.id, ...body }, { onSuccess: () => onOpenChange(false) })
    } else {
      m.create.mutate(body, { onSuccess: (created) => onCreated(created.id) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit deliverable" : owed ? "Plan a deliverable" : "Log a deliverable"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Change the details, or attach the files it produced."
              : (prompt ??
                (owed
                  ? "What this client is owed, and when. Nothing is recorded as made until somebody marks it delivered."
                  : "What was made, for whom, and when it was finished. Files can be attached once it is saved."))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {canManage && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Made by</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Who made it" />
                </SelectTrigger>
                <SelectContent>
                  {(people.data?.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                      {p.id === currentUserId ? " (you)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
            <div className="space-y-1.5">
              <Label required className="text-muted-foreground text-[11px]">
                Type
              </Label>
              <Input
                list={typeListId}
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Video, Reel, Product page, Banner…"
                aria-label="Type of deliverable"
                maxLength={MAX_TYPE_LENGTH}
                autoFocus={!editing}
              />
              <datalist id={typeListId}>
                {suggestedTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              {suggestedTypes.length > 0 && !type && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {suggestedTypes.slice(0, 8).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className="border-border text-muted-foreground hover:text-foreground rounded-sm border px-1.5 py-0.5 text-[11px]"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label required className="text-muted-foreground text-[11px]">
                Quantity
              </Label>
              <Input
                type="number"
                min={1}
                max={MAX_QUANTITY}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                aria-label="Quantity"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label required className="text-muted-foreground text-[11px]">
              Title
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. Product launch teaser, 30s"
              aria-label="Title"
              maxLength={200}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Started (optional)</Label>
              <DateField value={startedOn} onChange={setStartedOn} placeholder="Started on" modal />
              {future(startedOn) && (
                <p className="text-destructive text-[11px]">That is in the future.</p>
              )}
            </div>
            {/* Owed work is asked WHEN IT IS DUE; made work is asked when it
                landed. Showing both would invite somebody to fill in a
                completion date for a thing that does not exist yet. */}
            {owed ? (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[11px]">Due (optional)</Label>
                <DateField value={dueOn} onChange={setDueOn} placeholder="Due on" modal />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[11px]">Completed</Label>
                <DateField
                  value={completedOn}
                  onChange={setCompletedOn}
                  placeholder="Completed on"
                  modal
                />
                {future(completedOn) && (
                  <p className="text-destructive text-[11px]">That is in the future.</p>
                )}
                {startedOn && completedOn && startedOn > completedOn && (
                  <p className="text-destructive text-[11px]">Started after it was completed.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">From task (optional)</Label>
              <SearchPicker
                value={taskId}
                onChange={setTaskId}
                loading={tasks.isPending}
                noneLabel="Not from a task"
                searchPlaceholder="Search tasks…"
                emptyText={
                  (tasks.data ?? []).length === 0
                    ? "No tasks on this project yet"
                    : `No tasks assigned to ${makerName} on this project`
                }
                groups={[
                  { label: `Assigned to ${makerName}`, tasks: taskGroups.mine },
                  { label: "Unassigned", tasks: taskGroups.unassigned },
                  { label: "Other people's tasks", tasks: taskGroups.others },
                ]
                  .filter((g) => g.tasks.length > 0)
                  .map((g) => ({
                    label: g.label,
                    options: g.tasks.map((t) => ({ id: t.id, label: t.title })),
                  }))}
              />
              {tasks.isSuccess && taskGroups.mine.length === 0 && taskGroups.total > 0 && (
                <p className="text-muted-foreground text-[11px]">
                  Nothing assigned to {makerName} here — pick an unassigned task or leave it.
                </p>
              )}
            </div>
            {/* Which promise this counts against. A deliverable with no goal
                still counts as output; it just does not move any target. */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Goal (optional)</Label>
              <SearchPicker
                value={effectiveGoalId}
                onChange={(v) => {
                  setGoalTouched(true)
                  setGoalId(v)
                }}
                loading={goals.isPending}
                noneLabel="No goal"
                searchPlaceholder="Search goals…"
                emptyText="No goals on this project yet"
                groups={[{ label: "", options: goalOptions }]}
              />
              {inheritedGoal && (
                <p className="text-muted-foreground text-[11px]">From the task: {inheritedGoal}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Links</Label>
            <div className="flex gap-2">
              <Input
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addLink()
                  }
                }}
                placeholder="https://… the Drive folder, the live page"
                aria-label="Add a link"
                className={cn(linkDraft && !isSafeHttpUrl(linkDraft) && "border-destructive")}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addLink}
                disabled={!isSafeHttpUrl(linkDraft)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {links.length > 0 && (
              <ul className="space-y-1">
                {links.map((l) => (
                  <li key={l} className="flex items-center gap-2 text-xs">
                    <Link2 className="text-muted-foreground h-3 w-3 shrink-0" />
                    <a
                      href={l}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
                    >
                      {linkLabel(l)}
                    </a>
                    <button
                      type="button"
                      onClick={() => setLinks(links.filter((x) => x !== l))}
                      aria-label="Remove link"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Notes (optional)</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth knowing about it"
              maxLength={2000}
            />
          </div>

          {/* ── Files: only once the entry exists ──────────────────────────── */}
          {entry && (
            <div className="border-border/60 space-y-1.5 border-t pt-3">
              <Label className="text-muted-foreground text-[11px]">Files</Label>
              <ul className="space-y-1">
                {entry.files.map((f) => (
                  <li
                    key={f.id}
                    className="bg-muted/40 flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-xs"
                  >
                    <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate" title={f.fileName}>
                      {f.fileName}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {(f.fileSize / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => m.removeFile.mutate(f.id)}
                      title="Remove"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  for (const file of Array.from(e.target.files ?? []))
                    m.upload.mutate({ id: entry.id, file })
                  e.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-1.5 border-dashed"
                disabled={m.upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                {m.upload.isPending ? <Spinner size="sm" /> : <Upload className="h-3.5 w-3.5" />}
                Upload files
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {editing ? "Close" : "Cancel"}
          </Button>
          <Button onClick={submit} disabled={!valid || pending}>
            {pending ? <Spinner size="sm" /> : null}
            {submitLabel ?? (editing ? "Save changes" : owed ? "Plan it" : "Log it")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Referenced so the format helper stays available to row renderers that import
// from here; keeps one import path for the deliverables UI.
export { formatHours }
