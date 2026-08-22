"use client"

/**
 * Emoji reactions on a message: the chips under a bubble, and the quick bar for
 * adding one. Shared by personal Chat and a project's Messages tab.
 *
 * Reactions arrive already grouped by emoji from the server (see
 * `groupReactions`), because a bubble re-grouping the same rows on every render
 * is work repeated once per message per keystroke elsewhere on the page.
 */

import * as React from "react"
import { SmilePlus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { EmojiPicker } from "@/components/shared/emoji-picker"

/** One emoji and who put it there. */
export interface ReactionGroup {
  emoji: string
  count: number
  /** Whether the CURRENT user is one of them - drives the highlight and toggle. */
  mine: boolean
  /** Names, for the tooltip. Capped server-side; `count` is the real total. */
  names: string[]
}

/** The six WhatsApp offers before you reach for the full picker. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const

/** The chips under a bubble. Renders nothing when there are none. */
export function MessageReactions({
  reactions,
  onToggle,
}: {
  reactions: ReactionGroup[]
  onToggle: (emoji: string) => void
}) {
  if (reactions.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(r.emoji)}
          title={`${r.names.join(", ")}${r.count > r.names.length ? ` +${r.count - r.names.length}` : ""}`}
          className={cn(
            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none transition-colors",
            r.mine
              ? "border-primary/40 bg-primary/15 text-foreground"
              : "bg-card hover:bg-muted border-transparent",
          )}
        >
          <span className="text-xs">{r.emoji}</span>
          {r.count > 1 && <span className="tabular-nums">{r.count}</span>}
        </button>
      ))}
    </div>
  )
}

/**
 * The react affordance: a smiley that sits in the message's control column and
 * opens six one-tap emoji plus the full picker.
 *
 * It used to be a bar that floated over the bubble on hover. That put a control
 * on top of the words you were reading, moved as the bubble resized, and gave no
 * hint it existed until your pointer was already there. Living beside the ⋮ - the
 * other thing you do TO a message - it has a fixed home you can aim at.
 */
export function ReactionButton({
  onPick,
  className,
  align = "end",
}: {
  onPick: (emoji: string) => void
  className?: string
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = React.useState(false)

  const pick = (emoji: string) => {
    onPick(emoji)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="React"
          title="React"
          className={cn("text-muted-foreground hover:text-foreground shrink-0", className)}
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} side="top" className="w-auto rounded-full p-1">
        <div className="flex items-center gap-0.5">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => pick(e)}
              aria-label={`React ${e}`}
              className="hover:bg-muted flex h-8 w-8 items-center justify-center rounded-full text-lg transition-colors"
            >
              {e}
            </button>
          ))}
          {/* Anything outside the six. */}
          <EmojiPicker
            onPick={pick}
            closeOnPick
            align="end"
            className="h-8 w-8 rounded-full"
            iconClassName="h-4 w-4"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
