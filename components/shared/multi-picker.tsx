"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface MultiPickerOption {
  id: string
  label: string
  hint?: string
}

/** Checkbox list in a popover. Empty selection means "All" (the widest report), not "None". */
export function MultiPicker({
  label,
  options,
  selected,
  onChange,
  emptyLabel,
  disabled,
}: {
  label: string
  options: MultiPickerOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  emptyLabel: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q),
    )
  }, [options, search])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const summary =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.label ?? "1 selected")
        : `${selected.length} selected`

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || options.length === 0}
            className="w-full justify-between gap-2 px-2.5 font-normal"
          >
            <span className="truncate">{options.length === 0 ? "Nothing available" : summary}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-56 p-0" align="start">
          {options.length > 8 && (
            <div className="relative border-b">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-3.5 w-3.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                aria-label="Search"
                className="h-9 rounded-none border-0 pl-7 text-xs focus-visible:ring-0"
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground px-2 py-3 text-center text-xs">No matches</p>
            ) : (
              filtered.map((o) => {
                const active = selected.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className="hover:bg-muted flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", active && "font-medium")}>
                        {o.label}
                      </span>
                      {o.hint && (
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {o.hint}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {selected.length > 0 && (
            <div className="border-t p-1">
              <Button type="button" variant="ghost" className="w-full" onClick={() => onChange([])}>
                Clear ({selected.length})
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
