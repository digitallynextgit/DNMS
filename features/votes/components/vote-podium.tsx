"use client"

/** The top three by votes, as a podium: 2nd, 1st, 3rd from left to right. */

import { Crown } from "lucide-react"

import { cn } from "@/lib/utils"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { rankByVotes, type Ranked } from "../lib/vote-rules"
import type { VoteOptionView } from "../types"

const MEDAL: Record<number, { ring: string; badge: string; block: string }> = {
  1: {
    ring: "ring-amber-400",
    badge: "bg-amber-400 text-amber-950",
    block: "from-amber-400/25 border-amber-400",
  },
  2: {
    ring: "ring-slate-300",
    badge: "bg-slate-300 text-slate-900",
    block: "from-slate-300/20 border-slate-300",
  },
  3: {
    ring: "ring-orange-400",
    badge: "bg-orange-400 text-orange-950",
    block: "from-orange-400/20 border-orange-400",
  },
}

/** Step heights by place on the stage, so a tie still reads as a podium. */
const STEP_HEIGHT = ["h-10", "h-16", "h-6"]

export function VotePodium({ options, total }: { options: VoteOptionView[]; total: number }) {
  const top = rankByVotes(options)
    .filter((r) => (r.item.votes ?? 0) > 0)
    .slice(0, 3)

  if (top.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No votes yet. The leaders show up here as soon as people vote.
      </p>
    )
  }

  // Centre stage for first place: 2nd, 1st, 3rd.
  const stage = [top[1], top[0], top[2]]

  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {stage.map((r, i) =>
        r ? <Step key={r.item.id} entry={r} total={total} slot={i} /> : <div key={i} />,
      )}
    </div>
  )
}

function Step({
  entry: { item: o, rank },
  total,
  slot,
}: {
  entry: Ranked<VoteOptionView>
  total: number
  /** 0 = left (2nd), 1 = centre (1st), 2 = right (3rd). */
  slot: number
}) {
  const first = slot === 1
  const medal = MEDAL[Math.min(rank, 3)] ?? MEDAL[3]!
  const votes = o.votes ?? 0
  const pct = total > 0 ? Math.round((votes / total) * 100) : 0

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div className="relative mb-3">
        {rank === 1 && (
          <Crown className="absolute -top-5 left-1/2 h-5 w-5 -translate-x-1/2 fill-amber-400 text-amber-400" />
        )}
        <AvatarDisplay
          src={o.photoUrl}
          firstName={o.employee?.firstName ?? o.label}
          lastName={o.employee?.lastName ?? ""}
          size={first ? "xl" : "lg"}
          className={cn("ring-offset-card rounded-full ring-2 ring-offset-2", medal.ring)}
        />
        <span
          className={cn(
            "absolute -bottom-2 left-1/2 flex h-6 min-w-6 -translate-x-1/2 items-center justify-center rounded-full px-1.5 text-xs font-bold",
            medal.badge,
          )}
        >
          {rank}
        </span>
      </div>
      <p className={cn("w-full truncate font-semibold", first ? "text-base" : "text-sm")}>
        {o.label}
      </p>
      <p className="text-muted-foreground text-xs tabular-nums">
        {votes} {votes === 1 ? "vote" : "votes"} · {pct}%
      </p>
      <div
        className={cn(
          "mt-3 w-full max-w-36 rounded-t-sm border-t-2 bg-gradient-to-b to-transparent",
          STEP_HEIGHT[slot],
          medal.block,
        )}
      />
    </div>
  )
}
