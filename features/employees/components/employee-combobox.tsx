"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"

import { cn } from "@/lib/utils"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { useEmployees } from "@/features/employees/hooks/use-employees"
import { useDebounce } from "@/hooks/use-debounce"

interface EmployeeComboboxProps {
  value?: string
  onChange: (id: string | undefined) => void
  /** Exclude an employee from the list (e.g. the employee being edited, so they
   *  can't be their own manager). */
  excludeId?: string
  /** Label to show for the current value before the user opens/searches (edit
   *  mode, where we already know the manager's name). */
  initialLabel?: string
  placeholder?: string
  /**
   * @deprecated Ignored. This no longer renders through a portal, so a parent
   * Dialog needs no special handling. Kept so existing call sites compile.
   */
  modal?: boolean
}

/**
 * Searchable employee picker.
 *
 * Deliberately plain DOM - no Popover, no portal. Both of the bugs this
 * component used to have came from portalling the dropdown onto `document.body`
 * while it was rendered inside a Dialog:
 *
 *   - Typing did nothing. The Dialog's focus trap owns everything inside
 *     `DialogContent`; an input portalled outside it gets focus yanked straight
 *     back, so keystrokes never landed.
 *   - The list would not scroll. The Dialog's `react-remove-scroll` blocks wheel
 *     events outside `DialogContent`, and the portalled list was outside it.
 *
 * Making the popover `modal` fixes the second and re-breaks the first. Rendering
 * in normal flow fixes both at once: the field and its list are ordinary
 * children of whatever contains them, so focus and scrolling just work. The list
 * expands in place rather than floating, which also means it can never be
 * clipped by the dialog's own `overflow-y-auto`.
 */
export function EmployeeCombobox({
  value,
  onChange,
  excludeId,
  initialLabel,
  placeholder = "Search and select an employee",
}: EmployeeComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(initialLabel)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // `initialLabel` usually arrives AFTER mount - the parent has to fetch the
  // employee to know their name. Without this the field is stuck empty for the
  // whole edit session. Only adopt it while the user has not picked someone
  // themselves, so it can never overwrite a fresh choice.
  useEffect(() => {
    if (initialLabel) setSelectedLabel((prev) => prev ?? initialLabel)
  }, [initialLabel])

  // Close when the click lands anywhere else. `mousedown` rather than `click` so
  // it settles before the next field takes focus.
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

  const debouncedSearch = useDebounce(search, 300)
  const { data, isLoading } = useEmployees(
    { search: debouncedSearch || undefined, status: "ACTIVE", page: 1, limit: 20 },
    { enabled: open },
  )

  const employees = (data?.data ?? []).filter((e) => e.id !== excludeId)

  function handleSelect(emp: { id: string; firstName: string; lastName: string }) {
    onChange(emp.id)
    setSelectedLabel(`${emp.firstName} ${emp.lastName}`)
    setSearch("")
    setOpen(false)
  }

  function handleClear() {
    onChange(undefined)
    setSelectedLabel(undefined)
    setSearch("")
    inputRef.current?.focus()
  }

  // Closed: show who is selected. Open: show what is being typed, so the field
  // never argues with itself about which text it is displaying.
  const shown = open ? search : (selectedLabel ?? (value ? "Selected" : ""))

  return (
    <div ref={rootRef} className="w-full">
      <div
        className={cn(
          "border-input bg-background flex h-10 w-full items-center gap-2 rounded-[2px] border px-3",
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
          aria-controls="employee-combobox-list"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation() // don't let Escape close the whole dialog too
              setOpen(false)
              setSearch("")
            }
          }}
          // Inline style overrides the app-wide unlayered `:focus-visible`
          // outline rule, which Tailwind utility classes can't beat.
          style={{ outline: "none", boxShadow: "none" }}
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
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
          id="employee-combobox-list"
          role="listbox"
          className="bg-popover text-popover-foreground mt-1 max-h-64 overflow-y-auto rounded-[2px] border p-1 shadow-md"
        >
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
              <Spinner /> Searching…
            </div>
          ) : employees.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No employees found.</p>
          ) : (
            employees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                role="option"
                aria-selected={value === emp.id}
                // Commit on mousedown so the selection lands before the input's
                // blur can close the list out from under the click.
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(emp)
                }}
                className="hover:bg-accent flex w-full items-center gap-2.5 rounded-[2px] px-2 py-1.5 text-left transition-colors"
              >
                <AvatarDisplay
                  src={emp.profilePhoto}
                  firstName={emp.firstName}
                  lastName={emp.lastName}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {emp.firstName} {emp.lastName}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {emp.employeeNo}
                    {emp.designation?.title ? ` · ${emp.designation.title}` : ""}
                  </p>
                </div>
                {value === emp.id && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
