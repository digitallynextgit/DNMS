"use client"

/**
 * Polls, events and shared contacts - the parts of a message that are neither
 * text nor a file.
 *
 * Composers and renderers live together because they are two halves of one
 * shape: change what a poll can hold and both sides have to move. Shared by
 * personal chat and project messages; the only thing either surface supplies is
 * the endpoint to post to.
 */

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  BarChart3,
  CalendarDays,
  MapPin,
  Mail,
  Phone,
  Plus,
  X,
  Search,
  Download,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { DateField, toDateString } from "@/components/shared/date-field"
import { EmployeeProfileDialog } from "@/components/shared/employee-profile-dialog"
import { TimeField } from "@/components/shared/time-field"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ─── shapes ─────────────────────────────────────────────────────────────────

export interface PollCardData {
  id: string
  question: string
  allowMultiple: boolean
  closesAt: string | null
  closed: boolean
  voterCount: number
  options: {
    id: string
    label: string
    count: number
    share: number
    mine: boolean
    voters: { id: string; firstName: string; lastName: string; profilePhoto: string | null }[]
  }[]
}

export interface EventCardData {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  location: string | null
  notes: string | null
}

export interface ContactCardData {
  id: string
  employeeId: string | null
  name: string
  email: string | null
  phone: string | null
  designation: string | null
  photo: string | null
}

/** What a surface hands the composers so a card knows where to post. */
export interface CardEndpoint {
  /** POST target that creates the message AND the card. */
  createUrl: string
  /** Query keys to refresh once something lands. */
  invalidate: unknown[][]
}

// ─── poll ───────────────────────────────────────────────────────────────────

export function PollComposer({
  open,
  onOpenChange,
  endpoint,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  endpoint: CardEndpoint
}) {
  const qc = useQueryClient()
  const [question, setQuestion] = React.useState("")
  // Each option carries a stable id so React keys survive a mid-list removal
  // (UI-08) - keying by array index moved focus/caret to a different option when
  // one above it was deleted.
  const newOption = () => ({ id: crypto.randomUUID(), text: "" })
  const [options, setOptions] = React.useState<{ id: string; text: string }[]>(() => [
    newOption(),
    newOption(),
  ])
  const [allowMultiple, setAllowMultiple] = React.useState(false)

  function reset() {
    setQuestion("")
    setOptions([newOption(), newOption()])
    setAllowMultiple(false)
  }

  const create = useMutation({
    mutationFn: () =>
      apiFetch(endpoint.createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "poll",
          question,
          options: options.map((o) => o.text),
          allowMultiple,
        }),
      }),
    onSuccess: () => {
      for (const key of endpoint.invalidate) qc.invalidateQueries({ queryKey: key })
      reset()
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filled = options.filter((o) => o.text.trim()).length
  const valid = question.trim().length > 0 && filled >= 2

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-md lg:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4 text-amber-500" />
            New poll
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Question</Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What are we deciding?"
              aria-label="What are we deciding?"
              autoFocus
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Options</Label>
            {options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-1.5">
                <Input
                  value={opt.text}
                  onChange={(e) =>
                    setOptions((list) =>
                      list.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o)),
                    )
                  }
                  onKeyDown={(e) => {
                    // Enter adds the next option rather than submitting - a poll
                    // is usually more than two lines and reaching for the mouse
                    // between each one is the annoying part.
                    if (e.key === "Enter" && i === options.length - 1 && options.length < 12) {
                      e.preventDefault()
                      setOptions((list) => [...list, newOption()])
                    }
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="h-9 text-sm"
                />
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove option ${i + 1}`}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setOptions((list) => list.filter((o) => o.id !== opt.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 12 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setOptions((list) => [...list, newOption()])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add option
              </Button>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              checked={allowMultiple}
              onCheckedChange={(v) => setAllowMultiple(v === true)}
            />
            Allow more than one answer
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            Send poll
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PollCard({
  poll,
  onVoted,
  compact,
}: {
  poll: PollCardData
  onVoted?: () => void
  /** Inside a coloured bubble the bars need to sit on the bubble, not on a card. */
  compact?: boolean
}) {
  const vote = useMutation({
    mutationFn: (optionId: string) =>
      apiFetch(`/api/message-polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      }),
    onSuccess: () => onVoted?.(),
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className={cn("min-w-56 space-y-2", !compact && "bg-card rounded-sm border p-2.5")}>
      <div className="flex items-start gap-1.5">
        <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
        <p className="text-sm font-medium break-words">{poll.question}</p>
      </div>

      <div className="space-y-1">
        {poll.options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={poll.closed || vote.isPending}
            onClick={() => vote.mutate(o.id)}
            className={cn(
              "relative block w-full overflow-hidden rounded-sm border px-2 py-1.5 text-left transition-colors",
              o.mine ? "border-current" : "border-current/25 hover:border-current/50",
              poll.closed && "cursor-default",
            )}
          >
            {/* The bar is a background layer, so the label never reflows as the
                numbers move. */}
            <span
              className="absolute inset-y-0 left-0 bg-current opacity-15 transition-all"
              style={{ width: `${o.share}%` }}
              aria-hidden
            />
            <span className="relative flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs">
                {o.mine && "✓ "}
                {o.label}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums opacity-70">
                {o.count} · {o.share}%
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className="text-[10px] opacity-70">
        {poll.voterCount === 0
          ? "No votes yet"
          : `${poll.voterCount} ${poll.voterCount === 1 ? "person" : "people"} voted`}
        {poll.allowMultiple && " · pick as many as you like"}
        {poll.closed && " · closed"}
      </p>
    </div>
  )
}

// ─── event ──────────────────────────────────────────────────────────────────

/**
 * "2026-08-20" + "15:30" as a real instant.
 *
 * Built from the local parts rather than parsed from a string, so 3:30pm means
 * 3:30pm where the person typing it is sitting - `new Date("...T15:30")` and
 * `new Date("...T15:30Z")` differ by the whole offset, and only one of them is
 * what was meant.
 */
function toInstant(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number)
  const [hh, mm] = time.split(":").map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0)
}

/** The next half hour, so the common case is one click rather than four. */
function nextHalfHour(): string {
  const now = new Date()
  now.setSeconds(0, 0)
  now.setMinutes(now.getMinutes() > 30 ? 60 : 30)
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

export function EventComposer({
  open,
  onOpenChange,
  endpoint,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  endpoint: CardEndpoint
}) {
  const qc = useQueryClient()
  const [title, setTitle] = React.useState("")
  const [startDate, setStartDate] = React.useState("")
  const [startTime, setStartTime] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [endTime, setEndTime] = React.useState("")
  const [location, setLocation] = React.useState("")
  const [notes, setNotes] = React.useState("")

  function reset() {
    setTitle("")
    setStartDate("")
    setStartTime("")
    setEndDate("")
    setEndTime("")
    setLocation("")
    setNotes("")
  }

  // Seeded when the dialog opens, not during render: reading the clock while
  // rendering is what makes a server and client pass disagree.
  React.useEffect(() => {
    if (!open) return
    setStartDate((d) => d || toDateString(new Date()))
    setStartTime((t) => t || nextHalfHour())
  }, [open])

  const create = useMutation({
    mutationFn: () =>
      apiFetch(endpoint.createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "event",
          title,
          startsAt: toInstant(startDate, startTime).toISOString(),
          endsAt: hasEnd ? toInstant(endDate, endTime).toISOString() : null,
          location: location || null,
          notes: notes || null,
        }),
      }),
    onSuccess: () => {
      for (const key of endpoint.invalidate) qc.invalidateQueries({ queryKey: key })
      reset()
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const hasStart = !!startDate && !!startTime
  const hasEnd = !!endDate && !!endTime
  // Half an end is not an end: one field filled and the other empty is a
  // mistake, not an intention, so say so rather than quietly dropping it.
  const halfEnd = !!endDate !== !!endTime
  const endsBeforeStart =
    hasEnd && hasStart && toInstant(endDate, endTime) <= toInstant(startDate, startTime)
  const valid = title.trim().length > 0 && hasStart && !halfEnd && !endsBeforeStart

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-xl lg:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-red-500" />
            New event
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Design review"
              aria-label="Design review"
              autoFocus
              className="h-9 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Starts</Label>
              {/* modal: the popover has to layer above the dialog it sits in. */}
              <DateField value={startDate} onChange={setStartDate} modal />
              <TimeField value={startTime} onChange={setStartTime} modal />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ends (optional)</Label>
              <DateField
                value={endDate}
                onChange={setEndDate}
                modal
                // Nothing can end before it starts, so those days are simply not
                // offered rather than rejected after the fact.
                disabled={startDate ? (date) => date < toInstant(startDate, "00:00") : undefined}
              />
              <TimeField value={endTime} onChange={setEndTime} modal />
            </div>
          </div>
          {halfEnd && (
            <p className="text-destructive text-[11px]">
              Pick both a date and a time for the end, or leave both empty.
            </p>
          )}
          {endsBeforeStart && (
            <p className="text-destructive text-[11px]">The end has to come after the start.</p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Where (optional)</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Meeting room / link"
              aria-label="Meeting room / link"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            Send event
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Escapes the characters iCalendar treats as syntax. */
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

function icsStamp(value: string | Date): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
}

export function EventCard({ event, compact }: { event: EventCardData; compact?: boolean }) {
  const start = new Date(event.startsAt)
  const end = event.endsAt ? new Date(event.endsAt) : null

  /**
   * A calendar file, built here rather than fetched: everything it needs is
   * already on screen, so a round trip would only add a way for it to fail.
   */
  function addToCalendar() {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//DNMS//Message event//EN",
      "BEGIN:VEVENT",
      `UID:${event.id}@dnms`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(start)}`,
      ...(end ? [`DTEND:${icsStamp(end)}`] : []),
      `SUMMARY:${icsEscape(event.title)}`,
      ...(event.location ? [`LOCATION:${icsEscape(event.location)}`] : []),
      ...(event.notes ? [`DESCRIPTION:${icsEscape(event.notes)}`] : []),
      "END:VEVENT",
      "END:VCALENDAR",
    ]
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${event.title.replace(/[^\w\s-]/g, "").trim() || "event"}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn("min-w-56 space-y-1.5", !compact && "bg-card rounded-sm border p-2.5")}>
      <div className="flex items-start gap-1.5">
        <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
        <p className="text-sm font-medium break-words">{event.title}</p>
      </div>

      <p className="text-xs opacity-80" suppressHydrationWarning>
        {start.toLocaleString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {end && ` – ${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
      </p>

      {event.location && (
        <p className="flex items-center gap-1 text-[11px] opacity-80">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{event.location}</span>
        </p>
      )}
      {event.notes && <p className="text-[11px] break-words opacity-70">{event.notes}</p>}

      <button
        type="button"
        onClick={addToCalendar}
        className="flex items-center gap-1 text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100"
      >
        <Download className="h-3 w-3" />
        Add to calendar
      </button>
    </div>
  )
}

// ─── contact ────────────────────────────────────────────────────────────────

interface Colleague {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  designation?: string | null
}

export function ContactComposer({
  open,
  onOpenChange,
  endpoint,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  endpoint: CardEndpoint
}) {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState("")

  const { data, isPending, error } = useQuery({
    queryKey: ["chat", "contacts", search],
    queryFn: async () =>
      (
        await apiFetch<{ data: { data: Colleague[] } }>(
          `/api/chat/contacts${search ? `?search=${encodeURIComponent(search)}` : ""}`,
        )
      ).data.data,
    enabled: open,
  })

  const share = useMutation({
    mutationFn: (employeeId: string) =>
      apiFetch(endpoint.createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "contact", employeeId }),
      }),
    onSuccess: () => {
      for (const key of endpoint.invalidate) qc.invalidateQueries({ queryKey: key })
      setSearch("")
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const people = data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md lg:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Share a contact</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search colleagues"
            aria-label="Search colleagues"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {isPending && <Skeleton className="h-40 rounded-sm" />}
          {!isPending && error && (
            <p className="text-destructive py-6 text-center text-xs">Could not load colleagues.</p>
          )}
          {!isPending && !error && people.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-xs">
              {search ? "Nobody matches that search." : "No other active employees found."}
            </p>
          )}
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={share.isPending}
              onClick={() => share.mutate(p.id)}
              className="hover:bg-muted flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left transition-colors"
            >
              <AvatarDisplay
                src={p.profilePhoto}
                firstName={p.firstName}
                lastName={p.lastName}
                size="sm"
              />
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {p.firstName} {p.lastName}
                </p>
                {p.designation && (
                  <p className="text-muted-foreground truncate text-[11px]">{p.designation}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ContactCard({ contact, compact }: { contact: ContactCardData; compact?: boolean }) {
  const [first = "", ...rest] = contact.name.split(" ")
  const [profileOpen, setProfileOpen] = React.useState(false)

  return (
    <div
      className={cn(
        "flex min-w-56 items-center gap-2.5",
        !compact && "bg-card rounded-sm border p-2.5",
      )}
    >
      <AvatarDisplay
        src={contact.photo}
        firstName={first}
        lastName={rest.join(" ")}
        size="md"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        {contact.employeeId ? (
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="block max-w-full truncate text-left text-sm font-medium underline-offset-2 hover:underline"
          >
            {contact.name}
          </button>
        ) : (
          <p className="truncate text-sm font-medium">{contact.name}</p>
        )}
        {contact.designation && (
          <p className="truncate text-[11px] opacity-70">{contact.designation}</p>
        )}
        {/* Real links: a contact card you cannot act on is a screenshot. */}
        <div className="mt-1 flex flex-wrap gap-2">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1 text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              <Mail className="h-3 w-3" />
              Email
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-1 text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              <Phone className="h-3 w-3" />
              {contact.phone}
            </a>
          )}
        </div>
      </div>

      <EmployeeProfileDialog
        employeeId={contact.employeeId}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </div>
  )
}

/** One entry point, so a bubble does not need to know which card it holds. */
export function MessageCards({
  poll,
  event,
  contact,
  onVoted,
  compact,
}: {
  poll?: PollCardData | null
  event?: EventCardData | null
  contact?: ContactCardData | null
  onVoted?: () => void
  compact?: boolean
}) {
  if (!poll && !event && !contact) return null
  return (
    <div className="space-y-1.5">
      {poll && <PollCard poll={poll} onVoted={onVoted} compact={compact} />}
      {event && <EventCard event={event} compact={compact} />}
      {contact && <ContactCard contact={contact} compact={compact} />}
    </div>
  )
}
