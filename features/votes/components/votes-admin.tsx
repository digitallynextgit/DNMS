"use client"

/** Admin / HR page: create events, add options, publish, close, and watch the live counts. */

import * as React from "react"
import {
  CheckSquare,
  Clock,
  ImagePlus,
  Lock,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  Unlock,
  Users,
  Vote,
} from "lucide-react"

import { cn, formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatStrip } from "@/components/shared/stat-strip"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { DateField, toDateString } from "@/components/shared/date-field"
import { TimeField } from "@/components/shared/time-field"
import {
  useAddAllEmployees,
  useAddVoteOption,
  useCreateVoteEvent,
  useDeleteVoteEvent,
  useDeleteVoteOption,
  useUpdateVoteEvent,
  useUpdateVoteOption,
  useUploadOptionPhoto,
  useVoteCandidates,
  useVoteEvents,
} from "../hooks/use-votes"
import { OPTION_PHOTO_TYPES, VOTE_STATUS_COLORS, VOTE_STATUS_LABELS } from "../constants"
import type { VoteEventStatus, VoteEventView, VoteOptionEmployee, VoteOptionView } from "../types"

type Filter = "ALL" | VoteEventStatus
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "DRAFT", label: "Drafts" },
  { value: "CLOSED", label: "Closed" },
]

type OptionTarget = { event: VoteEventView; option?: VoteOptionView }

export function VotesAdmin() {
  const { data, isPending } = useVoteEvents("manage")
  const events = data ?? []
  const { data: candidateData } = useVoteCandidates()
  const candidates = candidateData ?? []
  const update = useUpdateVoteEvent()
  const remove = useDeleteVoteEvent()
  const removeOption = useDeleteVoteOption()

  const [filter, setFilter] = React.useState<Filter>("ALL")
  const [editing, setEditing] = React.useState<VoteEventView | "new" | null>(null)
  const [publishing, setPublishing] = React.useState<VoteEventView | null>(null)
  const [closing, setClosing] = React.useState<VoteEventView | null>(null)
  const [removing, setRemoving] = React.useState<VoteEventView | null>(null)
  const [optionTarget, setOptionTarget] = React.useState<OptionTarget | null>(null)
  const [removingOption, setRemovingOption] = React.useState<OptionTarget | null>(null)

  const shown = filter === "ALL" ? events : events.filter((e) => e.status === filter)
  const openCount = events.filter((e) => e.status === "OPEN").length
  const votesCast = events.reduce((n, e) => n + (e.totalVotes ?? 0), 0)
  const eligible = events.find((e) => e.eligibleVoters !== null)?.eligibleVoters ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Votes & Events"
        description="Create an event and every employee goes on the ballot, admins left out. Publish it and each employee votes once. Ballots are secret: you see counts, never names."
        actions={
          <Button className="gap-1.5" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" />
            New event
          </Button>
        }
      />

      <StatStrip
        loading={isPending}
        items={[
          { label: "Events", value: events.length, icon: Vote },
          {
            label: "Open now",
            value: openCount,
            icon: Clock,
            tone: openCount > 0 ? "success" : "default",
          },
          { label: "Votes cast", value: votesCast, icon: CheckSquare },
          {
            label: "Eligible voters",
            value: eligible ?? "-",
            icon: Users,
            isText: eligible === null,
          },
        ]}
      />

      <SegmentedControl value={filter} onChange={setFilter} options={FILTERS} />

      {isPending && <Skeleton className="h-48 rounded-sm" />}

      {!isPending && shown.length === 0 && (
        <EmptyState
          icon={Vote}
          title={events.length === 0 ? "No events yet" : "Nothing here"}
          description={
            events.length === 0
              ? "Create the first event, add at least two options, then publish it."
              : "No events with this status."
          }
          action={
            events.length === 0
              ? { label: "New event", onClick: () => setEditing("new") }
              : undefined
          }
        />
      )}

      <div className="space-y-4">
        {shown.map((e) => (
          <AdminEventCard
            key={e.id}
            event={e}
            missing={
              candidates.filter((c) => !e.options.some((o) => o.employee?.id === c.id)).length
            }
            onEdit={() => setEditing(e)}
            onDelete={() => setRemoving(e)}
            onPublish={() => setPublishing(e)}
            onClose={() => setClosing(e)}
            onReopen={() => update.mutate({ id: e.id, body: { close: false } })}
            onAddOption={() => setOptionTarget({ event: e })}
            onEditOption={(option) => setOptionTarget({ event: e, option })}
            onDeleteOption={(option) => setRemovingOption({ event: e, option })}
          />
        ))}
      </div>

      {editing !== null && (
        <EventFormDialog
          key={editing === "new" ? "new" : editing.id}
          event={editing === "new" ? null : editing}
          candidateCount={candidates.length}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}

      {optionTarget && (
        <OptionFormDialog
          key={optionTarget.option?.id ?? `new-${optionTarget.event.id}`}
          event={optionTarget.event}
          option={optionTarget.option ?? null}
          candidates={candidates}
          open
          onOpenChange={(o) => !o && setOptionTarget(null)}
        />
      )}

      <ConfirmDialog
        open={publishing !== null}
        onOpenChange={(o) => !o && setPublishing(null)}
        title="Publish this vote?"
        description={
          publishing
            ? `Every eligible employee gets a notification. Voting ${
                publishing.opensAt && new Date(publishing.opensAt) > new Date()
                  ? `opens ${formatDateTime(publishing.opensAt)}`
                  : "opens right away"
              } and closes ${formatDateTime(publishing.closesAt)}.`
            : ""
        }
        confirmLabel="Publish"
        isLoading={update.isPending}
        onConfirm={() =>
          publishing &&
          update.mutate(
            { id: publishing.id, body: { publish: true } },
            { onSuccess: () => setPublishing(null) },
          )
        }
      />

      <ConfirmDialog
        open={closing !== null}
        onOpenChange={(o) => !o && setClosing(null)}
        title="Close voting now?"
        description="No more votes can be cast, and everyone sees the results. You can reopen it while the closing time is still ahead."
        confirmLabel="Close voting"
        isLoading={update.isPending}
        onConfirm={() =>
          closing &&
          update.mutate(
            { id: closing.id, body: { close: true } },
            { onSuccess: () => setClosing(null) },
          )
        }
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this event?"
        description={`"${removing?.title ?? ""}" is deleted with its options, photos and every vote cast. This cannot be undone.`}
        confirmLabel="Delete event"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() =>
          removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }
      />

      <ConfirmDialog
        open={removingOption !== null}
        onOpenChange={(o) => !o && setRemovingOption(null)}
        title="Remove this option?"
        description={
          removingOption
            ? `"${removingOption.option?.label ?? ""}" is removed from "${removingOption.event.title}". ${
                removingOption.option?.votes
                  ? `The ${removingOption.option.votes} vote(s) already cast for it are lost.`
                  : "Nobody has voted for it yet."
              }`
            : ""
        }
        confirmLabel="Remove option"
        variant="destructive"
        isLoading={removeOption.isPending}
        onConfirm={() =>
          removingOption?.option &&
          removeOption.mutate(removingOption.option.id, {
            onSuccess: () => setRemovingOption(null),
          })
        }
      />
    </div>
  )
}

interface AdminEventCardProps {
  event: VoteEventView
  /** Eligible employees not yet on this ballot. */
  missing: number
  onEdit: () => void
  onDelete: () => void
  onPublish: () => void
  onClose: () => void
  onReopen: () => void
  onAddOption: () => void
  onEditOption: (option: VoteOptionView) => void
  onDeleteOption: (option: VoteOptionView) => void
}

function AdminEventCard({ event, missing, ...actions }: AdminEventCardProps) {
  const upload = useUploadOptionPhoto()
  const addAll = useAddAllEmployees()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [photoFor, setPhotoFor] = React.useState<string | null>(null)

  const total = event.totalVotes ?? 0
  const turnout = event.eligibleVoters ? Math.round((total / event.eligibleVoters) * 100) : 0
  const locked = event.status === "CLOSED"
  const canReopen = event.canReopen

  return (
    <article className="bg-card border-border rounded-sm border">
      <header className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{event.title}</h3>
            <StatusBadge
              status={event.status}
              colorMap={VOTE_STATUS_COLORS}
              labelMap={VOTE_STATUS_LABELS}
            />
          </div>
          {event.description && (
            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">
              {event.description}
            </p>
          )}
          <p className="text-muted-foreground mt-1 text-xs">
            {event.opensAt ? `Opens ${formatDateTime(event.opensAt)} · ` : ""}
            Closes {formatDateTime(event.closesAt)}
            {event.closedAt ? ` · closed early ${formatDateTime(event.closedAt)}` : ""}
          </p>
          {event.status === "DRAFT" && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Only admins and HR can see this draft. Click Publish to open voting for everyone.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {event.status === "DRAFT" && (
            <Button
              className="gap-1.5"
              onClick={actions.onPublish}
              disabled={event.options.length < 2}
              title={event.options.length < 2 ? "Add at least two options first" : undefined}
            >
              <Megaphone className="h-4 w-4" />
              Publish
            </Button>
          )}
          {(event.status === "OPEN" || event.status === "UPCOMING") && (
            <Button variant="outline" className="gap-1.5" onClick={actions.onClose}>
              <Lock className="h-4 w-4" />
              Close voting
            </Button>
          )}
          {canReopen && (
            <Button variant="outline" className="gap-1.5" onClick={actions.onReopen}>
              <Unlock className="h-4 w-4" />
              Reopen
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Edit event" onClick={actions.onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete event" onClick={actions.onDelete}>
            <Trash2 className="text-destructive h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="border-border border-b px-5 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Turnout</span>
          <span className="tabular-nums">
            {total} of {event.eligibleVoters ?? "?"} voted · {turnout}%
          </span>
        </div>
        <Progress value={turnout} className="mt-2" />
      </div>

      <div className="divide-border divide-y">
        {event.options.length === 0 && (
          <p className="text-muted-foreground px-5 py-4 text-sm">
            No options yet. Add at least two to publish.
          </p>
        )}
        {event.options.map((o) => {
          const pct = total > 0 ? Math.round(((o.votes ?? 0) / total) * 100) : 0
          const leading = event.winnerOptionIds.includes(o.id)
          return (
            <div key={o.id} className="flex items-center gap-3 px-5 py-3">
              <AvatarDisplay
                src={o.photoUrl}
                firstName={o.employee?.firstName ?? o.label}
                lastName={o.employee?.lastName ?? ""}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{o.label}</span>
                  {o.employee && (
                    <span className="text-muted-foreground text-xs">{o.employee.employeeNo}</span>
                  )}
                  {leading && <Trophy className="h-4 w-4 shrink-0 text-amber-500" />}
                </div>
                {o.description && (
                  <p className="text-muted-foreground truncate text-xs">{o.description}</p>
                )}
                <div className="mt-1.5 flex items-center gap-2">
                  <Progress value={pct} className="h-1.5 max-w-xs flex-1" />
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {o.votes ?? 0} · {pct}%
                  </span>
                </div>
              </div>
              {!locked && (
                <div className="flex items-center gap-0.5">
                  {!o.employee && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={o.hasPhoto ? "Replace photo" : "Upload photo"}
                      disabled={upload.isPending}
                      onClick={() => {
                        setPhotoFor(o.id)
                        fileRef.current?.click()
                      }}
                    >
                      <ImagePlus className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit option"
                    onClick={() => actions.onEditOption(o)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove option"
                    onClick={() => actions.onDeleteOption(o)}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!locked && (
        <footer className="border-border flex flex-wrap gap-2 border-t px-5 py-3">
          {missing > 0 && (
            <Button
              className="gap-1.5"
              disabled={addAll.isPending}
              onClick={() => addAll.mutate(event.id)}
            >
              <Users className="h-4 w-4" />
              Add all employees ({missing})
            </Button>
          )}
          <Button variant="outline" className="gap-1.5" onClick={actions.onAddOption}>
            <Plus className="h-4 w-4" />
            Add one option
          </Button>
        </footer>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={OPTION_PHOTO_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && photoFor) upload.mutate({ optionId: photoFor, file })
          e.target.value = ""
        }}
      />
    </article>
  )
}

function splitDateTime(value: string | null): { date: string; time: string } {
  if (!value) return { date: "", time: "" }
  const d = new Date(value)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return { date: toDateString(d), time: `${hh}:${mm}` }
}

/** Local date + time from the pickers to the ISO instant the API stores. */
function joinDateTime(date: string, time: string): string {
  return new Date(`${date}T${time || "00:00"}:00`).toISOString()
}

function defaultClose(): { date: string; time: string } {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return { date: toDateString(d), time: "18:00" }
}

function EventFormDialog({
  event,
  candidateCount,
  open,
  onOpenChange,
}: {
  event: VoteEventView | null
  candidateCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateVoteEvent()
  const update = useUpdateVoteEvent()
  const isEdit = event !== null

  const [allEmployees, setAllEmployees] = React.useState(true)
  const [title, setTitle] = React.useState(event?.title ?? "")
  const [description, setDescription] = React.useState(event?.description ?? "")
  const [opensLater, setOpensLater] = React.useState(Boolean(event?.opensAt))
  const [opens, setOpens] = React.useState(splitDateTime(event?.opensAt ?? null))
  const [closes, setCloses] = React.useState(() =>
    event ? splitDateTime(event.closesAt) : defaultClose(),
  )

  const pending = create.isPending || update.isPending
  const valid =
    title.trim().length >= 3 && Boolean(closes.date) && (!opensLater || Boolean(opens.date))

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const body = {
      title: title.trim(),
      description: description.trim(),
      opensAt: opensLater && opens.date ? joinDateTime(opens.date, opens.time || "09:00") : "",
      closesAt: joinDateTime(closes.date, closes.time),
    }
    if (event) update.mutate({ id: event.id, body }, { onSuccess: () => onOpenChange(false) })
    else create.mutate({ ...body, allEmployees }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit event" : "New event"}
      description={
        isEdit ? undefined : "It stays a draft until you publish it, so you can check it first."
      }
      isEdit={isEdit}
      isPending={pending}
      submitDisabled={!valid}
      submitLabel={isEdit ? "Save changes" : "Create draft"}
      onSubmit={submit}
      size="sm"
    >
      <div className="space-y-2">
        <Label required htmlFor="vote-title">
          Event name
        </Label>
        <Input
          id="vote-title"
          placeholder="e.g. Best Rangoli"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vote-description">Description</Label>
        <Textarea
          id="vote-description"
          rows={3}
          placeholder="What people are voting for, and anything they should know."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </div>

      {!isEdit && (
        <div className="border-border flex items-center justify-between gap-3 rounded-sm border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Put every employee on the ballot</p>
            <p className="text-muted-foreground text-xs">
              {candidateCount > 0 ? `${candidateCount} employees. ` : ""}Admins are left out. Off:
              add the options yourself, such as teams or entries with photos.
            </p>
          </div>
          <Switch checked={allEmployees} onCheckedChange={setAllEmployees} />
        </div>
      )}

      <div className="border-border flex items-center justify-between gap-3 rounded-sm border px-3 py-2">
        <div>
          <p className="text-sm font-medium">Opens at a set time</p>
          <p className="text-muted-foreground text-xs">Off: voting opens the moment you publish.</p>
        </div>
        <Switch checked={opensLater} onCheckedChange={setOpensLater} />
      </div>

      {opensLater && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label required>Opens on</Label>
            <DateField
              value={opens.date}
              onChange={(v) => setOpens((s) => ({ ...s, date: v }))}
              modal
            />
          </div>
          <div className="space-y-2">
            <Label>Time</Label>
            <TimeField
              value={opens.time || "09:00"}
              onChange={(v) => setOpens((s) => ({ ...s, time: v }))}
              modal
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label required>Closes on</Label>
          <DateField
            value={closes.date}
            onChange={(v) => setCloses((s) => ({ ...s, date: v }))}
            modal
          />
        </div>
        <div className="space-y-2">
          <Label>Time</Label>
          <TimeField
            value={closes.time}
            onChange={(v) => setCloses((s) => ({ ...s, time: v }))}
            modal
          />
        </div>
      </div>
    </FormDialog>
  )
}

function OptionFormDialog({
  event,
  option,
  candidates,
  open,
  onOpenChange,
}: {
  event: VoteEventView
  option: VoteOptionView | null
  /** Active employees, admins left out. */
  candidates: VoteOptionEmployee[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const add = useAddVoteOption()
  const edit = useUpdateVoteOption()
  const isEdit = option !== null

  const [mode, setMode] = React.useState<"employee" | "custom">(
    option && !option.employee ? "custom" : "employee",
  )
  const [employeeId, setEmployeeId] = React.useState<string | null>(option?.employee?.id ?? null)
  const [query, setQuery] = React.useState("")
  const [label, setLabel] = React.useState(option?.label ?? "")
  const [description, setDescription] = React.useState(option?.description ?? "")
  const [photo, setPhoto] = React.useState<File | null>(null)

  // Someone already in the running cannot be added twice.
  const taken = new Set(event.options.map((o) => o.employee?.id).filter(Boolean))
  const q = query.trim().toLowerCase()
  const people = candidates
    .filter((p) => !taken.has(p.id))
    .filter((p) => !q || `${p.firstName} ${p.lastName} ${p.employeeNo}`.toLowerCase().includes(q))
    .slice(0, 40)

  const pending = add.isPending || edit.isPending
  const valid = isEdit
    ? label.trim().length > 0
    : mode === "employee"
      ? Boolean(employeeId)
      : label.trim().length > 0

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (option) {
      edit.mutate(
        { optionId: option.id, body: { label: label.trim(), description: description.trim() } },
        { onSuccess: () => onOpenChange(false) },
      )
      return
    }
    add.mutate(
      {
        eventId: event.id,
        body:
          mode === "employee"
            ? { employeeId, description: description.trim() }
            : { label: label.trim(), description: description.trim() },
        photo: mode === "custom" ? photo : null,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit option" : `Add option to "${event.title}"`}
      isEdit={isEdit}
      isPending={pending}
      submitDisabled={!valid}
      submitLabel={isEdit ? "Save changes" : "Add option"}
      onSubmit={submit}
      size="sm"
    >
      {!isEdit && (
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: "employee", label: "An employee" },
            { value: "custom", label: "Custom entry" },
          ]}
        />
      )}

      {!isEdit && mode === "employee" && (
        <div className="space-y-2">
          <Label required>Employee</Label>
          <Input
            placeholder="Search by name or employee no."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="border-border max-h-56 overflow-y-auto rounded-sm border">
            {people.length === 0 && (
              <p className="text-muted-foreground p-3 text-sm">No one matches.</p>
            )}
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setEmployeeId(p.id)}
                className={cn(
                  "hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                  employeeId === p.id && "bg-accent",
                )}
              >
                <AvatarDisplay
                  src={p.profilePhoto}
                  firstName={p.firstName}
                  lastName={p.lastName}
                  size="sm"
                />
                <span className="truncate">
                  {p.firstName} {p.lastName}
                </span>
                <span className="text-muted-foreground ml-auto text-xs">{p.employeeNo}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(isEdit || mode === "custom") && (
        <div className="space-y-2">
          <Label required htmlFor="option-label">
            Name
          </Label>
          <Input
            id="option-label"
            placeholder="e.g. Design team rangoli"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="option-description">Short note</Label>
        <Input
          id="option-description"
          placeholder="Optional, e.g. 2nd floor, near the pantry"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
        />
      </div>

      {!isEdit && mode === "custom" && (
        <div className="space-y-2">
          <Label htmlFor="option-photo">Photo</Label>
          <Input
            id="option-photo"
            type="file"
            accept={OPTION_PHOTO_TYPES.join(",")}
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          <p className="text-muted-foreground text-xs">
            JPG, PNG or WEBP up to 10 MB. You can add or change it later from the list too.
          </p>
        </div>
      )}
    </FormDialog>
  )
}
