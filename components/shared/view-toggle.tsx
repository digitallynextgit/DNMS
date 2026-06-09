"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, List, Kanban } from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewMode = "card" | "table" | "kanban"

interface Props {
  value: ViewMode
  onChange: (v: ViewMode) => void
  showKanban?: boolean
  className?: string
}

export function ViewToggle({ value, onChange, showKanban = false, className }: Props) {
  return (
    <div
      className={cn("bg-card inline-flex items-center rounded-md border p-0.5", className)}
      role="tablist"
      aria-label="View mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "card"}
        title="Card view"
        onClick={() => onChange("card")}
        className={cn(
          "flex h-6 w-7 items-center justify-center rounded transition-colors",
          value === "card"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "table"}
        title="Table view"
        onClick={() => onChange("table")}
        className={cn(
          "flex h-6 w-7 items-center justify-center rounded transition-colors",
          value === "table"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        )}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      {showKanban && (
        <button
          type="button"
          role="tab"
          aria-selected={value === "kanban"}
          title="Board view"
          onClick={() => onChange("kanban")}
          className={cn(
            "flex h-6 w-7 items-center justify-center rounded transition-colors",
            value === "kanban"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          <Kanban className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function useViewMode(
  storageKey: string,
  defaultMode: ViewMode = "card",
): [ViewMode, (v: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(defaultMode)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === "card" || stored === "table" || stored === "kanban") setMode(stored)
    } catch {}
  }, [storageKey])

  function update(v: ViewMode) {
    setMode(v)
    try {
      localStorage.setItem(storageKey, v)
    } catch {}
  }

  return [mode, update]
}
