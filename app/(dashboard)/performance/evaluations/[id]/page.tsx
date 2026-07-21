"use client"

import * as React from "react"
import { use, useEffect, useMemo, useState, useCallback } from "react"
import { Printer } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  useEvaluation,
  useSubmitEvaluation,
  scoreEvaluation,
  isRatingComplete,
  RATING_LABELS,
  performanceAction,
  type EvalCriterion,
} from "@/features/performance"

type Side = "SELF" | "MANAGER" | "CONTROLLER"

const TONE: Record<string, string> = {
  red: "border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  amber:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  blue: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  green:
    "border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300",
}

const SIDE_LABEL: Record<Side, string> = {
  SELF: "Self-evaluation",
  MANAGER: "Manager review",
  CONTROLLER: "Project controller review",
}

function Rating({
  value,
  editable,
  onChange,
}: {
  value?: number
  editable: boolean
  onChange?: (n: number) => void
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!editable}
          title={RATING_LABELS[n - 1]}
          onClick={() => onChange?.(n)}
          className={cn(
            "h-7 w-7 rounded border text-xs font-semibold transition-colors",
            value === n
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted/30 text-muted-foreground",
            editable && "hover:border-primary cursor-pointer",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// ─── Scorecard panels ─────────────────────────────────────────────────────────
// These MUST live at module scope. They used to be declared inside the page
// component, which gave them a new function identity on every render - React then
// treated them as a different component type and unmounted + remounted the whole
// scorecard on EVERY keystroke in the comment box and every rating click.

interface SectionProps {
  label: string
  heading: string
  items: EvalCriterion[]
  effective: Record<string, number>
  perCriterion: Record<string, number>
  isEditableHere: boolean
  hidden: boolean
  onRate: (id: string, n: number) => void
}

const Section = React.memo(function Section({
  heading,
  items,
  effective,
  perCriterion,
  isEditableHere,
  hidden,
  onRate,
}: SectionProps) {
  if (items.length === 0) return null
  const weight = Math.round(items.reduce((s, c) => s + c.weight, 0))
  const sub = scoreEvaluation(items, effective).total
  return (
    <div>
      <div className="text-muted-foreground flex items-center justify-between px-4 py-2 text-xs font-medium">
        <span>
          {heading} <span className="text-muted-foreground/70">({weight}%)</span>
        </span>
        {!hidden && (
          <span>
            <span className="text-foreground font-semibold">{sub}</span> / {weight}
          </span>
        )}
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {items.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2.5 align-middle">
                <p className="leading-tight">{c.label}</p>
                <p className="text-muted-foreground text-[11px]">{Math.round(c.weight)}%</p>
              </td>
              <td className="px-2 py-2.5 text-right align-middle">
                <div className="flex justify-end">
                  <Rating
                    value={effective[c.id]}
                    editable={isEditableHere}
                    onChange={(n) => onRate(c.id, n)}
                  />
                </div>
              </td>
              <td className="text-muted-foreground w-10 px-2 py-2.5 text-right align-middle tabular-nums">
                {hidden ? "-" : (perCriterion[c.id] ?? "-")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

interface SidePanelProps {
  title: string
  accent: string
  criteria: EvalCriterion[]
  effective: Record<string, number>
  isEditableHere: boolean
  hidden: boolean
  /** This side's submitted note, shown read-only under the ratings. */
  comment: string | null
  sectionALabel: string
  sectionBLabel: string
  onRate: (id: string, n: number) => void
}

const SidePanel = React.memo(function SidePanel({
  title,
  accent,
  criteria,
  effective,
  isEditableHere,
  hidden,
  comment,
  sectionALabel,
  sectionBLabel,
  onRate,
}: SidePanelProps) {
  const score = scoreEvaluation(criteria, effective)
  const sectionA = criteria.filter((c) => c.section === "A")
  const sectionB = criteria.filter((c) => c.section === "B")

  return (
    <Card className="overflow-hidden">
      <CardHeader className={cn("border-b py-3", accent)}>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{title}</span>
          <span className="text-xs font-normal">
            {hidden ? (
              <span className="text-muted-foreground">Awaiting submission</span>
            ) : (
              <>
                Total <span className="text-foreground font-bold">{score.total}</span> / 100
              </>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {hidden ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-xs">Not submitted yet.</p>
        ) : (
          <div className="divide-y">
            <Section
              label="A"
              heading={sectionALabel}
              items={sectionA}
              effective={effective}
              perCriterion={score.perCriterion}
              isEditableHere={isEditableHere}
              hidden={hidden}
              onRate={onRate}
            />
            <Section
              label="B"
              heading={sectionBLabel}
              items={sectionB}
              effective={effective}
              perCriterion={score.perCriterion}
              isEditableHere={isEditableHere}
              hidden={hidden}
              onRate={onRate}
            />
            {comment?.trim() && (
              <div className="bg-muted/30 px-4 py-3">
                <p className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide uppercase">
                  Comment
                </p>
                <p className="text-sm whitespace-pre-wrap">{comment.trim()}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

/**
 * Placeholder shaped like a real SidePanel: the same tinted header (real title,
 * so the two scorecards are identifiable while loading) over criterion rows -
 * label + the five 7x7 rating buttons + the score column.
 */
function SidePanelSkeleton({ title, accent }: { title: string; accent: string }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className={cn("border-b py-3", accent)}>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{title}</span>
          <Skeleton className="h-4 w-20" />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {Array.from({ length: 2 }).map((_, section) => (
            <div key={section}>
              <div className="flex items-center justify-between px-4 py-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-10" />
              </div>
              {Array.from({ length: 4 }).map((_, row) => (
                <div key={row} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, n) => (
                      <Skeleton key={n} className="h-7 w-7 rounded" />
                    ))}
                  </div>
                  <Skeleton className="h-4 w-6" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function EvaluationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading } = useEvaluation(id)
  const submit = useSubmitEvaluation(id)

  const ev = data?.data
  const viewerRole = data?.viewerRole

  // Which side the viewer fills.
  const editableSide: Side | null =
    viewerRole === "EMPLOYEE"
      ? "SELF"
      : viewerRole === "CONTROLLER"
        ? "CONTROLLER"
        : viewerRole === "MANAGER" || viewerRole === "HR"
          ? "MANAGER"
          : null

  const submittedAt =
    editableSide === "SELF"
      ? ev?.selfSubmittedAt
      : editableSide === "CONTROLLER"
        ? ev?.controllerSubmittedAt
        : editableSide === "MANAGER"
          ? ev?.managerSubmittedAt
          : null
  const canEdit = !!editableSide && !submittedAt
  const hasController = !!ev?.controllerId

  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [comment, setComment] = useState("")

  useEffect(() => {
    if (!ev || !editableSide) return
    const map =
      editableSide === "SELF"
        ? ev.selfRatings
        : editableSide === "CONTROLLER"
          ? ev.controllerRatings
          : ev.managerRatings
    const cmt =
      editableSide === "SELF"
        ? ev.selfComment
        : editableSide === "CONTROLLER"
          ? ev.controllerComment
          : ev.managerComment
    setRatings(map ?? {})
    setComment(cmt ?? "")
  }, [ev, editableSide])

  // Must sit with the other hooks, above every early return.
  const onRate = useCallback((id: string, n: number) => {
    setRatings((r) => ({ ...r, [id]: n }))
  }, [])

  const selfCriteria = (ev?.selfCriteria ?? []) as EvalCriterion[]
  const managerCriteria = (ev?.managerCriteria ?? []) as EvalCriterion[]

  // Live final = manager ratings (official). Preview a manager's draft as they edit.
  const managerRatingsLive =
    canEdit && editableSide === "MANAGER" ? ratings : (ev?.managerRatings ?? undefined)
  const managerScore = useMemo(
    () => scoreEvaluation(managerCriteria, managerRatingsLive),
    [managerCriteria, managerRatingsLive],
  )
  const managerShown = !!ev?.managerSubmittedAt || (canEdit && editableSide === "MANAGER")
  const verdict = managerShown ? performanceAction(managerScore.total) : null

  const editableCriteria = editableSide === "SELF" ? selfCriteria : managerCriteria

  function handleSubmit() {
    if (!editableSide) return
    submit.mutate({ role: editableSide, ratings, comment }, { onSuccess: () => undefined })
  }

  // Only a LOADED-but-missing evaluation is "not found"; while loading we paint
  // the shell and placehold just the scorecards.
  if (!isLoading && !ev)
    return (
      <p className="text-muted-foreground py-20 text-center text-sm">
        Evaluation not found or you don&apos;t have access.
      </p>
    )

  const panelProps = (side: Side, storedRatings: Record<string, number> | null) => {
    const isEditableHere = canEdit && editableSide === side
    const storedComment =
      side === "SELF"
        ? ev?.selfComment
        : side === "CONTROLLER"
          ? ev?.controllerComment
          : ev?.managerComment
    return {
      isEditableHere,
      effective: isEditableHere ? ratings : (storedRatings ?? {}),
      hidden: !isEditableHere && !storedRatings, // e.g. employee before manager submits
      // The submitted note for this side, shown read-only under its ratings.
      comment: storedComment ?? null,
      sectionALabel: ev?.sectionALabel ?? "",
      sectionBLabel: ev?.sectionBLabel ?? "",
      onRate,
    }
  }

  return (
    <div className="space-y-6">
      <div id="print-area" className="space-y-6">
        {/* The title/description are part of the printed PDF, but the controls are not:
            the print action carries .no-print, and print:[&>a]:hidden drops PageHeader's
            back link (the header's only <a>) from the printout. */}
        <PageHeader
          className="print:[&>a]:hidden"
          title={
            ev
              ? `${ev.employee.firstName} ${ev.employee.lastName} - ${ev.periodLabel}`
              : "Performance Evaluation"
          }
          description={
            ev ? (
              `Performance evaluation${ev.dueDate ? ` · due ${new Date(ev.dueDate).toLocaleDateString("en-IN")}` : ""}`
            ) : (
              <Skeleton className="h-4 w-56" />
            )
          }
          backHref={viewerRole === "HR" ? "/performance/evaluations" : "/performance/me"}
          backLabel={viewerRole === "HR" ? "Back to Evaluations" : "Back to My Performance"}
          actions={
            <Button
              variant="outline"
              size="sm"
              className="no-print gap-1.5"
              disabled={!ev}
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
          }
        />

        {/* Status / final score */}
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-muted-foreground">Self</p>
                {ev ? (
                  <p className="font-medium">{ev.selfSubmittedAt ? "Submitted" : "Pending"}</p>
                ) : (
                  <Skeleton className="my-1 h-4 w-16" />
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Manager</p>
                {ev ? (
                  <p className="font-medium">{ev.managerSubmittedAt ? "Submitted" : "Pending"}</p>
                ) : (
                  <Skeleton className="my-1 h-4 w-16" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-muted-foreground text-sm">Final Score</p>
                {ev ? (
                  <p className="text-2xl font-bold">
                    {managerShown ? `${managerScore.total}` : "-"}
                    <span className="text-muted-foreground text-base font-normal"> / 100</span>
                  </p>
                ) : (
                  <Skeleton className="mt-1 ml-auto h-8 w-24" />
                )}
              </div>
              {verdict && (
                <Badge variant="outline" className={cn("h-fit", TONE[verdict.tone])}>
                  {verdict.band}: {verdict.action}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <div className={cn("grid gap-6", hasController ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          {ev ? (
            <>
              <SidePanel
                title="Manager Evaluation"
                accent="bg-blue-50/60 dark:bg-blue-950/20"
                criteria={managerCriteria}
                {...panelProps("MANAGER", ev.managerRatings)}
              />
              <SidePanel
                title="Self-Evaluation"
                accent="bg-emerald-50/60 dark:bg-emerald-950/20"
                criteria={selfCriteria}
                {...panelProps("SELF", ev.selfRatings)}
              />
              {hasController && (
                <SidePanel
                  title="Project Controller"
                  accent="bg-amber-50/60 dark:bg-amber-950/20"
                  criteria={managerCriteria}
                  {...panelProps("CONTROLLER", ev.controllerRatings)}
                />
              )}
            </>
          ) : (
            <>
              <SidePanelSkeleton
                title="Manager Evaluation"
                accent="bg-blue-50/60 dark:bg-blue-950/20"
              />
              <SidePanelSkeleton
                title="Self-Evaluation"
                accent="bg-emerald-50/60 dark:bg-emerald-950/20"
              />
            </>
          )}
        </div>
      </div>

      {/* Comments + submit for the viewer's side (not part of the printed PDF) */}
      {ev && editableSide && (
        <Card className="no-print">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{SIDE_LABEL[editableSide]} comments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={
                canEdit
                  ? comment
                  : ((editableSide === "SELF"
                      ? ev.selfComment
                      : editableSide === "CONTROLLER"
                        ? ev.controllerComment
                        : ev.managerComment) ?? "")
              }
              onChange={(e) => setComment(e.target.value)}
              disabled={!canEdit}
              rows={3}
              placeholder="Optional notes…"
            />
            {canEdit ? (
              <div className="flex items-center justify-end gap-3">
                {!isRatingComplete(editableCriteria, ratings) && (
                  <span className="text-muted-foreground text-xs">Rate every item to submit</span>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={submit.isPending || !isRatingComplete(editableCriteria, ratings)}
                >
                  {submit.isPending ? "Submitting…" : `Submit ${SIDE_LABEL[editableSide]}`}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                You&apos;ve already submitted your {SIDE_LABEL[editableSide].toLowerCase()}.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
