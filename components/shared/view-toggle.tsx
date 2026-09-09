"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, List, Kanban, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TAB_TRACK, TAB_TRIGGER, TAB_TRIGGER_ACTIVE, TAB_TRIGGER_IDLE } from "@/components/ui/tabs"

export type ViewMode = "card" | "table" | "kanban" | "sheet"

const VIEW_MODES: ViewMode[] = ["card", "table", "kanban", "sheet"]

interface Props {
  value: ViewMode
  onChange: (v: ViewMode) => void
  showKanban?: boolean
  /** The week-grid "Excel" view. Only meaningful where rows have a due date. */
  showSheet?: boolean
  /** Card and table are the usual pair; opt out where table earns nothing. */
  showTable?: boolean
  className?: string
}

export function ViewToggle({
  value,
  onChange,
  showKanban = false,
  showSheet = false,
  showTable = true,
  className,
}: Props) {
  return (
    <div
      // Same track and same option styling as a real tab strip - see the class
      // constants in components/ui/tabs.tsx. No TAB_TRACK_SCROLL: two to four
      // icons never overflow, and a scroll container here would swallow the
      // rounded corners.
      className={cn(TAB_TRACK, className)}
      role="tablist"
      aria-label="View mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "card"}
        title="Card view"
        aria-label="Card view"
        onClick={() => onChange("card")}
        className={cn(
          TAB_TRIGGER,
          // Icon-only, so a square-ish box rather than the text px-3.
          "w-9 px-0",
          value === "card" ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_IDLE,
        )}
      >
        <LayoutGrid />
      </button>
      {showTable && (
        <button
          type="button"
          role="tab"
          aria-selected={value === "table"}
          title="Table view"
          aria-label="Table view"
          onClick={() => onChange("table")}
          className={cn(
            TAB_TRIGGER,
            "w-9 px-0",
            value === "table" ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_IDLE,
          )}
        >
          <List />
        </button>
      )}
      {showKanban && (
        <button
          type="button"
          role="tab"
          aria-selected={value === "kanban"}
          title="Board view"
          aria-label="Board view"
          onClick={() => onChange("kanban")}
          className={cn(
            TAB_TRIGGER,
            "w-9 px-0",
            value === "kanban" ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_IDLE,
          )}
        >
          <Kanban />
        </button>
      )}
      {showSheet && (
        <button
          type="button"
          role="tab"
          aria-selected={value === "sheet"}
          title="Sheet view"
          aria-label="Sheet view"
          onClick={() => onChange("sheet")}
          className={cn(
            TAB_TRIGGER,
            "w-9 px-0",
            value === "sheet" ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_IDLE,
          )}
        >
          <Table2 />
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
