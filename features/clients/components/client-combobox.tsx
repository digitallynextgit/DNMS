"use client"

import { useEffect, useRef, useState } from "react"
import { Building2, Check, ChevronsUpDown, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { CLIENT_STATUS_LABELS } from "@/lib/constants"
import { Spinner } from "@/components/shared/spinner"
import { useDebounce } from "@/hooks/use-debounce"
import { useClients } from "../hooks/use-clients"

interface ClientComboboxProps {
  value?: string
  onChange: (id: string | undefined) => void
  /** Label for the current value before the user opens/searches (edit mode). */
  initialLabel?: string
  placeholder?: string
}

type Picked = { id: string; name: string }

/**
 * Searchable client picker, for the project form.
 *
 * Plain DOM with no portal, for the same reasons as EmployeeCombobox: this sits
 * inside a Dialog, whose focus trap and scroll lock both break a list rendered
 * on document.body. Expanding in place keeps typing and scrolling working.
 */
export function ClientCombobox({
  value,
  onChange,
  initialLabel,
  placeholder = "Search clients",
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  // `undefined` = nothing chosen HERE yet, so the parent's label shows through
  // (it usually arrives after mount, once the parent has the client). `null` =
  // the user cleared the field, which must not fall back to that label.
  const [picked, setPicked] = useState<Picked | null | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const debounced = useDebounce(search, 300)
  const { data, isLoading } = useClients(
    { search: debounced || undefined, page: 1, limit: 20 },
    { enabled: open },
  )
  const clients = data?.data ?? []

  function select(c: Picked) {
    onChange(c.id)
    setPicked(c)
    setSearch("")
    setOpen(false)
  }

  function clear() {
    onChange(undefined)
    setPicked(null)
    setSearch("")
    inputRef.current?.focus()
  }

  const label = picked === undefined ? initialLabel : (picked?.name ?? undefined)
  const shown = open ? search : (label ?? (value ? "Selected" : ""))

  return (
    <div ref={rootRef} className="w-full">
      <div
        className={cn(
          "border-input bg-background flex h-10 w-full items-center gap-2 rounded-sm border px-3",
          open && "ring-ring/50 ring-2",
        )}
      >
        <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <input
          ref={inputRef}
          value={shown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls="client-combobox-list"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation()
              setOpen(false)
              setSearch("")
            }
          }}
          style={{ outline: "none", boxShadow: "none" }}
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear selection"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Close list" : "Open list"}
          onClick={() => (open ? setOpen(false) : inputRef.current?.focus())}
          className="shrink-0"
        >
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </button>
      </div>

      {open && (
        <div
          id="client-combobox-list"
          role="listbox"
          className="bg-popover text-popover-foreground mt-1 max-h-64 overflow-y-auto rounded-sm border p-1 shadow-md"
        >
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
              <Spinner /> Searching…
            </div>
          ) : clients.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No clients found.</p>
          ) : (
            clients.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={value === c.id}
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(c)
                }}
                className="hover:bg-accent flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors"
              >
                <span className="bg-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-sm">
                  <Building2 className="text-muted-foreground h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {c.code}
                    {c.status !== "ACTIVE"
                      ? ` · ${CLIENT_STATUS_LABELS[c.status] ?? c.status}`
                      : ""}
                  </p>
                </div>
                {value === c.id && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
