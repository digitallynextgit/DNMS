"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { FormDialog } from "@/components/shared/form-dialog"
import { cn } from "@/lib/utils"
import type { ReviewParam } from "../lib/weekly-review"
import {
  useDefaultReviewParams,
  useUpdateDefaultReviewParams,
  useUpdateWeekParams,
  type ParamInput,
} from "../hooks/use-weekly-review"

// The parameters a manager scores on a Friday: rename, reorder, hide (never delete - old scores
// keep their meaning) and add. Either one Friday of one joinee, or the company default.

interface Draft extends ParamInput {
  /** Stable React key for rows that have no parameter key yet. */
  tmpId: string
}

export function ReviewParamsDialog({
  open,
  onOpenChange,
  week,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** This Friday of this joinee; left out, the dialog edits the default for new reviews. */
  week?: {
    reviewId: string
    employeeId: string
    weekNumber: number
    label: string
    params: ReviewParam[]
  }
}) {
  const defaults = useDefaultReviewParams(open && !week)
  const saveDefault = useUpdateDefaultReviewParams()
  // Called either way (hooks can't be conditional); only used when there is a week.
  const saveWeek = useUpdateWeekParams(week?.employeeId ?? "", week?.reviewId ?? "")
  const saving = week ? saveWeek.isPending : saveDefault.isPending
  const rows = week ? week.params : defaults.data
  const done = { onSuccess: () => onOpenChange(false) }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={week ? `Parameters for ${week.label}` : "Default parameters for new reviews"}
      description={
        week
          ? "What the manager scores on this Friday only. Other Fridays keep theirs; hiding a parameter keeps the scores already given."
          : "Every new weekly review starts with these on each Friday. Reviews already started keep their own."
      }
      isEdit
      size="lg"
      submitLabel="Save parameters"
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
        <ParamsEditor
          key={String(open)}
          rows={rows}
          saving={saving}
          onSave={(items) =>
            week
              ? saveWeek.mutate({ weekNumber: week.weekNumber, items }, done)
              : saveDefault.mutate(items, done)
          }
          onDone={() => onOpenChange(false)}
        />
      )}
    </FormDialog>
  )
}

function ParamsEditor({
  rows,
  saving,
  onSave,
  onDone,
}: {
  rows: ReviewParam[]
  saving: boolean
  onSave: (items: ParamInput[]) => void
  onDone: () => void
}) {
  const [items, setItems] = useState<Draft[]>(() => rows.map((r) => ({ ...r, tmpId: r.key })))

  const patch = (tmpId: string, change: Partial<Draft>) =>
    setItems((prev) => prev.map((i) => (i.tmpId === tmpId ? { ...i, ...change } : i)))
  const remove = (tmpId: string) => setItems((prev) => prev.filter((i) => i.tmpId !== tmpId))
  const add = () =>
    setItems((prev) => [
      ...prev,
      { key: null, label: "", isActive: true, tmpId: `new-${Date.now()}-${prev.length}` },
    ])
  const move = (at: number, dir: -1 | 1) =>
    setItems((prev) => {
      const to = at + dir
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      ;[next[at], next[to]] = [next[to]!, next[at]!]
      return next
    })

  const valid = items.every((i) => i.label.trim()) && items.some((i) => i.isActive)

  const submit = () => {
    if (!valid || saving) return
    onSave(items.map(({ key, label, isActive }) => ({ key, label: label.trim(), isActive })))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Parameters
        </h4>
        <Button type="button" variant="ghost" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li
            key={item.tmpId}
            className={cn("flex items-center gap-1.5", !item.isActive && "opacity-60")}
          >
            <Input
              value={item.label}
              placeholder="Parameter name"
              maxLength={60}
              autoFocus={item.key === null && !item.label}
              onChange={(e) => patch(item.tmpId, { label: e.target.value })}
              className={cn("h-9", !item.isActive && "line-through")}
            />
            <IconButton
              label={idx === 0 ? "Already first" : "Move up"}
              disabled={idx === 0}
              onClick={() => move(idx, -1)}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label={idx === items.length - 1 ? "Already last" : "Move down"}
              disabled={idx === items.length - 1}
              onClick={() => move(idx, 1)}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </IconButton>
            {item.key === null ? (
              <IconButton label="Remove" onClick={() => remove(item.tmpId)}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
            ) : (
              <IconButton
                label={item.isActive ? "Hide this parameter" : "Show this parameter"}
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

      {!valid && (
        <p className="text-destructive text-xs">
          Every parameter needs a name, and at least one has to stay visible.
        </p>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={!valid} loading={saving}>
          Save parameters
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
