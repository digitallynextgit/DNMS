"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateField } from "@/components/shared/date-field"
import { useGoalResultMutations } from "../hooks/use-goals"
import { fmtDate, type GoalNode } from "./goal-status"
import { GoalNumber, fmtNumber } from "./goal-number"

/** Today as yyyy-MM-dd in the viewer's own calendar. */
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Enter a number against a goal (or its part), and see / remove what was entered. */
export function GoalResultsDialog({
  projectId,
  goal,
  canManage,
  currentUserId,
  onClose,
}: {
  projectId: string
  goal: GoalNode | null
  canManage: boolean
  currentUserId?: string
  onClose: () => void
}) {
  return (
    <Dialog open={goal !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {goal && (
          <ResultsBody
            key={goal.id}
            projectId={projectId}
            goal={goal}
            canManage={canManage}
            currentUserId={currentUserId}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ResultsBody({
  projectId,
  goal,
  canManage,
  currentUserId,
}: {
  projectId: string
  goal: GoalNode
  canManage: boolean
  currentUserId?: string
}) {
  const { addResult, removeResult } = useGoalResultMutations(projectId)
  // Inside the edition's month: today if it is in it, else its last day.
  const today = localToday()
  const defaultDay =
    goal.periodStart && goal.periodEnd && (today < goal.periodStart || today > goal.periodEnd)
      ? goal.periodEnd
      : today
  const [value, setValue] = React.useState("")
  const [day, setDay] = React.useState(defaultDay)
  const [note, setNote] = React.useState("")
  const fromMeta = goal.actualSource === "META_PURCHASES"
  const n = Number(value)
  const valid = value !== "" && Number.isFinite(n) && n >= 0 && day !== ""

  const save = () => {
    if (!valid || addResult.isPending) return
    addResult.mutate(
      { goalId: goal.id, value: n, recordedFor: day, note: note.trim() || null },
      {
        onSuccess: () => {
          setValue("")
          setNote("")
        },
      },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Results · {goal.title}</DialogTitle>
        <DialogDescription>
          {fromMeta
            ? "These come from Meta Ads purchases automatically - nothing to enter."
            : `Add the ${goal.metricLabel?.toLowerCase() ?? "numbers"} you got - e.g. this week's. They add up to the goal's total.`}
        </DialogDescription>
      </DialogHeader>

      <GoalNumber goal={goal} />

      {!fromMeta && (
        <div className="space-y-3 rounded-sm border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label required className="text-muted-foreground text-[11px]">
                {goal.metricLabel ?? "Number"}
              </Label>
              <Input
                autoFocus
                type="number"
                inputMode="numeric"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder="e.g. 180"
                aria-label={goal.metricLabel ?? "Number"}
              />
            </div>
            <div className="space-y-1.5">
              <Label required className="text-muted-foreground text-[11px]">
                For
              </Label>
              <DateField value={day} onChange={setDay} placeholder="Day" modal />
            </div>
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Note (optional) - e.g. week of 5 Oct, Diwali sale"
            aria-label="Note"
          />
          {goal.periodStart && (
            <p className="text-muted-foreground text-[11px]">
              This month&rsquo;s edition takes days from {fmtDate(goal.periodStart)} to{" "}
              {fmtDate(goal.periodEnd)}.
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={save} disabled={!valid} loading={addResult.isPending}>
              Save result
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-muted-foreground text-[11px] tracking-widest uppercase">
          Entered ({goal.results.length})
        </p>
        {goal.results.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {fromMeta ? "Meta results don't list here." : "Nothing entered yet."}
          </p>
        ) : (
          <ul className="divide-y rounded-sm border">
            {goal.results.map((r) => {
              const mine = r.enteredById === currentUserId
              return (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="text-muted-foreground w-20 shrink-0 tabular-nums">
                    {fmtDate(r.recordedFor)}
                  </span>
                  <span className="w-16 shrink-0 text-right font-semibold tabular-nums">
                    {fmtNumber(r.value)}
                  </span>
                  <span
                    className="text-muted-foreground min-w-0 flex-1 truncate"
                    title={r.note ?? ""}
                  >
                    {r.note ?? ""}
                    {r.enteredByName && (
                      <span className="text-muted-foreground/70"> · {r.enteredByName}</span>
                    )}
                  </span>
                  {(canManage || mine) && (
                    <button
                      type="button"
                      onClick={() => removeResult.mutate({ goalId: goal.id, resultId: r.id })}
                      disabled={removeResult.isPending}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Remove this result"
                      title="Remove this result"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
