"use client"

/**
 * Emoji picker with every RGI emoji and search by name. The dataset is a dynamic import warmed on
 * hover/focus; only the active group renders, a screenful at a time.
 */

import * as React from "react"
import { Smile, Search, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { EmojiEntry, EmojiGroup } from "./emoji-data"

/** Nobody scrolls past the first screen of hits. */
const MAX_RESULTS = 96

/** Buttons per reveal step: a screenful is ~56 (7 x 8), so 96 covers it. */
const PAGE = 96

/** Shared so hover-warm and open use one in-flight import. */
let emojiDataPromise: Promise<readonly EmojiGroup[]> | null = null
function loadEmojiData(): Promise<readonly EmojiGroup[]> {
  if (!emojiDataPromise) {
    emojiDataPromise = import("./emoji-data").then((m) => m.EMOJI_GROUPS)
  }
  return emojiDataPromise
}

/** Tab-strip glyph per Unicode group name. */
const GROUP_ICON: Record<string, string> = {
  "Smileys & Emotion": "😀",
  "People & Body": "👋",
  "Animals & Nature": "🐻",
  "Food & Drink": "🍕",
  "Travel & Places": "✈️",
  Activities: "⚽",
  Objects: "💡",
  Symbols: "❤️",
  Flags: "🏳️",
}

/** Memoised so only changed cells re-render (needs a stable onPick). */
const EmojiButton = React.memo(function EmojiButton({
  emoji,
  name,
  onPick,
}: {
  emoji: string
  name: string
  onPick: (emoji: string) => void
}) {
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      onClick={() => onPick(emoji)}
      className="hover:bg-muted flex h-8 w-8 items-center justify-center rounded-sm text-lg leading-none transition-colors"
    >
      {emoji}
    </button>
  )
})

export function EmojiPicker({
  onPick,
  /** Off by default: picking a few in a row is normal. */
  closeOnPick = false,
  className,
  iconClassName,
  align = "start",
  side = "top",
}: {
  onPick: (emoji: string) => void
  closeOnPick?: boolean
  className?: string
  iconClassName?: string
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
}) {
  const [open, setOpen] = React.useState(false)
  const [groups, setGroups] = React.useState<readonly EmojiGroup[] | null>(null)
  const [active, setActive] = React.useState(0)
  const [query, setQuery] = React.useState("")
  const [limit, setLimit] = React.useState(PAGE)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  // Safe to call repeatedly: the import is shared.
  const warm = React.useCallback(() => {
    if (groups) return
    let cancelled = false
    loadEmojiData().then((g) => {
      if (!cancelled) setGroups(g)
    })
    return () => {
      cancelled = true
    }
  }, [groups])

  // For keyboard opens with no prior hover/focus.
  React.useEffect(() => {
    if (open) warm()
  }, [open, warm])

  // Filter on the deferred value so typing never waits on the grid.
  const deferredQuery = React.useDeferredValue(query)
  const q = deferredQuery.trim().toLowerCase()

  const results = React.useMemo(() => {
    if (!groups || !q) return null
    const hits: EmojiEntry[] = []
    for (const g of groups) {
      for (const e of g.emojis) {
        if (e[1].includes(q)) {
          hits.push(e)
          if (hits.length >= MAX_RESULTS) return hits
        }
      }
    }
    return hits
  }, [groups, q])

  const shown = results ?? groups?.[active]?.emojis ?? []
  const visible = shown.slice(0, limit)

  // New contents: back to the top and to a single page.
  const [prevActive, setPrevActive] = React.useState(active)
  const [prevQ, setPrevQ] = React.useState(q)
  if (active !== prevActive || q !== prevQ) {
    setPrevActive(active)
    setPrevQ(q)
    setLimit(PAGE)
  }
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [active, q])

  // Progressive reveal: extend as the bottom sentinel scrolls into view.
  React.useEffect(() => {
    if (limit >= shown.length) return
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE)
      },
      { root, rootMargin: "200px" },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [limit, shown.length])

  const handlePick = React.useCallback(
    (emoji: string) => {
      onPick(emoji)
      if (closeOnPick) setOpen(false)
    },
    [onPick, closeOnPick],
  )

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onMouseEnter={warm}
          onFocus={warm}
          className={cn("text-muted-foreground hover:text-foreground shrink-0", className)}
          title="Insert emoji"
          aria-label="Insert emoji"
        >
          <Smile className={cn("h-4 w-4", iconClassName)} />
        </Button>
      </PopoverTrigger>

      <PopoverContent align={align} side={side} className="w-80 rounded-sm p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search emoji"
              aria-label="Search emoji"
              className="h-8 rounded-sm pl-8 text-sm"
            />
          </div>
        </div>

        {/* Hidden while searching - results span every group. */}
        {!q && groups && (
          <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
            {groups.map((g, i) => (
              <button
                key={g.label}
                type="button"
                title={g.label}
                aria-label={g.label}
                aria-pressed={i === active}
                // The tab highlight paints at once; the grid swap is interruptible.
                onClick={() => React.startTransition(() => setActive(i))}
                className={cn(
                  "hover:bg-muted flex h-7 flex-1 items-center justify-center rounded-sm text-base transition-colors",
                  i === active && "bg-muted",
                )}
              >
                {GROUP_ICON[g.label] ?? "•"}
              </button>
            ))}
          </div>
        )}

        <div ref={scrollRef} className="h-56 overflow-y-auto p-2">
          {!groups ? (
            <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading emoji…
            </div>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-xs">
              No emoji matches “{query}”.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                {q
                  ? `${shown.length} match${shown.length === 1 ? "" : "es"}`
                  : groups[active].label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {visible.map(([emoji, name]) => (
                  <EmojiButton key={emoji} emoji={emoji} name={name} onPick={handlePick} />
                ))}
              </div>
              {limit < shown.length && <div ref={sentinelRef} className="h-4" aria-hidden />}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
