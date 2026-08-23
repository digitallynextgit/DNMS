"use client"

/**
 * The one emoji picker: every RGI emoji (1,914 of them, Unicode 17.0), grouped
 * and ordered the way Unicode orders them, with search by name.
 *
 * It used to be a curated 36 - twelve reactions, twelve faces, twelve work
 * glyphs - on the reasoning that a picker library ships hundreds of kilobytes to
 * solve a problem a work chat does not have. The full set is here now, but that
 * reasoning still holds, so the weight is handled rather than accepted:
 *
 *   - The dataset is a separate module, pulled in with a dynamic import. That
 *     import is WARMED on hover/focus of the trigger (which reliably precedes
 *     the click), so by the time the popover opens the grid paints directly with
 *     no "Loading emoji…" flash. A page that never touches the button downloads
 *     nothing; the button itself is a few bytes.
 *   - Only the ACTIVE group renders, and only a screenful of it at a time
 *     (progressive reveal on scroll), so the first commit is ~96 buttons, not
 *     the ~390 of a big group or all 1,914 at once. Mounting a whole group of
 *     DOM nodes behind a popover is what makes these pickers feel heavy to open.
 *   - Category switches and search run through startTransition / useDeferredValue
 *     so the tab highlight and the typed text stay responsive while the heavy
 *     grid work happens interruptibly in the background.
 *
 * No sprite sheets: these are text, drawn by the platform's own emoji font, so
 * they match what the recipient sees in their own client.
 */

import * as React from "react"
import { Smile, Search, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { EmojiEntry, EmojiGroup } from "./emoji-data"

/** How many search hits to draw. Typing "f" matches hundreds; nobody scrolls
 *  past the first screen of them, and rendering the rest just costs frames. */
const MAX_RESULTS = 96

/** Initial buttons drawn for a group, and how many more each scroll reveals. A
 *  screenful is ~56 (7 rows × 8 cols in the h-56 scroll area); 96 covers it with
 *  buffer, so the first paint is a screenful even for a 390-emoji group. */
const PAGE = 96

/** Shared, memoised dataset import - hover-warm and open share one in-flight
 *  promise, and every later mount is instant from the module cache. */
let emojiDataPromise: Promise<readonly EmojiGroup[]> | null = null
function loadEmojiData(): Promise<readonly EmojiGroup[]> {
  if (!emojiDataPromise) {
    emojiDataPromise = import("./emoji-data").then((m) => m.EMOJI_GROUPS)
  }
  return emojiDataPromise
}

/** One glyph per group for the tab strip - shorter than "Smileys & Emotion" and
 *  recognisable at a glance. Keyed by Unicode's own group name. */
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

/** One emoji cell. Memoised so switching groups/queries only reconciles the
 *  cells that actually changed, not every button, as long as onPick is stable. */
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
  /** Close after one pick. Off by default: with a searchable full set, picking
   *  two or three in a row is normal and reopening between each is the annoying
   *  part. */
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

  // Pull the dataset into state once it has loaded. Safe to call repeatedly - the
  // import promise is shared and setGroups no-ops once populated.
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

  // Fallback for keyboard-open without a preceding hover/focus. In practice the
  // trigger's onMouseEnter/onFocus has usually already warmed it, so this rarely
  // does the work - it just guarantees the grid appears.
  React.useEffect(() => {
    if (open) warm()
  }, [open, warm])

  // Type instantly (query drives the input); filter against the DEFERRED value so
  // a keystroke never waits on scanning ~1,914 names + remounting the grid.
  const deferredQuery = React.useDeferredValue(query)
  const q = deferredQuery.trim().toLowerCase()

  const results = React.useMemo(() => {
    if (!groups || !q) return null
    const hits: EmojiEntry[] = []
    for (const g of groups) {
      for (const e of g.emojis) {
        // Name only. Matching the glyph itself would mean pasting an emoji to
        // find that same emoji, which is not a thing anybody does.
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

  // Back to the top AND back to a single page when the grid's contents change out
  // from under it - otherwise a new category opens scrolled halfway down the
  // previous one, or with the previous one's reveal count still applied.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    setLimit(PAGE)
  }, [active, q])

  // Progressive reveal: mount a screenful, then extend as the sentinel at the
  // bottom scrolls into view. Caps the first commit at ~PAGE buttons instead of a
  // whole 390-emoji group. Search results are already capped at MAX_RESULTS.
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
          // Warm the dataset before the click lands so the first open paints the
          // grid directly, with no async state commit mid open-animation.
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

        {/* Category strip. Hidden while searching - results span every group, so
            a highlighted tab would be claiming something untrue. */}
        {!q && groups && (
          <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
            {groups.map((g, i) => (
              <button
                key={g.label}
                type="button"
                title={g.label}
                aria-label={g.label}
                aria-pressed={i === active}
                // startTransition: the tab highlight paints immediately while the
                // heavy grid swap happens interruptibly in the background.
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
