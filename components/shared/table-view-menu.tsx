"use client"

import { ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** The "All ⌄" view picker at the start of a DataTable toolbar, each view with its count. */
export function TableViewMenu<V extends string>({
  value,
  options,
  onChange,
  label = "View",
}: {
  value: V
  options: ReadonlyArray<{ value: V; label: string; count?: number }>
  onChange: (next: V) => void
  /** Accessible name prefix: "View", "Status". */
  label?: string
}) {
  const current = options.find((o) => o.value === value) ?? options[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="h-9 shrink-0 gap-1.5 px-3 font-semibold"
          aria-label={`${label}: ${current?.label ?? ""}`}
        >
          {current?.label}
          <ChevronsUpDown className="text-muted-foreground h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as V)}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              <span className="flex-1">{o.label}</span>
              {o.count != null ? (
                <span className="text-muted-foreground pl-4 text-xs tabular-nums">{o.count}</span>
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
