"use client"

/** The employee page: open events to vote in, with live standings, and results once closed. */

import * as React from "react"
import { CheckCircle2, Clock, Search, Trophy, Users, Vote } from "lucide-react"

import { cn, formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { StatusBadge } from "@/components/shared/status-badge"
import { useCastBallot, useVoteEvents } from "../hooks/use-votes"
import { useNow } from "../hooks/use-now"
import { rankByVotes, timeLeft } from "../lib/vote-rules"
import { VOTE_STATUS_COLORS, VOTE_STATUS_LABELS } from "../constants"
import { VotePodium } from "./vote-podium"
import type { VoteEventView, VoteOptionView } from "../types"

export function VotesBoard() {
  const { data, isPending } = useVoteEvents("mine")
  const events = data ?? []
  const groups = [
    { title: "Open now", items: events.filter((e) => e.status === "OPEN") },
    { title: "Coming up", items: events.filter((e) => e.status === "UPCOMING") },
    { title: "Results", items: events.filter((e) => e.status === "CLOSED") },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Votes"
        description="Vote for the nominee you like most. One vote each, and you can change it until voting closes. Standings update live, and admins and HR can see who voted for whom."
      />

      {isPending && (
        <div className="space-y-4">
          <Skeleton className="h-72 rounded-sm" />
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

function EventCard({ event }: { event: VoteEventView }) {
  const cast = useCastBallot()
  const now = useNow()
  const [picked, setPicked] = React.useState<string | null>(null)
  const [confirming, setConfirming] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const total = event.totalVotes ?? 0
  const eligible = event.eligibleVoters ?? 0
  const showResults = event.totalVotes !== null
  const turnout = eligible > 0 ? Math.round((total / eligible) * 100) : 0
  const isOpen = event.status === "OPEN"
  const isClosed = event.status === "CLOSED"

  const ranks = new Map(rankByVotes(event.options).map((r) => [r.item.id, r.rank]))
  const myOption = event.options.find((o) => o.id === event.myOptionId) ?? null
  const pickedOption = event.options.find((o) => o.id === picked) ?? null

  // Closed events read as a leaderboard; an open ballot keeps its name order, so it stays fair.
  const ordered = isClosed
    ? rankByVotes(event.options).map((r) => r.item)
    : [...event.options].sort((a, b) => a.position - b.position)
  const q = query.trim().toLowerCase()
  const shown = q ? ordered.filter((o) => o.label.toLowerCase().includes(q)) : ordered

  const when =
    event.status === "UPCOMING" && event.opensAt
      ? `Opens ${formatDateTime(event.opensAt)}`
      : isOpen
        ? now > 0
          ? timeLeft(new Date(event.closesAt).getTime() - now)
          : `Closes ${formatDateTime(event.closesAt)}`
        : `Closed ${formatDateTime(event.closedAt ?? event.closesAt)}`

  return (
    <article className="bg-card border-border overflow-hidden rounded-sm border">
      <header className="border-border relative border-b px-5 py-5 sm:px-6">
        <div className="from-primary/10 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-sm">
              {isClosed ? <Trophy className="h-5 w-5" /> : <Vote className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <h3 className="text-lg leading-tight font-semibold">{event.title}</h3>
              {event.description && (
                <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">
                  {event.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge
              status={event.status}
              colorMap={VOTE_STATUS_COLORS}
              labelMap={VOTE_STATUS_LABELS}
            />
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Clock className="h-3.5 w-3.5" />
              {when}
            </span>
          </div>
        </div>
        {showResults && eligible > 0 && (
          <div className="relative mt-4 flex items-center gap-3">
            <Users className="text-muted-foreground h-4 w-4 shrink-0" />
            <Progress value={turnout} className="h-1.5 max-w-60" />
            <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
              {total} of {eligible} have voted
            </span>
          </div>
        )}
      </header>

      {showResults && (
        <section className="border-border border-b px-5 pt-5 pb-0 sm:px-6">
          <div className="mb-6 flex items-center justify-between">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {isClosed
                ? event.winnerOptionIds.length > 1
                  ? "Winners · it is a tie"
                  : "Winner"
                : "Leading now"}
            </h4>
            {isOpen && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            )}
          </div>
          <VotePodium options={event.options} total={total} />
        </section>
      )}

      {myOption && (
        <div className="border-border flex flex-wrap items-center gap-2 border-b bg-emerald-500/5 px-5 py-3 text-sm sm:px-6">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>You voted for</span>
          <AvatarDisplay
            src={myOption.photoUrl}
            firstName={myOption.employee?.firstName ?? myOption.label}
            lastName={myOption.employee?.lastName ?? ""}
            size="chip"
            className="rounded-full"
          />
          <span className="font-semibold">{myOption.label}</span>
          {event.canVote && (
            <span className="text-muted-foreground">
              · to change it, pick someone else below and click Change vote
            </span>
          )}
        </div>
      )}

      <section className="px-5 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {event.canVote
              ? myOption
                ? "Change your vote"
                : "Pick your vote"
              : isClosed
                ? "Full results"
                : "Nominees"}{" "}
            · {event.options.length}
          </h4>
          {event.options.length > 8 && (
            <div className="relative w-full sm:w-64">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search a name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((o) => (
            <CandidateCard
              key={o.id}
              option={o}
              rank={ranks.get(o.id) ?? null}
              total={total}
              showResults={showResults}
              selected={picked === o.id && picked !== event.myOptionId}
              mine={event.myOptionId === o.id}
              winner={isClosed && event.winnerOptionIds.includes(o.id)}
              selectable={event.canVote}
              onSelect={() => setPicked(o.id === event.myOptionId ? null : o.id)}
            />
          ))}
        </div>
        {shown.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No one matches that name.
          </p>
        )}
      </section>

      {event.canVote && (
        <footer className="border-border bg-card/95 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 backdrop-blur sm:px-6">
          {pickedOption ? (
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <AvatarDisplay
                src={pickedOption.photoUrl}
                firstName={pickedOption.employee?.firstName ?? pickedOption.label}
                lastName={pickedOption.employee?.lastName ?? ""}
                size="sm"
                className="rounded-full"
              />
              <span className="text-muted-foreground">
                {myOption ? "Change to:" : "Your pick:"}
              </span>
              <span className="truncate font-semibold">{pickedOption.label}</span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {myOption
                ? "Pick someone else to change your vote. You can change it until voting closes."
                : "Tap a nominee to pick them. You can change your vote until voting closes."}
            </p>
          )}
          <Button
            disabled={!pickedOption || cast.isPending}
            onClick={() => setConfirming(true)}
            className="gap-1.5"
          >
            <Vote className="h-4 w-4" />
            {myOption ? "Change vote" : "Submit vote"}
          </Button>
        </footer>
      )}

      {event.status === "UPCOMING" && (
        <footer className="border-border text-muted-foreground border-t px-5 py-3 text-sm sm:px-6">
          Voting has not opened yet.
        </footer>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          myOption
            ? `Change your vote to ${pickedOption?.label ?? ""}?`
            : `Vote for ${pickedOption?.label ?? ""}?`
        }
        description={
          myOption
            ? `Your vote moves from ${myOption.label} to ${pickedOption?.label ?? ""}. You can change it again until voting closes.`
            : "You can change your vote until voting closes."
        }
        confirmLabel={myOption ? "Change vote" : "Submit vote"}
        isLoading={cast.isPending}
        onConfirm={() =>
          pickedOption &&
          cast.mutate(
            { eventId: event.id, optionId: pickedOption.id },
            {
              onSuccess: () => {
                setPicked(null)
                setConfirming(false)
              },
            },
          )
        }
      />
    </article>
  )
}

interface CandidateCardProps {
  option: VoteOptionView
  rank: number | null
  total: number
  showResults: boolean
  selected: boolean
  mine: boolean
  winner: boolean
  selectable: boolean
  onSelect: () => void
}

function CandidateCard({
  option: o,
  rank,
  total,
  showResults,
  selected,
  mine,
  winner,
  selectable,
  onSelect,
}: CandidateCardProps) {
  const votes = o.votes ?? 0
  const pct = showResults && total > 0 ? Math.round((votes / total) * 100) : 0
  const onTop = showResults && votes > 0 && rank !== null && rank <= 3

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "border-border bg-background relative flex flex-col items-center gap-2 rounded-sm border px-3 pt-5 pb-3 text-center transition",
        selectable ? "hover:border-primary/50 hover:bg-accent/40 cursor-pointer" : "cursor-default",
        selected && "border-primary bg-primary/5 ring-primary/30 ring-2",
        mine && "border-emerald-500/60 bg-emerald-500/5",
        winner && "border-amber-400/60 bg-amber-400/5",
      )}
    >
      {onTop && (
        <span
          className={cn(
            "absolute top-2 left-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
            rank === 1
              ? "bg-amber-400 text-amber-950"
              : rank === 2
                ? "bg-slate-300 text-slate-900"
                : "bg-orange-400 text-orange-950",
          )}
        >
          #{rank}
        </span>
      )}
      {(selected || mine) && (
        <CheckCircle2
          className={cn(
            "absolute top-2 right-2 h-4 w-4",
            mine ? "text-emerald-500" : "text-primary",
          )}
        />
      )}
      <AvatarDisplay
        src={o.photoUrl}
        firstName={o.employee?.firstName ?? o.label}
        lastName={o.employee?.lastName ?? ""}
        size="lg"
        className="rounded-full"
      />
      <div className="w-full min-w-0">
        <p className="truncate text-sm font-medium">{o.label}</p>
        <p className="text-muted-foreground h-4 text-[11px]">
          {mine ? "Your vote" : o.isMe ? "You" : (o.description ?? "")}
        </p>
      </div>
      {showResults && (
        <div className="w-full">
          <div className="text-muted-foreground mb-1 flex justify-between text-[11px] tabular-nums">
            <span>
              {votes} {votes === 1 ? "vote" : "votes"}
            </span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-1" />
        </div>
      )}
    </button>
  )
}
