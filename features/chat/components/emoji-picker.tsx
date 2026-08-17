"use client"

/**
 * A small, dependency-free emoji picker.
 *
 * Deliberately a curated set rather than an emoji-picker library: the popular
 * ones ship a full Unicode dataset plus sprite sheets - hundreds of kilobytes on
 * every chat page - to solve a problem this does not have. People reaching for
 * an emoji in a work chat want a face or a thumbs-up, not search across 3,600
 * glyphs. Typing directly still works for anything not listed.
 */

import * as React from "react"
import { Smile } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Reactions",
    emojis: ["👍", "👎", "👏", "🙌", "🙏", "💯", "🔥", "✅", "❌", "👀", "🎉", "⭐"],
  },
  {
    label: "Faces",
    emojis: ["😀", "😅", "😂", "🙂", "😉", "😍", "🤔", "😐", "😢", "😭", "😡", "😴"],
  },
  {
    label: "Work",
    emojis: ["📌", "📝", "📎", "📅", "⏰", "⚠️", "🚀", "💡", "🐛", "☕", "📈", "🤝"],
  },
]

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Insert emoji"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="space-y-2">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                {g.label}
              </p>
              <div className="grid grid-cols-6 gap-0.5">
                {g.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-label={e}
                    onClick={() => {
                      onPick(e)
                      // Closing after one pick: a chat message rarely wants six
                      // emojis in a row, and leaving it open hides the thread.
                      setOpen(false)
                    }}
                    className="hover:bg-muted flex h-8 w-8 items-center justify-center rounded-[2px] text-lg transition-colors"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
