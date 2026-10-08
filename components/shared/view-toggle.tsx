"use client"

import { useState, useSyncExternalStore } from "react"
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
      // Same track as a tab strip (components/ui/tabs.tsx), minus the scroll, which would clip the corners.
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

const subscribeNever = () => () => {}

function readViewMode(storageKey: string): ViewMode | null {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored && (VIEW_MODES as string[]).includes(stored) ? (stored as ViewMode) : null
  } catch {
    return null
  }
}

export function useViewMode(
  storageKey: string,
  defaultMode: ViewMode = "card",
): [ViewMode, (v: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(defaultMode)

  // Saved choice per key; undefined on the server and while hydrating, so the markup matches.
  const stored = useSyncExternalStore<ViewMode | null | undefined>(
    subscribeNever,
    () => readViewMode(storageKey),
    () => undefined,
  )
  const [restoredKey, setRestoredKey] = useState<string | null>(null)
  if (stored !== undefined && restoredKey !== storageKey) {
    setRestoredKey(storageKey)
    if (stored) setMode(stored)
  }

  function update(v: ViewMode) {
    setMode(v)
    try {
      localStorage.setItem(storageKey, v)
    } catch {}
  }

  return [mode, update]
}
