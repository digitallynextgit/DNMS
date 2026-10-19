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
  useUpdateCardCriteria,
  useUpdateCriteria,
  type CriterionInput,
} from "../hooks/use-scorecard"

// HR edits scorecard columns: rename, reorder, hide (never delete - old scores keep their meaning)
// and add. Either one joinee's card, or the company default that new cards start from.

interface Draft extends CriterionInput {
  /** Stable React key for rows that have no criterion key yet. */
  tmpId: string
}

export function CriteriaDialog({
  open,
  onOpenChange,
  card,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** This joinee's card; left out, the dialog edits the company default for new cards. */
  card?: { id: string; employeeId: string; firstName: string; rows: ScorecardCriterionRow[] }
}) {
  const defaults = useScorecardCriteria(open && !card)
  const saveDefault = useUpdateCriteria()
  // Called either way (hooks can't be conditional); only used when there is a card.
  const saveCard = useUpdateCardCriteria(card?.employeeId ?? "", card?.id ?? "")
  const save = card ? saveCard : saveDefault
  const rows = card ? card.rows : defaults.data?.criteria
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={card ? `Criteria for ${card.firstName}` : "Default criteria for new joinees"}
      description={
        card
          ? `What the manager and HR score each day on ${card.firstName}'s scorecard. Only this scorecard changes; hiding a column keeps the scores already given.`
          : "Every new scorecard starts with these. Scorecards already started keep their own criteria."
      }
      isEdit
      size="lg"
      submitLabel="Save criteria"
      submitDisabled
      onSubmit={(e) => e.preventDefault()}
    >
      {!rows ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        // Remounts per opening, so the draft starts from what is saved.
        <CriteriaEditor
          key={String(open)}
          rows={rows}
          saving={save.isPending}
          onSave={(items) => save.mutate(items, { onSuccess: () => onOpenChange(false) })}
          onDone={() => onOpenChange(false)}
        />
      )}
    </FormDialog>
  )
}

function CriteriaEditor({
  rows,
  saving,
  onSave,
  onDone,
}: {
  rows: ScorecardCriterionRow[]
  saving: boolean
  onSave: (items: CriterionInput[]) => void
  onDone: () => void
}) {
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
    if (!valid || saving) return
    onSave(
      items.map(({ key, side, label, isActive }) => ({ key, side, label: label.trim(), isActive })),
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
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={!valid} loading={saving}>
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
