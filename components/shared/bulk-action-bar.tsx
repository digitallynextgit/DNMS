"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BulkActionBarProps {
  /** The bar hides itself at 0. */
  count: number
  onClear: () => void
  children?: React.ReactNode
  /** Default "selected". */
  label?: string
  className?: string
}

/** The "{n} selected · Clear" bar above a table. Pair with `useRowSelection`. */
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
        "bg-accent/50 border-border flex flex-wrap items-center justify-between gap-3 rounded-sm border px-3 py-2",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">
          {count} {label}
        </span>
        <Button className="gap-1" variant="ghost" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
