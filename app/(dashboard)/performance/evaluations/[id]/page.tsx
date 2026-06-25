"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useEvaluation, useSubmitEvaluation } from "@/features/performance"
import {
  scoreEvaluation,
  isRatingComplete,
  RATING_LABELS,
  type EvalCriterion,
} from "@/features/performance"
import { performanceAction } from "@/features/performance"

const TONE: Record<string, string> = {
  red: "border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  amber:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  blue: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  green:
    "border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300",
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

export default function EvaluationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading } = useEvaluation(id)
  const submit = useSubmitEvaluation(id)

  const ev = data?.data
  const viewerRole = data?.viewerRole

  // Which column the viewer fills, and whether they've already submitted it.
  const editableSide: "SELF" | "MANAGER" | "CONTROLLER" | null =
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

  const sideLabel: Record<string, string> = {
    SELF: "self-evaluation",
    MANAGER: "manager review",
    CONTROLLER: "project controller review",
  }

  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [comment, setComment] = useState("")

  useEffect(() => {
    if (!ev) return
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

  const criteria = (ev?.criteria ?? []) as EvalCriterion[]
  const sectionA = criteria.filter((c) => c.section === "A")
  const sectionB = criteria.filter((c) => c.section === "B")

  // Live final = manager ratings (the official score). While a manager edits, preview their draft.
  const managerRatings = canEdit && editableSide === "MANAGER" ? ratings : ev?.managerRatings
  const managerScore = useMemo(
    () => scoreEvaluation(criteria, managerRatings),
    [criteria, managerRatings],
  )
  const verdict =
    ev?.managerSubmittedAt || (canEdit && editableSide === "MANAGER")
      ? performanceAction(managerScore.total)
      : null

  function handleSubmit() {
    if (!editableSide) return
    submit.mutate({ role: editableSide, ratings, comment })
  }

  if (isLoading) return <Skeleton className="h-96 rounded" />
  if (!ev)
    return (
      <p className="text-muted-foreground py-20 text-center text-sm">
        Evaluation not found or you don&apos;t have access.
      </p>
    )

  const renderSide = (side: "SELF" | "MANAGER" | "CONTROLLER", c: EvalCriterion) => {
    const isEditableHere = canEdit && editableSide === side
    const storedMap =
      side === "SELF"
        ? ev.selfRatings
        : side === "CONTROLLER"
          ? ev.controllerRatings
          : ev.managerRatings
    const value = isEditableHere ? ratings[c.id] : storedMap?.[c.id]
    return (
      <Rating
        value={value}
        editable={isEditableHere}
        onChange={(n) => setRatings((r) => ({ ...r, [c.id]: n }))}
      />
    )
  }

  const Section = ({ label, items }: { label: string; items: EvalCriterion[] }) => {
    const weight = items.reduce((s, c) => s + c.weight, 0)
    const secScore = scoreEvaluation(items, managerRatings).total
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>
              {label === "A" ? ev.sectionALabel : ev.sectionBLabel}
              <span className="text-muted-foreground ml-2 font-normal">({weight}%)</span>
            </span>
            <span className="text-muted-foreground text-xs font-normal">
              Manager: <span className="text-foreground font-semibold">{secScore}</span> / {weight}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="px-4 py-2 font-medium">Criterion</th>
                <th className="px-2 py-2 text-center font-medium">Wt%</th>
                <th className="px-4 py-2 font-medium">Self</th>
                <th className="px-4 py-2 font-medium">Manager</th>
                {hasController && <th className="px-4 py-2 font-medium">Controller</th>}
                <th className="px-2 py-2 text-right font-medium">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5">{c.label}</td>
                  <td className="text-muted-foreground px-2 py-2.5 text-center">{c.weight}</td>
                  <td className="px-4 py-2.5">{renderSide("SELF", c)}</td>
                  <td className="px-4 py-2.5">{renderSide("MANAGER", c)}</td>
                  {hasController && <td className="px-4 py-2.5">{renderSide("CONTROLLER", c)}</td>}
                  <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                    {managerScore.perCriterion[c.id] ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link href="/performance/evaluations">
            <ArrowLeft className="h-4 w-4" /> Back to Evaluations
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      <div id="print-area" className="space-y-6">
        <PageHeader
          title={`${ev.employee.firstName} ${ev.employee.lastName} - ${ev.periodLabel}`}
          description={`Performance evaluation${ev.dueDate ? ` · due ${new Date(ev.dueDate).toLocaleDateString("en-IN")}` : ""}`}
        />

        {/* Status / final score */}
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-muted-foreground">Self</p>
                <p className="font-medium">{ev.selfSubmittedAt ? "Submitted" : "Pending"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Manager</p>
                <p className="font-medium">{ev.managerSubmittedAt ? "Submitted" : "Pending"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-muted-foreground text-sm">Final Score</p>
                <p className="text-2xl font-bold">
                  {ev.managerSubmittedAt || (canEdit && editableSide === "MANAGER")
                    ? `${managerScore.total}`
                    : "-"}
                  <span className="text-muted-foreground text-base font-normal"> / 100</span>
                </p>
              </div>
              {verdict && (
                <Badge variant="outline" className={cn("h-fit", TONE[verdict.tone])}>
                  {verdict.band}: {verdict.action}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Section label="A" items={sectionA} />
        <Section label="B" items={sectionB} />
      </div>

      {/* Comments + submit for the viewer's side (not part of the printed PDF) */}
      {editableSide && (
        <Card className="no-print">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm capitalize">{sideLabel[editableSide]} comments</CardTitle>
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
                {!isRatingComplete(criteria, ratings) && (
                  <span className="text-muted-foreground text-xs">
                    Rate every criterion to submit
                  </span>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={submit.isPending || !isRatingComplete(criteria, ratings)}
                >
                  {submit.isPending ? "Submitting…" : `Submit ${sideLabel[editableSide]}`}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                You&apos;ve already submitted your {sideLabel[editableSide]}.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
