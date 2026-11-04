"use client"

/** The employee page: open events to vote in, upcoming ones, and results once voting closes. */

import * as React from "react"
import { CheckCircle2, Trophy, Vote } from "lucide-react"

import { cn, formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { StatusBadge } from "@/components/shared/status-badge"
import { useCastBallot, useVoteEvents } from "../hooks/use-votes"
import { VOTE_STATUS_COLORS, VOTE_STATUS_LABELS } from "../constants"
import type { VoteEventView, VoteOptionView } from "../types"

export function VotesBoard() {
  const { data, isPending } = useVoteEvents("mine")
  const events = data ?? []
  const groups = [
    { title: "Open now", items: events.filter((e) => e.status === "OPEN") },
    { title: "Coming up", items: events.filter((e) => e.status === "UPCOMING") },
    { title: "Results", items: events.filter((e) => e.status === "CLOSED") },
  ].filter((g) => g.items.length > 0)
  const adminReader = events.some((e) => !e.isVoter)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Votes"
        description="One vote per person per event. You can change your vote until voting closes."
      />

      {adminReader && (
        <p className="border-border bg-muted/40 text-muted-foreground rounded-sm border px-4 py-3 text-sm">
          Admins run the votes and do not cast a ballot. Results show here once voting closes.
        </p>
      )}

      {isPending && (
        <div className="space-y-3">
          <Skeleton className="h-56 rounded-sm" />
          <Skeleton className="h-56 rounded-sm" />
        </div>
      )}

      {!isPending && events.length === 0 && (
        <EmptyState
          icon={Vote}
          title="No votes yet"
          description="When an event opens for voting it will show up here."
        />
      )}

      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {g.title}
          </h2>
          {g.items.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </section>
      ))}
    </div>
  )
}

function windowText(e: VoteEventView): string {
  if (e.status === "UPCOMING" && e.opensAt) return `Opens ${formatDateTime(e.opensAt)}`
  if (e.status === "OPEN") return `Closes ${formatDateTime(e.closesAt)}`
  return `Closed ${formatDateTime(e.closedAt ?? e.closesAt)}`
}

function EventCard({ event }: { event: VoteEventView }) {
  const cast = useCastBallot()
  // The pick is only local until it is submitted; the server's ballot is the truth.
  const [picked, setPicked] = React.useState<string | null>(null)
  const selected = picked ?? event.myOptionId
  const showResults = event.totalVotes !== null
  const canSubmit = event.canVote && selected !== null && selected !== event.myOptionId
  const [query, setQuery] = React.useState("")
  const q = query.trim().toLowerCase()
  // Finished events read as a leaderboard; open ones keep the ballot order.
  const ordered =
    event.status === "CLOSED" && showResults
      ? [...event.options].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
      : event.options
  const shown = q ? ordered.filter((o) => o.label.toLowerCase().includes(q)) : ordered

  return (
    <article className="bg-card border-border rounded-sm border">
      <header className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{event.title}</h3>
          {event.description && (
            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">
              {event.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <StatusBadge
            status={event.status}
            colorMap={VOTE_STATUS_COLORS}
            labelMap={VOTE_STATUS_LABELS}
          />
          <span className="text-muted-foreground text-xs">{windowText(event)}</span>
        </div>
      </header>

      {event.options.length > 9 && (
        <div className="px-5 pt-4">
          <Input
            placeholder="Search a name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>
      )}

      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((o) => (
          <OptionTile
            key={o.id}
            option={o}
            total={event.totalVotes ?? 0}
            selected={selected === o.id}
            mine={event.myOptionId === o.id}
            winner={event.winnerOptionIds.includes(o.id)}
            showResults={showResults}
            selectable={event.canVote && !o.isMe}
            onSelect={() => setPicked(o.id)}
          />
        ))}
        {shown.length === 0 && (
          <p className="text-muted-foreground text-sm">No one matches that name.</p>
        )}
      </div>

      {event.canVote && (
        <footer className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <p className="text-muted-foreground text-sm">
            {event.myOptionId
              ? "Your vote is in. Pick another option to change it."
              : "Pick an option, then submit your vote."}
          </p>
          <Button
            disabled={!canSubmit || cast.isPending}
            onClick={() =>
              selected &&
              cast.mutate(
                { eventId: event.id, optionId: selected },
                { onSuccess: () => setPicked(null) },
              )
            }
          >
            {event.myOptionId ? "Change vote" : "Submit vote"}
          </Button>
        </footer>
      )}

      {event.status === "OPEN" && !event.isVoter && (
        <footer className="border-border text-muted-foreground border-t px-5 py-3 text-sm">
          Results appear here when voting closes.
        </footer>
      )}

      {event.status === "UPCOMING" && (
        <footer className="border-border text-muted-foreground border-t px-5 py-3 text-sm">
          Voting has not opened yet.
        </footer>
      )}

      {showResults && (
        <footer className="border-border text-muted-foreground border-t px-5 py-3 text-sm">
          {event.totalVotes} {event.totalVotes === 1 ? "vote" : "votes"}
          {event.eligibleVoters ? ` from ${event.eligibleVoters} eligible voters` : ""}
          {event.winnerOptionIds.length > 1 ? " · it is a tie" : ""}
        </footer>
      )}
    </article>
  )
}

interface OptionTileProps {
  option: VoteOptionView
  total: number
  selected: boolean
  mine: boolean
  winner: boolean
  showResults: boolean
  selectable: boolean
  onSelect: () => void
}

function OptionTile({
  option: o,
  total,
  selected,
  mine,
  winner,
  showResults,
  selectable,
  onSelect,
}: OptionTileProps) {
  const pct = showResults && total > 0 ? Math.round(((o.votes ?? 0) / total) * 100) : 0
  const first = o.employee?.firstName ?? o.label
  const last = o.employee?.lastName ?? ""

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "border-border bg-background flex items-center gap-3 rounded-sm border p-3 text-left transition",
        selectable ? "hover:border-primary/60 cursor-pointer" : "cursor-default",
        o.isMe && !showResults && "opacity-60",
        selected && selectable && "border-primary ring-primary/30 ring-2",
        winner && "border-amber-500/60",
      )}
    >
      <AvatarDisplay
        src={o.photoUrl}
        firstName={first}
        lastName={last}
        size="xl"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{o.label}</span>
          {o.isMe && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              You
            </Badge>
          )}
          {winner && <Trophy className="h-4 w-4 shrink-0 text-amber-500" />}
        </div>
        {o.description && <p className="text-muted-foreground truncate text-xs">{o.description}</p>}
        {showResults && (
          <div className="mt-2 flex items-center gap-2">
            <Progress value={pct} className="h-1.5 flex-1" />
            <span className="text-muted-foreground w-16 shrink-0 text-right text-xs tabular-nums">
              {o.votes ?? 0} · {pct}%
            </span>
          </div>
        )}
        {mine && (
          <Badge variant="secondary" className="mt-1.5 gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" />
            Your vote
          </Badge>
        )}
      </div>
    </button>
  )
}
