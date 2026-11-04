"use client"

/** Admin / HR page: create events, add options, publish, close, and watch the live counts. */

import * as React from "react"
import {
  CheckCircle2,
  CheckSquare,
  Clock,
  Crown,
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
import { useNow } from "../hooks/use-now"
import { OPTION_PHOTO_TYPES, VOTE_STATUS_COLORS, VOTE_STATUS_LABELS } from "../constants"
import { employeeLabel, rankByVotes, timeLeft } from "../lib/vote-rules"
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
        description="Run company votes. You see live standings, who voted for whom and who has not voted yet."
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
            onToggleVoteChange={(on) => update.mutate({ id: e.id, body: { allowVoteChange: on } })}
            togglingVoteChange={update.isPending && update.variables?.id === e.id}
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
  /** Turn changing a cast vote on or off for this event, right from the card. */
  onToggleVoteChange: (on: boolean) => void
  togglingVoteChange: boolean
  onAddOption: () => void
  onEditOption: (option: VoteOptionView) => void
  onDeleteOption: (option: VoteOptionView) => void
}

const MEDAL_BADGE: Record<number, string> = {
  1: "bg-amber-400 text-amber-950",
  2: "bg-slate-300 text-slate-900",
  3: "bg-orange-400 text-orange-950",
}

function AdminEventCard({ event, missing, ...actions }: AdminEventCardProps) {
  const upload = useUploadOptionPhoto()
  const addAll = useAddAllEmployees()
  const now = useNow()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [photoFor, setPhotoFor] = React.useState<string | null>(null)

  const total = event.totalVotes ?? 0
  const eligible = event.eligibleVoters ?? 0
  const turnout = eligible > 0 ? Math.round((total / eligible) * 100) : 0
  const locked = event.status === "CLOSED"
  const published = event.status !== "DRAFT"
  // Once voting has started the list reads as standings; a draft keeps its ballot order.
  const rows = published
    ? rankByVotes(event.options)
    : [...event.options].sort((a, b) => a.position - b.position).map((item) => ({ item, rank: 0 }))
  const notVoted = event.notVoted ?? []
  const left =
    event.status === "OPEN" && now > 0 ? timeLeft(new Date(event.closesAt).getTime() - now) : null

  return (
    <article className="bg-card border-border overflow-hidden rounded-sm border">
      <header className="border-border relative border-b px-5 py-4">
        <div className="from-primary/10 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-sm">
              {locked ? <Trophy className="h-5 w-5" /> : <Vote className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base leading-tight font-semibold">{event.title}</h3>
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
              <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5" />
                {event.opensAt ? `Opens ${formatDateTime(event.opensAt)} · ` : ""}
                Closes {formatDateTime(event.closesAt)}
                {left && <span className="text-foreground font-medium">· {left}</span>}
                {event.closedAt ? ` · closed early ${formatDateTime(event.closedAt)}` : ""}
              </p>
              {event.status === "DRAFT" && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Only admins and HR can see this draft. Click Publish to open voting for everyone.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {!locked && (
              <label
                htmlFor={`vote-change-${event.id}`}
                title={
                  event.allowVoteChange
                    ? "People can switch their vote until voting closes. Turn off to make votes final."
                    : "Votes are final. Turn on to let people switch their vote."
                }
                className={cn(
                  "border-border flex h-9 cursor-pointer items-center gap-2 rounded-sm border px-2.5 text-sm select-none",
                  event.allowVoteChange && "border-emerald-500/50 bg-emerald-500/5",
                )}
              >
                <Switch
                  id={`vote-change-${event.id}`}
                  checked={event.allowVoteChange}
                  disabled={actions.togglingVoteChange}
                  onCheckedChange={actions.onToggleVoteChange}
                />
                <span className="whitespace-nowrap">
                  Vote changes{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      event.allowVoteChange
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {event.allowVoteChange ? "on" : "off"}
                  </span>
                </span>
              </label>
            )}
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
            {event.canReopen && (
              <Button variant="outline" className="gap-1.5" onClick={actions.onReopen}>
                <Unlock className="h-4 w-4" />
                Reopen
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Edit event" onClick={actions.onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete event"
              onClick={actions.onDelete}
            >
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="border-border flex items-center justify-between border-b px-5 py-2.5">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {published ? "Standings" : "Ballot"}
            </h4>
            <span className="text-muted-foreground text-xs">
              {event.options.length} {event.options.length === 1 ? "nominee" : "nominees"}
            </span>
          </div>

          {event.options.length === 0 && (
            <p className="text-muted-foreground px-5 py-6 text-sm">
              No options yet. Add at least two to publish.
            </p>
          )}

          <ol className="divide-border divide-y">
            {rows.map(({ item: o, rank }) => {
              const votes = o.votes ?? 0
              const pct = total > 0 ? Math.round((votes / total) * 100) : 0
              const medal = published && votes > 0 ? MEDAL_BADGE[rank] : undefined
              return (
                <li key={o.id} className="group flex items-start gap-3 px-5 py-3">
                  <span
                    className={cn(
                      "mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                      medal ?? "text-muted-foreground",
                    )}
                  >
                    {published ? rank : "·"}
                  </span>
                  <AvatarDisplay
                    src={o.photoUrl}
                    firstName={o.employee?.firstName ?? o.label}
                    lastName={o.employee?.lastName ?? ""}
                    size="md"
                    className="rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{o.label}</span>
                      {o.employee && (
                        <span className="text-muted-foreground text-xs">
                          {o.employee.employeeNo}
                        </span>
                      )}
                      {published && rank === 1 && votes > 0 && (
                        <Crown className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                      )}
                    </div>
                    {o.description && (
                      <p className="text-muted-foreground truncate text-xs">{o.description}</p>
                    )}
                    {published && (
                      <div className="mt-1.5 flex items-center gap-3">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="w-28 shrink-0 text-right text-xs tabular-nums">
                          <span className="font-semibold">{votes}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            {votes === 1 ? "vote" : "votes"} · {pct}%
                          </span>
                        </span>
                      </div>
                    )}
                    {o.voters && o.voters.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {o.voters.map((v) => (
                          <span
                            key={v.id}
                            title={`Voted ${formatDateTime(v.votedAt)}`}
                            className="bg-muted inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-[11px]"
                          >
                            <AvatarDisplay
                              src={v.profilePhoto}
                              firstName={v.firstName}
                              lastName={v.lastName}
                              size="xs"
                              className="rounded-full"
                            />
                            {employeeLabel(v.firstName, v.lastName)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!locked && (
                    <div className="flex items-center gap-0.5 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
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
                </li>
              )
            })}
          </ol>
        </section>

        <aside className="border-border space-y-5 border-t p-5 lg:border-t-0 lg:border-l">
          <TurnoutRing pct={turnout} voted={total} eligible={eligible} />
          {!published && (
            <p className="text-muted-foreground text-xs">
              Turnout and who still has to vote show here once you publish.
            </p>
          )}
          {published && notVoted.length === 0 && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Everyone has voted.
            </p>
          )}
          {published && notVoted.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Not voted yet · {notVoted.length}
              </p>
              <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {notVoted.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <AvatarDisplay
                      src={p.profilePhoto}
                      firstName={p.firstName}
                      lastName={p.lastName}
                      size="chip"
                      className="rounded-full"
                    />
                    <span className="truncate">{employeeLabel(p.firstName, p.lastName)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
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

/** Share of eligible employees who have voted, as a ring. */
function TurnoutRing({ pct, voted, eligible }: { pct: number; voted: number; eligible: number }) {
  const r = 32
  const c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
          {pct > 0 && (
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct / 100)}
              className="stroke-primary transition-[stroke-dashoffset] duration-500"
            />
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
          {pct}%
        </span>
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums">
          {voted}
          <span className="text-muted-foreground text-base font-normal"> / {eligible}</span>
        </p>
        <p className="text-muted-foreground text-xs">employees have voted</p>
      </div>
    </div>
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
  const [allowVoteChange, setAllowVoteChange] = React.useState(event?.allowVoteChange ?? false)
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
      allowVoteChange,
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
          <p className="text-sm font-medium">Let people change their vote</p>
          <p className="text-muted-foreground text-xs">
            Off: the first vote is final. On: people can switch until voting closes.
          </p>
        </div>
        <Switch checked={allowVoteChange} onCheckedChange={setAllowVoteChange} />
      </div>

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
