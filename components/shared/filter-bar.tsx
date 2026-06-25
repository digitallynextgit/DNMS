"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface FilterToolbarProps {
  children: React.ReactNode
  /** Show the Clear button when any filter is active. */
  hasActiveFilters?: boolean
  onClear?: () => void
  className?: string
}

/** The shared filter-row shell + standardized Clear button. */
export function FilterToolbar({
  children,
  hasActiveFilters = false,
  onClear,
  className,
}: FilterToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {children}
      {hasActiveFilters && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-9 gap-1.5">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}

interface FilterSelectOption {
  value: string
  label: string
}

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: FilterSelectOption[]
  /** Label for the "no filter" sentinel row. */
  allLabel?: string
  placeholder?: string
  className?: string
}

/**
 * A Select that encapsulates the repeated `value || "all"` /
 * `onValueChange={(v) => onChange(v === "all" ? "" : v)}` sentinel idiom: an
 * empty `value` means "no filter" and shows the `allLabel` row.
 */
export function FilterSelect({
  value,
  onChange,
  options,
  allLabel = "All",
  placeholder,
  className,
}: FilterSelectProps) {
  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
      <SelectTrigger className={cn("h-9 w-[160px]", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
