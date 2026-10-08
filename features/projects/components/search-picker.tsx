"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Focus: inside a modal Dialog, focus the input from onOpenAutoFocus (after the popover's focus scope
// registers), never via autoFocus - the Dialog's focus trap would pull focus back.

/** The value for "none picked". Shared so callers can compare against it. */
export const NONE_OPTION = "__none__"

export interface PickerOption {
  id: string
  label: string
}

export interface PickerGroup {
  /** Rendered as a non-selectable heading. Empty string = no heading. */
  label: string
  options: PickerOption[]
}

export function SearchPicker({
  value,
  onChange,
  groups,
  loading = false,
  emptyText,
  noneLabel,
  searchPlaceholder = "Search…",
  disabled = false,
  className,
}: {
  value: string
  onChange: (id: string) => void
  groups: PickerGroup[]
  loading?: boolean
  /** Shown when there is nothing to choose from at all (after loading). */
  emptyText: string
  /** The "none" row's text, e.g. "Not from a task". */
  noneLabel: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const listId = React.useId()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const q = query.trim().toLowerCase()
  const visible = React.useMemo(
    () =>
      groups
        .map((g) => ({
          label: g.label,
          options: q ? g.options.filter((o) => o.label.toLowerCase().includes(q)) : g.options,
        }))
        .filter((g) => g.options.length > 0),
    [groups, q],
  )
  // One flat list for the keyboard: "none" first, then the visible options in reading order.
  const flat = React.useMemo<PickerOption[]>(
    () => [
      ...(q && !noneLabel.toLowerCase().includes(q) ? [] : [{ id: NONE_OPTION, label: noneLabel }]),
      ...visible.flatMap((g) => g.options),
    ],
    [visible, q, noneLabel],
  )
  const total = groups.reduce((n, g) => n + g.options.length, 0)
  const chosen = groups.flatMap((g) => g.options).find((o) => o.id === value)

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const hit = flat[active]
      if (hit) pick(hit.id)
    }
  }

  // Index into `flat`, so the highlighted row and the Enter target match.
  let cursor = 0
  const row = (o: PickerOption, muted = false) => {
    const idx = cursor++
    const selected = o.id === value
    return (
      <button
        key={o.id}
        type="button"
        role="option"
        aria-selected={selected}
        onMouseEnter={() => setActive(idx)}
        onClick={() => pick(o.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
          idx === active && "bg-accent text-accent-foreground",
          muted && "text-muted-foreground",
        )}
      >
        <Check className={cn("h-3.5 w-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
        <span className="truncate">{o.label}</span>
      </button>
    )
  }

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setQuery("")
          setActive(0)
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          onKeyDown={(e) => {
            // Typing on the closed trigger opens it with that character, like a native select.
            if (!open && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault()
              setOpen(true)
              setQuery(e.key)
              setActive(0)
            }
          }}
          className={cn(
            "border-input bg-background ring-offset-background focus:ring-ring flex h-9 w-full items-center justify-between rounded-sm border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="truncate">{chosen ? chosen.label : noneLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <div className="relative border-b p-1.5">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-8 border-0 pl-7 shadow-none focus-visible:ring-0"
          />
        </div>
        <div id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1">
          {flat[0]?.id === NONE_OPTION && row(flat[0], true)}
          {loading && <p className="text-muted-foreground px-2 py-1.5 text-sm">Loading…</p>}
          {!loading && total === 0 && (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">{emptyText}</p>
          )}
          {!loading && total > 0 && visible.length === 0 && (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">No match for “{query}”</p>
          )}
          {visible.map((g, i) => (
            <div
              key={g.label || i}
              className="border-border mt-1 border-t pt-1 first:mt-0 first:border-0"
            >
              {g.label && (
                <div className="text-muted-foreground px-2 pt-1 pb-1 text-[10px] font-medium tracking-wider uppercase">
                  {g.label}
                </div>
              )}
              {g.options.map((o) => row(o))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
