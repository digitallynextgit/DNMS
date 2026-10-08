"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, Plus, Target as TargetIcon, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateField } from "@/components/shared/date-field"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useGoalTargetMutations } from "../hooks/use-goals"
import { useProjectDeliverables } from "../hooks/use-deliverables"
import { MAX_TYPE_LENGTH } from "../lib/deliverable-types"
import type { GoalNode, GoalTarget } from "./goal-status"

// Over-delivery reads as met and 100%, never 140%.

function shortDay(iso: string, withYear: boolean): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  })
}

/** "1-30 Sep", "from 1 Sep", "until 30 Sep", or null for an open-ended target. */
export function periodLabel(t: Pick<GoalTarget, "periodStart" | "periodEnd">): string | null {
  const { periodStart: a, periodEnd: b } = t
  if (!a && !b) return null
  if (a && !b) return `from ${shortDay(a, true)}`
  if (!a && b) return `until ${shortDay(b, true)}`
  const sameMonth = a!.slice(0, 7) === b!.slice(0, 7)
  if (sameMonth) return `${a!.slice(8).replace(/^0/, "")}-${shortDay(b!, true)}`
  const sameYear = a!.slice(0, 4) === b!.slice(0, 4)
  return `${shortDay(a!, !sameYear)} - ${shortDay(b!, true)}`
}

export function GoalTargetRow({ t, className }: { t: GoalTarget; className?: string }) {
  const period = periodLabel(t)
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]", className)}>
      <span
        className={cn(
          "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
          t.met ? "bg-emerald-500/15 text-emerald-500" : "text-muted-foreground/50 border",
        )}
        aria-hidden
      >
        {t.met ? <Check className="h-2.5 w-2.5" /> : null}
      </span>
      <span className="font-medium">{t.type}</span>
      <span className={cn("tabular-nums", t.met ? "text-emerald-500" : "text-muted-foreground")}>
        {t.made} / {t.quantity}
      </span>
      {period && <span className="text-muted-foreground">{period}</span>}
      <span className="bg-muted h-1 w-20 shrink-0 overflow-hidden rounded-full">
        <span
          className={cn("block h-full rounded-full", t.met ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${Math.max(0, Math.min(100, t.progress))}%` }}
        />
      </span>
    </div>
  )
}

export function GoalTargetList({
  targets,
  className,
}: {
  targets: GoalTarget[]
  className?: string
}) {
  if (targets.length === 0) return null
  return (
    <div className={cn("space-y-1", className)}>
      {targets.map((t) => (
        <GoalTargetRow key={t.id} t={t} />
      ))}
    </div>
  )
}

interface Draft {
  deliverableType: string
  quantity: string
  periodStart: string
  periodEnd: string
}

const EMPTY_DRAFT: Draft = { deliverableType: "", quantity: "", periodStart: "", periodEnd: "" }

/** The type is free text, suggested from what the project has produced; the server folds case. */
function TargetForm({
  projectId,
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  projectId: string
  initial?: GoalTarget
  pending: boolean
  onCancel: () => void
  onSubmit: (body: {
    deliverableType: string
    quantity: number
    periodStart: string | null
    periodEnd: string | null
  }) => void
}) {
  const [draft, setDraft] = React.useState<Draft>(() =>
    initial
      ? {
          deliverableType: initial.type,
          quantity: String(initial.quantity),
          periodStart: initial.periodStart ?? "",
          periodEnd: initial.periodEnd ?? "",
        }
      : EMPTY_DRAFT,
  )
  const listId = React.useId()
  // Mounted only while the form is open, so idle goals don't fetch the ledger.
  const ledger = useProjectDeliverables(projectId, {})
  const types = ledger.data?.types?.length ? ledger.data.types : (ledger.data?.suggestedTypes ?? [])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const qty = Number(draft.quantity)
  const badPeriod = Boolean(
    draft.periodStart && draft.periodEnd && draft.periodStart > draft.periodEnd,
  )
  const valid =
    draft.deliverableType.trim().length > 0 &&
    draft.deliverableType.trim().length <= MAX_TYPE_LENGTH &&
    Number.isInteger(qty) &&
    qty >= 1 &&
    !badPeriod

  const submit = () => {
    if (!valid || pending) return
    onSubmit({
      deliverableType: draft.deliverableType.trim(),
      quantity: qty,
      periodStart: draft.periodStart || null,
      periodEnd: draft.periodEnd || null,
    })
  }

  return (
    <div className="border-border/60 bg-background/60 space-y-2 rounded-sm border p-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-36 flex-1 space-y-1">
          <Label required className="text-muted-foreground text-[10px]">
            Type
          </Label>
          <Input
            autoFocus
            list={listId}
            value={draft.deliverableType}
            onChange={(e) => set("deliverableType", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Reel, Blog post, Banner…"
            aria-label="Deliverable type"
            maxLength={MAX_TYPE_LENGTH}
            className="h-8 text-xs"
          />
          <datalist id={listId}>
            {types.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="w-20 space-y-1">
          <Label required className="text-muted-foreground text-[10px]">
            How many
          </Label>
          <Input
            type="number"
            min={1}
            value={draft.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            aria-label="Quantity promised"
            className="h-8 text-xs"
          />
        </div>
        <div className="w-36 space-y-1">
          <Label className="text-muted-foreground text-[10px]">From (optional)</Label>
          <DateField
            value={draft.periodStart}
            onChange={(v) => set("periodStart", v)}
            placeholder="Any time"
            className="h-8 text-xs"
          />
        </div>
        <div className="w-36 space-y-1">
          <Label className="text-muted-foreground text-[10px]">To (optional)</Label>
          <DateField
            value={draft.periodEnd}
            onChange={(v) => set("periodEnd", v)}
            placeholder="Open-ended"
            className="h-8 text-xs"
          />
        </div>
        <Button onClick={submit} disabled={!valid || pending}>
          {initial ? "Save" : "Add"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {badPeriod && (
        <p className="text-destructive text-[11px]">The period ends before it starts.</p>
      )}
    </div>
  )
}

/** `canManage`, not `canStaff`: what was committed to the client is the account manager's to change. */
export function GoalTargets({
  projectId,
  goal,
  canManage,
  className,
  adding: addingProp,
  onAddingChange,
}: {
  projectId: string
  goal: GoalNode
  canManage: boolean
  className?: string
  /** Controlled "adding" state, owned by the goal card; left out, the component keeps its own. */
  adding?: boolean
  onAddingChange?: (v: boolean) => void
}) {
  const [addingSelf, setAddingSelf] = React.useState(false)
  const adding = addingProp ?? addingSelf
  const setAdding = onAddingChange ?? setAddingSelf
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [removing, setRemoving] = React.useState<GoalTarget | null>(null)
  const { addTarget, updateTarget, removeTarget } = useGoalTargetMutations(projectId)

  const targets = goal.targets
  // Still renders when empty, because it hosts the add dialog.
  const visible = targets.length > 0

  const pending = addTarget.isPending || updateTarget.isPending
  const fail = (e: Error) => toast.error(e.message)

  return (
    <div className={cn(visible && "space-y-1.5", visible && className)}>
      {targets.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <TargetIcon className="text-muted-foreground h-3 w-3" />
          <span className="text-muted-foreground font-medium">Promised</span>
        </div>
      )}
      <ul className="space-y-1">
        {targets.map((t) =>
          editingId === t.id ? (
            <li key={t.id}>
              <TargetForm
                projectId={projectId}
                initial={t}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(body) =>
                  updateTarget.mutate(
                    { goalId: goal.id, targetId: t.id, ...body },
                    { onSuccess: () => setEditingId(null), onError: fail },
                  )
                }
              />
            </li>
          ) : (
            <li key={t.id} className="group flex items-center gap-2">
              <GoalTargetRow t={t} className="min-w-0 flex-1" />
              {canManage && goal.isActive && (
                <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false)
                      setEditingId(t.id)
                    }}
                    aria-label={`Edit the ${t.type} target`}
                    title="Edit"
                    className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-4"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(t)}
                    aria-label={`Remove the ${t.type} target`}
                    title="Remove"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              )}
            </li>
          ),
        )}
      </ul>

      {canManage && goal.isActive && (
        <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add a target</DialogTitle>
              <DialogDescription>
                What this goal promises in countable output. Progress is then read off what has
                actually been delivered, not off task checkboxes.
              </DialogDescription>
            </DialogHeader>
            <TargetForm
              projectId={projectId}
              pending={pending}
              onCancel={() => setAdding(false)}
              onSubmit={(body) =>
                addTarget.mutate(
                  { goalId: goal.id, ...body },
                  { onSuccess: () => setAdding(false), onError: fail },
                )
              }
            />
          </DialogContent>
        </Dialog>
      )}

      {canManage && goal.isActive && addingProp === undefined && (
        <div>
          {adding ? null : (
            <Button
              variant="ghost"
              className="text-muted-foreground px-1.5"
              onClick={() => {
                setEditingId(null)
                setAdding(true)
              }}
            >
              <Plus className="mr-1.5 h-3 w-3" /> Target
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove the ${removing?.type ?? ""} target?`}
        description={`"${goal.title}" stops being measured against ${removing?.quantity ?? 0} ${
          removing?.type ?? ""
        }. Nothing that was delivered is deleted - only the promise it was counted against.`}
        confirmLabel="Remove target"
        variant="destructive"
        isLoading={removeTarget.isPending}
        onConfirm={() => {
          if (removing) {
            removeTarget.mutate({ goalId: goal.id, targetId: removing.id }, { onError: fail })
          }
          setRemoving(null)
        }}
      />
    </div>
  )
}
