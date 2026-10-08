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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/shared/spinner"
import { DateField, toDateString } from "@/components/shared/date-field"
import { useAssignableEmployees, useProjectTeams } from "../hooks/use-projects"
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

// One form plans (owed: due date) and logs (made: completion date). A new entry saves first, then the
// dialog stays open in edit mode so files can be attached.

const NONE = "__none__"
/** "Nobody yet - the team owes it." Only offered while the work is still owed. */
const TEAM = "__team__"

interface TaskOption {
  id: string
  title: string
  status: string
  assigneeId: string | null
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
  canStaff,
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
  /** `count` > 1 means a repeat, so the parent shouldn't open "the" row in edit mode. */
  onCreated: (id: string, count: number) => void
  /** Admin / account manager: may log on behalf of anyone on the project. */
  canManage: boolean
  /** A project manager OR a team manager (planning differs from logging for others). Defaults to `canManage`. */
  canStaff?: boolean
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
  /** Save at this status in the same request, e.g. "Log delivery" on an owed row. */
  submitStatus?: DeliverableStatus
  submitLabel?: string
}) {
  // Keyed remount by the parent, so state seeds straight from props.
  // An owed line may stay with "the team"; logging it needs a maker (picked deliberately if they can pick).
  const seedOwed = isOpenStatus(submitStatus ?? entry?.status ?? initial?.status ?? "DELIVERED")
  const [employeeId, setEmployeeId] = React.useState(
    entry
      ? (entry.employee?.id ?? (seedOwed || (canStaff ?? canManage) ? TEAM : currentUserId))
      : currentUserId,
  )
  const [teamId, setTeamId] = React.useState(entry?.team?.id ?? NONE)
  const [type, setType] = React.useState(entry?.type ?? initial?.type ?? "")
  const [title, setTitle] = React.useState(entry?.title ?? initial?.title ?? "")
  const [quantity, setQuantity] = React.useState(String(entry?.quantity ?? 1))
  const [startedOn, setStartedOn] = React.useState(entry?.startedOn ?? initial?.startedOn ?? "")
  const [completedOn, setCompletedOn] = React.useState(
    entry?.completedOn ?? toDateString(new Date()),
  )
  const [dueOn, setDueOn] = React.useState(entry?.dueOn ?? initial?.dueOn ?? "")
  // Repeat applies to new owed work only, so editing one week never re-lays the rest.
  const [repeatEvery, setRepeatEvery] = React.useState<"NONE" | "WEEK" | "MONTH">("NONE")
  const [repeatCount, setRepeatCount] = React.useState("4")
  const [goalId, setGoalId] = React.useState(entry?.goal?.id ?? initial?.goalId ?? NONE)
  // Once somebody picks a goal by hand, choosing a task stops overwriting it.
  const [goalTouched, setGoalTouched] = React.useState(Boolean(entry?.goal?.id ?? initial?.goalId))
  const [links, setLinks] = React.useState<string[]>(entry?.links ?? initial?.links ?? [])
  const [linkDraft, setLinkDraft] = React.useState("")
  const [notes, setNotes] = React.useState(entry?.notes ?? "")
  const [taskId, setTaskId] = React.useState(entry?.task?.id ?? initial?.taskId ?? NONE)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const typeListId = React.useId()

  const assigns = canStaff ?? canManage
  const m = useDeliverableMutations(projectId)
  const people = useAssignableEmployees(projectId, assigns)
  const teams = useProjectTeams(projectId)
  // Every project task, not just the maker's: work gets logged against unassigned tasks too.
  const tasks = useQuery({
    queryKey: ["project-tasks-for", projectId],
    queryFn: () =>
      apiFetch<{ data: TaskOption[] }>(`/api/projects/${projectId}/tasks`).then((r) => r.data),
    enabled: open && !!projectId,
    staleTime: 60_000,
  })

  const editing = Boolean(entry)
  /** Logging an existing owed line as delivered - neither an edit nor a new entry. */
  const logging = Boolean(entry && submitStatus && !isOpenStatus(submitStatus))
  const pending = m.create.isPending || m.update.isPending
  const qty = Number(quantity)

  // The status after this saves decides which date is asked for.
  const status: DeliverableStatus = submitStatus ?? entry?.status ?? initial?.status ?? "DELIVERED"
  const owed = isOpenStatus(status)

  // A local calendar can be a day ahead of UTC (01:00 in Delhi); the server allows the same.
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

  // Own tasks first, then unowned ones; other people's tasks are a manager's business.
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
  // Inherit the task's goal unless one was picked by hand.
  const effectiveGoalId = goalTouched ? goalId : (chosenTask?.goal?.id ?? goalId)
  const inheritedGoal = !goalTouched && chosenTask?.goal ? chosenTask.goal.title : null

  // Memoised: a bare `?? []` would make every memo below recompute.
  const teamList = React.useMemo(() => teams.data?.data ?? [], [teams.data])
  const roster = React.useMemo(() => people.data?.data ?? [], [people.data])
  const teamName = teamList.find((t) => t.id === teamId)?.name ?? null
  const teamMemberIds = React.useMemo(() => {
    const t = teamList.find((x) => x.id === teamId)
    if (!t) return new Set<string>()
    const ids = new Set<string>(
      (t.members ?? []).map((mem) => mem.employee?.id).filter(Boolean) as string[],
    )
    if (t.managerId) ids.add(t.managerId)
    return ids
  }, [teamList, teamId])
  const onTeam = React.useMemo(
    () => (teamId === NONE ? [] : roster.filter((p) => teamMemberIds.has(p.id))),
    [roster, teamMemberIds, teamId],
  )
  const offTeam = React.useMemo(
    () => (teamId === NONE ? roster : roster.filter((p) => !teamMemberIds.has(p.id))),
    [roster, teamMemberIds, teamId],
  )

  /** Choosing a team drops a person who is not on it back to "the team". */
  function pickTeam(next: string) {
    setTeamId(next)
    if (next === NONE || employeeId === TEAM) return
    const t = teamList.find((x) => x.id === next)
    if (!t) return
    const ids = new Set((t.members ?? []).map((mem) => mem.employee?.id))
    if (t.managerId) ids.add(t.managerId)
    if (!ids.has(employeeId) && owed) setEmployeeId(TEAM)
  }

  /** Choosing a person fills the team in from them, when none was set. */
  function pickPerson(next: string) {
    setEmployeeId(next)
    if (next === TEAM || teamId !== NONE) return
    const theirs = teamList.find(
      (t) => t.managerId === next || (t.members ?? []).some((mem) => mem.employee?.id === next),
    )
    if (theirs) setTeamId(theirs.id)
  }

  const toTeam = employeeId === TEAM
  const canRepeat = owed && !entry
  const repeatN = Number(repeatCount)
  const repeats = canRepeat && repeatEvery !== "NONE"
  const valid =
    // "Leave it to the team" is only valid while the work is owed.
    (!toTeam || (owed && teamId !== NONE)) &&
    (!repeats ||
      (dueOn.length > 0 && Number.isInteger(repeatN) && repeatN >= 2 && repeatN <= 52)) &&
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
      // null = "nobody yet"; the server accepts it only on owed work, with a team.
      employeeId: toTeam ? null : employeeId,
      teamId: teamId === NONE ? null : teamId,
      type: type.trim(),
      title: title.trim(),
      quantity: qty,
      startedOn: startedOn || null,
      // Owed work has no completion date; sending today would claim it landed.
      completedOn: owed ? null : completedOn,
      dueOn: dueOn || null,
      goalId: effectiveGoalId === NONE ? null : effectiveGoalId,
      links,
      notes: notes.trim() || null,
      taskId: taskId === NONE ? null : taskId,
      ...(submitStatus || (!entry && initial?.status) ? { status } : {}),
      ...(repeats ? { repeat: { every: repeatEvery as "WEEK" | "MONTH", count: repeatN } } : {}),
    }
    if (entry) {
      m.update.mutate({ id: entry.id, ...body }, { onSuccess: () => onOpenChange(false) })
    } else {
      m.create.mutate(body, {
        onSuccess: (created) => {
          if (created.created > 1) onOpenChange(false)
          onCreated(created.id, created.created)
        },
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {logging
              ? entry?.status === "REJECTED"
                ? "Redeliver"
                : "Log delivery"
              : editing
                ? "Edit deliverable"
                : owed
                  ? "Plan a deliverable"
                  : "Log a deliverable"}
          </DialogTitle>
          <DialogDescription>
            {editing && !logging
              ? "Change the details, or attach the files it produced."
              : (prompt ??
                (owed
                  ? "What this client is owed, and when. Nothing is recorded as made until somebody marks it delivered."
                  : "What was made, for whom, and when it was finished. Files can be attached once it is saved."))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Team first, then person; picking a person with no team set fills the team in. */}
          {assigns && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label required={toTeam} className="text-muted-foreground text-[11px]">
                  Team
                </Label>
                <Select value={teamId} onValueChange={pickTeam}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Which team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>
                      <span className="text-muted-foreground">
                        {toTeam ? "Pick a team" : "From the maker"}
                      </span>
                    </SelectItem>
                    {(teams.data?.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        <span className="text-muted-foreground ml-2 text-[11px]">
                          {t.members?.length ?? 0}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label required={!owed && toTeam} className="text-muted-foreground text-[11px]">
                  {owed ? "Assign to" : "Made by"}
                </Label>
                <Select value={employeeId} onValueChange={pickPerson}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={owed ? "Who will make it" : "Who made it"} />
                  </SelectTrigger>
                  <SelectContent>
                    {owed && (
                      <SelectItem value={TEAM}>
                        <span className="text-muted-foreground">
                          {teamName ? `Leave it to ${teamName}` : "Leave it to the team"}
                        </span>
                      </SelectItem>
                    )}
                    {onTeam.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-[11px]">{teamName}</SelectLabel>
                        {onTeam.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.firstName} {p.lastName}
                            {p.id === currentUserId ? " (you)" : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {/* Never a hard filter: work does get handed to people outside the team. */}
                    {offTeam.length > 0 && (
                      <SelectGroup>
                        {onTeam.length > 0 && (
                          <SelectLabel className="text-[11px]">Everyone else</SelectLabel>
                        )}
                        {offTeam.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.firstName} {p.lastName}
                            {p.id === currentUserId ? " (you)" : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
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
            {owed ? (
              <div className="space-y-1.5">
                <Label required={repeats} className="text-muted-foreground text-[11px]">
                  Due {repeats ? "(first one)" : "(optional)"}
                </Label>
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

          {/* Each repeat is its own owed row, so one week can change without touching the rest. */}
          {canRepeat && (
            <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[11px]">Repeat</Label>
                <Select
                  value={repeatEvery}
                  onValueChange={(v) => setRepeatEvery(v as typeof repeatEvery)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">
                      <span className="text-muted-foreground">Just once</span>
                    </SelectItem>
                    <SelectItem value="WEEK">Every week</SelectItem>
                    <SelectItem value="MONTH">Every month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {repeats && (
                <div className="space-y-1.5">
                  <Label required className="text-muted-foreground text-[11px]">
                    How many
                  </Label>
                  <Input
                    type="number"
                    min={2}
                    max={52}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(e.target.value)}
                  />
                </div>
              )}
              {repeats && (
                <p className="text-muted-foreground text-[11px] sm:col-span-2">
                  {Number.isInteger(repeatN) && repeatN >= 2 && repeatN <= 52 && dueOn
                    ? `${repeatN} owed rows, one ${repeatEvery === "WEEK" ? "a week" : "a month"} from ${dueOn}.`
                    : "Pick a first due date and how many times it repeats (2-52)."}
                </p>
              )}
            </div>
          )}

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
                  Nothing assigned to {makerName} here - pick an unassigned task or leave it.
                </p>
              )}
            </div>
            {/* A deliverable with no goal still counts as output; it just moves no target. */}
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

// Re-exported so row renderers have one import path for the deliverables UI.
export { formatHours }
