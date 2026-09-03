"use client"

import * as React from "react"
import { Tags, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SUGGESTED_TAGS, TagChip, tagTint } from "./goal-status"

// ─────────────────────────────────────────────────────────────────────────────
// Typing a goal's tags.
//
// FREE TEXT WITH A MEMORY, not a dropdown. The point of tags here is that a team
// can name its own cadence - "weekly", "sprint 4", "client ask" - without anyone
// shipping a migration for it. So the input takes any word.
//
// The one thing it must not do is let the same idea in twice under two spellings,
// because that splits a tag's goals across two filter entries and the filter
// starts hiding matches. Two defences, and they are different:
//
//   the type-ahead - every tag the project already uses is offered as you type,
//                    so the reflex is to pick the existing one rather than
//                    retype it slightly differently.
//   the dedupe     - committing a tag that differs only by case or by stray
//                    whitespace is a no-op, matching what the server does when
//                    it stores them.
//
// The server re-runs both (goals.service.ts): this is a courtesy to whoever is
// typing, never the enforcement.
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors MAX_TAGS_PER_GOAL / MAX_TAG_LENGTH in goals.service.ts. */
const MAX_TAGS = 6
const MAX_LENGTH = 24

/** Keys that mean "that's the tag, take it". Comma so a list can be pasted-ish. */
const COMMIT_KEYS = new Set(["Enter", ",", "Tab"])

const clean = (raw: string) => raw.trim().replace(/\s+/g, " ").slice(0, MAX_LENGTH)

export function GoalTagInput({
  value,
  onChange,
  suggestions,
  placeholder = "Tag it: weekly, primary…",
  autoFocus,
  className,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  /** Tags the project already uses. Offered first, before the built-in ones. */
  suggestions: string[]
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  const [draft, setDraft] = React.useState("")
  const listId = React.useId()
  const full = value.length >= MAX_TAGS

  const commit = (raw: string) => {
    const tag = clean(raw)
    setDraft("")
    if (!tag || full) return
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return
    onChange([...value, tag])
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (COMMIT_KEYS.has(e.key)) {
      // Tab with an empty box still moves focus - swallowing it would trap
      // keyboard users in a field they have nothing left to type into.
      if (e.key === "Tab" && !draft.trim()) return
      e.preventDefault()
      commit(draft)
      return
    }
    // Backspace on an empty box takes the last chip back, which is what every
    // other chip input does and therefore what fingers expect.
    if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  // The project's own tags first, then the generic ones, minus anything already
  // on this goal. Ordering matters: a team that has settled on "wk" should see
  // "wk" before we suggest "weekly" at it.
  const picked = new Set(value.map((t) => t.toLowerCase()))
  const options = [...suggestions, ...SUGGESTED_TAGS].filter((t, i, all) => {
    const key = t.toLowerCase()
    return !picked.has(key) && all.findIndex((x) => x.toLowerCase() === key) === i
  })

  return (
    <div
      className={cn(
        "border-input bg-background flex min-h-9 flex-wrap items-center gap-1.5 rounded-sm border px-2 py-1.5",
        "focus-within:border-ring focus-within:ring-ring/30 focus-within:ring-2",
        className,
      )}
    >
      <Tags className="text-muted-foreground h-3.5 w-3.5 shrink-0" />

      {value.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            tagTint(tag),
          )}
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Remove tag ${tag}`}
            className="opacity-60 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <input
        list={listId}
        value={draft}
        autoFocus={autoFocus}
        disabled={full}
        maxLength={MAX_LENGTH}
        onChange={(e) => {
          // A datalist pick fires change, not keydown, and arrives whole - so
          // commit it rather than leaving the user to press Enter on a value
          // they already chose from a list.
          const next = e.target.value
          if (options.some((o) => o.toLowerCase() === next.trim().toLowerCase())) commit(next)
          else setDraft(next)
        }}
        onKeyDown={onKeyDown}
        // Losing focus with a half-typed tag should keep it, not bin it: the
        // most common way out of this field is clicking "Add goal".
        onBlur={() => commit(draft)}
        placeholder={full ? `Up to ${MAX_TAGS} tags` : value.length === 0 ? placeholder : ""}
        aria-label="Goal tags"
        className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
      />

      <datalist id={listId}>
        {options.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  )
}

/**
 * Retagging a goal that already exists.
 *
 * A popover rather than a row that is always editable: tags are set once and
 * read many times, and six always-live inputs down a board is a board you cannot
 * skim. Nothing is saved until Save, so an abandoned edit costs nothing.
 */
export function GoalTagEditor({
  goalTitle,
  tags,
  suggestions,
  onSave,
  pending,
}: {
  goalTitle: string
  tags: string[]
  suggestions: string[]
  onSave: (tags: string[]) => void
  pending: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(tags)

  const changed =
    draft.length !== tags.length || draft.some((t, i) => t.toLowerCase() !== tags[i]?.toLowerCase())

  return (
    <Popover
      open={open}
      // Seeded on the way OPEN rather than from an effect: an effect would run a
      // second render every time the popover appeared, and would also stomp a
      // half-finished edit the moment a refetch handed down a new `tags` array.
      onOpenChange={(next) => {
        if (next) setDraft(tags)
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Tags for ${goalTitle}`}
          title="Tags"
          className={cn(
            "text-muted-foreground hover:text-foreground",
            tags.length > 0 && "text-foreground/70",
          )}
        >
          <Tags className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 p-3">
        <p className="text-xs font-medium">Tags</p>
        <p className="text-muted-foreground text-[11px]">
          Type a word and press Enter. Use these to filter the board - e.g. weekly, primary.
        </p>
        <GoalTagInput value={draft} onChange={setDraft} suggestions={suggestions} autoFocus />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!changed || pending}
            onClick={() => {
              onSave(draft)
              setOpen(false)
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** A goal's tags as read-only pills, each one a shortcut to filtering by it. */
export function GoalTagList({
  tags,
  activeTags,
  onToggle,
  className,
}: {
  tags: string[]
  activeTags?: string[]
  onToggle?: (tag: string) => void
  className?: string
}) {
  if (tags.length === 0) return null
  const active = new Set((activeTags ?? []).map((t) => t.toLowerCase()))
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {tags.map((tag) => (
        <TagChip
          key={tag}
          tag={tag}
          active={active.has(tag.toLowerCase())}
          onClick={onToggle ? () => onToggle(tag) : undefined}
        />
      ))}
    </span>
  )
}
