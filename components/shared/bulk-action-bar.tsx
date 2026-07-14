"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BulkActionBarProps {
  /** Number of selected rows. The bar hides itself when 0. */
  count: number
  onClear: () => void
  /** Feature-specific action buttons (Export, Delete, status dropdown…). */
  children?: React.ReactNode
  /** Word for the count label (default "selected"). */
  label?: string
  className?: string
}

/**
 * The "{n} selected · Clear" bar shown above a table when rows are selected.
 * Feature-specific actions are passed as children. Pair with `useRowSelection`.
 */
export function BulkActionBar({
  count,
  onClear,
  children,
  label = "selected",
  className,
}: BulkActionBarProps) {
  if (count === 0) return null
  return (
    <div
      className={cn(
        "bg-accent/50 border-border flex flex-wrap items-center justify-between gap-3 rounded border px-3 py-2",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">
          {count} {label}
        </span>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 gap-1">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
