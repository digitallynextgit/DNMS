"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"

import { Spinner } from "@/components/shared/spinner"
import { cn } from "@/lib/utils"
import { useReferableRoles, type ReferableRole } from "../hooks/use-referrals"

/** Searchable role picker, rendered in normal flow like EmployeeCombobox (a portal fights the
 *  Dialog for focus). Filtering is client-side - the list is small and already loaded. */
export function RoleCombobox({
  value,
  onChange,
  enabled = true,
  hasError,
}: {
  value: string
  onChange: (id: string) => void
  /** Only fetch while the dialog is actually open. */
  enabled?: boolean
  hasError?: boolean
}) {
  const { data: roles, isLoading } = useReferableRoles(enabled)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside mousedown (not click) so it settles before the next field takes focus.
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

  const selected = roles?.find((r) => r.id === value)

  // Match the department too ("the internship one").
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return roles ?? []
    return (roles ?? []).filter(
      (r) => r.title.toLowerCase().includes(q) || r.department.toLowerCase().includes(q),
    )
  }, [roles, search])

  const label = (r: ReferableRole) => `${r.title} · ${r.department}`
  const shown = open ? search : selected ? label(selected) : ""

  return (
    <div ref={rootRef} className="w-full">
      <div
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-sm border px-3",
          hasError ? "border-destructive" : "border-input bg-background",
          open && "ring-ring/50 ring-2",
        )}
      >
        <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <input
          ref={inputRef}
          value={shown}
          role="combobox"
          aria-expanded={open}
          aria-controls="role-combobox-list"
          autoComplete="off"
          placeholder={isLoading ? "Loading roles..." : "Search roles"}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              // Do not let Escape close the whole dialog as well.
              e.stopPropagation()
              setOpen(false)
              setSearch("")
            }
          }}
          // Inline style beats the app-wide unlayered :focus-visible outline (Tailwind can't).
          style={{ outline: "none", boxShadow: "none" }}
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear role"
            onClick={() => {
              onChange("")
              setSearch("")
              inputRef.current?.focus()
            }}
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
          id="role-combobox-list"
          role="listbox"
          className="bg-popover text-popover-foreground mt-1 max-h-56 overflow-y-auto rounded-sm border p-1 shadow-md"
        >
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
              <Spinner /> Loading roles…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {(roles ?? []).length === 0
                ? "No roles are open right now."
                : `No role matches "${search.trim()}".`}
            </p>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={value === r.id}
                // Commit on mousedown so it lands before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(r.id)
                  setSearch("")
                  setOpen(false)
                }}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{r.department}</p>
                </div>
                {value === r.id && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
