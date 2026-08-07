"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, List, Kanban, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewMode = "card" | "table" | "kanban" | "sheet"

const VIEW_MODES: ViewMode[] = ["card", "table", "kanban", "sheet"]

interface Props {
  value: ViewMode
  onChange: (v: ViewMode) => void
  showKanban?: boolean
  /** The week-grid "Excel" view. Only meaningful where rows have a due date. */
  showSheet?: boolean
  className?: string
}

export function ViewToggle({
  value,
  onChange,
  showKanban = false,
  showSheet = false,
  className,
}: Props) {
  return (
    <div
      // h-9 + p-1 leaves exactly h-7 inside, so this lines up with a default
      // (h-9) Button sitting next to it.
      className={cn("bg-card inline-flex h-9 items-center rounded-[2px] border p-1", className)}
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
          "flex h-7 w-8 items-center justify-center rounded-[2px] transition-colors",
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
          "flex h-7 w-8 items-center justify-center rounded-[2px] transition-colors",
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
            "flex h-7 w-8 items-center justify-center rounded-[2px] transition-colors",
            value === "kanban"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          <Kanban className="h-3.5 w-3.5" />
        </button>
      )}
      {showSheet && (
        <button
          type="button"
          role="tab"
          aria-selected={value === "sheet"}
          title="Sheet view"
          onClick={() => onChange("sheet")}
          className={cn(
            "flex h-7 w-8 items-center justify-center rounded-[2px] transition-colors",
            value === "sheet"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          <Table2 className="h-3.5 w-3.5" />
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
      if (stored && (VIEW_MODES as string[]).includes(stored)) setMode(stored as ViewMode)
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
