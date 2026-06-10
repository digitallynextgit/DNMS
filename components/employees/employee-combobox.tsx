"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Search, X, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { useEmployees } from "@/hooks/use-employees"
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
}

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

  const debouncedSearch = useDebounce(search, 300)
  const { data, isLoading } = useEmployees({
    search: debouncedSearch || undefined,
    status: "ACTIVE",
    page: 1,
    limit: 20,
  })

  const employees = (data?.data ?? []).filter((e) => e.id !== excludeId)

  function handleSelect(emp: { id: string; firstName: string; lastName: string }) {
    onChange(emp.id)
    setSelectedLabel(`${emp.firstName} ${emp.lastName}`)
    setOpen(false)
    setSearch("")
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(undefined)
    setSelectedLabel(undefined)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "border-input h-10 w-full justify-between rounded px-3 font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{value ? (selectedLabel ?? "Selected") : placeholder}</span>
          <span className="flex shrink-0 items-center gap-1">
            {value && (
              <X
                className="hover:text-foreground h-3.5 w-3.5 opacity-60"
                onClick={handleClear}
                aria-label="Clear manager"
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <div className="border-border flex items-center gap-2 border-b px-3">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or ID..."
            autoFocus
            // Inline style overrides the app-wide unlayered `:focus-visible`
            // outline rule, which Tailwind utility classes can't beat.
            style={{ outline: "none", boxShadow: "none" }}
            className="placeholder:text-muted-foreground h-10 w-full bg-transparent text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : employees.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No employees found.</p>
          ) : (
            employees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleSelect(emp)}
                className="hover:bg-accent flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors"
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
      </PopoverContent>
    </Popover>
  )
}
