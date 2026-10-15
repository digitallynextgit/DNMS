"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { FormDialog } from "@/components/shared/form-dialog"
import { cn } from "@/lib/utils"
import type { ScorecardSide } from "../lib/scorecard"
import type { ScorecardCriterionRow } from "../types"
import {
  useScorecardCriteria,
  useUpdateCriteria,
  type CriterionInput,
} from "../hooks/use-scorecard"

// HR edits the company's scorecard columns: rename, reorder, hide (never delete - old scores keep
// their meaning) and add. Applies to every joinee's scorecard.

interface Draft extends CriterionInput {
  /** Stable React key for rows that have no criterion key yet. */
  tmpId: string
}

export function CriteriaDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading } = useScorecardCriteria(open)
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Scorecard criteria"
      description="What the manager and HR score each day. Changes apply to every joinee's scorecard; hiding a column keeps the scores already given."
      isEdit
      size="lg"
      submitLabel="Save criteria"
      submitDisabled
      onSubmit={(e) => e.preventDefault()}
    >
      {isLoading || !data ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        // Remounts per opening, so the draft starts from what is saved.
        <CriteriaEditor
          key={String(open)}
          rows={data.criteria}
          onDone={() => onOpenChange(false)}
        />
      )}
    </FormDialog>
  )
}

function CriteriaEditor({ rows, onDone }: { rows: ScorecardCriterionRow[]; onDone: () => void }) {
  const save = useUpdateCriteria()
  const [items, setItems] = useState<Draft[]>(() =>
    rows.map((r) => ({
      key: r.key,
      side: r.side,
      label: r.label,
      isActive: r.isActive,
      tmpId: r.key,
    })),
  )

  const patch = (tmpId: string, change: Partial<Draft>) =>
    setItems((prev) => prev.map((i) => (i.tmpId === tmpId ? { ...i, ...change } : i)))
  const remove = (tmpId: string) => setItems((prev) => prev.filter((i) => i.tmpId !== tmpId))
  const add = (side: ScorecardSide) =>
    setItems((prev) => [
      ...prev,
      { key: null, side, label: "", isActive: true, tmpId: `new-${Date.now()}-${prev.length}` },
    ])
  /** Moves within its own side; the other side's rows stay where they are. */
  const move = (tmpId: string, dir: -1 | 1) =>
    setItems((prev) => {
      const sideItems = prev.filter((i) => i.side === prev.find((p) => p.tmpId === tmpId)?.side)
      const at = sideItems.findIndex((i) => i.tmpId === tmpId)
      const to = at + dir
      if (at < 0 || to < 0 || to >= sideItems.length) return prev
      const reordered = [...sideItems]
      ;[reordered[at], reordered[to]] = [reordered[to]!, reordered[at]!]
      const side = reordered[0]!.side
      let n = 0
      return prev.map((i) => (i.side === side ? reordered[n++]! : i))
    })

  const valid =
    items.every((i) => i.label.trim()) &&
    (["MANAGER", "HR"] as const).every((s) => items.some((i) => i.side === s && i.isActive))

  const submit = () => {
    if (!valid || save.isPending) return
    save.mutate(
      items.map(({ key, side, label, isActive }) => ({ key, side, label: label.trim(), isActive })),
      { onSuccess: onDone },
    )
  }

  return (
    <div className="space-y-5">
      {(["MANAGER", "HR"] as const).map((side) => (
        <section key={side} className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {side === "HR" ? "HR" : "Manager"} criteria
            </h4>
            <Button type="button" variant="ghost" onClick={() => add(side)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <ul className="space-y-1.5">
            {items
              .filter((i) => i.side === side)
              .map((item, idx, list) => (
                <li
                  key={item.tmpId}
                  className={cn("flex items-center gap-1.5", !item.isActive && "opacity-60")}
                >
                  <Input
                    value={item.label}
                    placeholder="Criterion name"
                    maxLength={60}
                    autoFocus={item.key === null && !item.label}
                    onChange={(e) => patch(item.tmpId, { label: e.target.value })}
                    className={cn("h-9", !item.isActive && "line-through")}
                  />
                  <IconButton
                    label={idx === 0 ? "Already first" : "Move up"}
                    disabled={idx === 0}
                    onClick={() => move(item.tmpId, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label={idx === list.length - 1 ? "Already last" : "Move down"}
                    disabled={idx === list.length - 1}
                    onClick={() => move(item.tmpId, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </IconButton>
                  {item.key === null ? (
                    <IconButton label="Remove" onClick={() => remove(item.tmpId)}>
                      <X className="h-3.5 w-3.5" />
                    </IconButton>
                  ) : (
                    <IconButton
                      label={item.isActive ? "Hide this column" : "Show this column"}
                      onClick={() => patch(item.tmpId, { isActive: !item.isActive })}
                    >
                      {item.isActive ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </IconButton>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}

      {!valid && (
        <p className="text-destructive text-xs">
          Every criterion needs a name, and each side needs at least one visible criterion.
        </p>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={!valid} loading={save.isPending}>
          Save criteria
        </Button>
      </div>
    </div>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-8 shrink-0 items-center justify-center rounded-sm disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
