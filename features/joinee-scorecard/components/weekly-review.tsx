"use client"

import { useState } from "react"
import { CalendarCheck, MoreHorizontal, Settings2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FormDialog } from "@/components/shared/form-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"
import { SCORING_GUIDE, formatScore } from "../lib/scorecard"
import {
  reviewSummary,
  weekAverage,
  weekIsOpen,
  weekState,
  type WeekState,
} from "../lib/weekly-review"
import {
  useDeleteWeeklyReview,
  useSaveWeek,
  useStartWeeklyReview,
  useWeeklyReview,
} from "../hooks/use-weekly-review"
import type { WeeklyReviewResponse, WeeklyReviewWeek } from "../types"
import { ReviewParamsDialog } from "./review-params-dialog"
import { SCORE_TONE, toneFor } from "./score-tone"

// After the 15-day scorecard: the reporting manager (or HR) reviews the joinee every Friday for
// 90 days. Each Friday has its own parameters; the joinee sees it read-only.

const name = (p: { firstName: string; lastName: string } | null | undefined) =>
  p ? `${p.firstName} ${p.lastName}`.trim() : "-"

/** "Fri 30 Oct" - stored dates are UTC midnights. */
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

/** Today as "YYYY-MM-DDT00:00:00Z" in the viewer's own calendar, for the date rules. */
function localToday() {
  const d = new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

const STATE_CHIP: Record<WeekState, { label: string; className: string }> = {
  done: {
    label: "Reviewed",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  due: { label: "Due", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  overdue: { label: "Overdue", className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  upcoming: { label: "Upcoming", className: "bg-muted text-muted-foreground" },
}

export function WeeklyReview({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useWeeklyReview(employeeId)

  if (isLoading) return <WeeklyReviewSkeleton />
  // A failed load must never read as "not started", or HR would start a duplicate.
  if (isError || !data) {
    return (
      <div className="bg-card flex flex-col items-center gap-3 rounded-sm border px-6 py-10 text-center">
        <p className="font-semibold">Couldn&apos;t load the weekly review</p>
        <p className="text-muted-foreground max-w-md text-sm">
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          Try again
        </Button>
      </div>
    )
  }
  if (!data.review) return <NotStarted employeeId={employeeId} data={data} />
  return <ReviewBody employeeId={employeeId} data={data} />
}

function NotStarted({ employeeId, data }: { employeeId: string; data: WeeklyReviewResponse }) {
  const start = useStartWeeklyReview(employeeId)
  const first = data.plannedFridays[0]
  const last = data.plannedFridays.at(-1)
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-sm border px-6 py-10 text-center">
      <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-sm">
        <CalendarCheck className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold">No weekly review yet</p>
        <p className="text-muted-foreground max-w-md text-sm">
          {data.canManage
            ? `After the 15-day scorecard, the reporting manager reviews ${data.employee.firstName} every Friday for 90 days${
                first && last
                  ? ` - ${data.plannedFridays.length} Fridays, ${dayLabel(first)} to ${dayLabel(last)}`
                  : ""
              }.`
            : "HR has not started a weekly review for this employee."}
        </p>
      </div>
      {data.canManage && (
        <Button onClick={() => start.mutate()} disabled={start.isPending}>
          Start weekly review
        </Button>
      )}
    </div>
  )
}

function ReviewBody({ employeeId, data }: { employeeId: string; data: WeeklyReviewResponse }) {
  const review = data.review!
  const remove = useDeleteWeeklyReview(employeeId, review.id)
  const [filling, setFilling] = useState<WeeklyReviewWeek | null>(null)
  const [paramsFor, setParamsFor] = useState<WeeklyReviewWeek | "default" | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const today = localToday()
  const weeks = review.weeks.map((w) => ({
    week: w,
    average: weekAverage(w.scores, w.params),
    state: weekState(w.date, !!w.reviewedAt, today),
    open: weekIsOpen(w.date, today),
  }))
  const summary = reviewSummary(weeks.map((w) => w.average))
  const reviewed = weeks.filter((w) => w.state === "done").length
  const first = review.weeks[0]?.date
  const last = review.weeks.at(-1)?.date
  // The Friday this week (or the next one), so it's easy to spot in a long list.
  const current = weeks.find((w) => w.week.date.slice(0, 10) >= today.toISOString().slice(0, 10))

  return (
    <div className="space-y-4">
      <section className="bg-card rounded-sm border">
        <header className="flex items-center gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">Weekly Review</h3>
            <p className="text-muted-foreground text-xs">
              {reviewed} of {review.weeks.length} Fridays reviewed
            </p>
          </div>
          {data.canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  aria-label="Weekly review actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setParamsFor("default")}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Default parameters for new reviews
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete weekly review
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        <dl className="grid gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Employee">{name(data.employee)}</Fact>
          <Fact label="Reviewed by">
            {data.employee.manager
              ? `${name(data.employee.manager)} (reporting manager)`
              : "HR - no reporting manager set"}
          </Fact>
          <Fact label="Review period">
            {review.weeks.length} Fridays
            {first && last && (
              <span className="text-muted-foreground">
                {" "}
                · {dayLabel(first)} - {dayLabel(last)}
              </span>
            )}
          </Fact>
          <Fact label="Overall">
            {summary.overall === null ? (
              <span className="text-muted-foreground">-</span>
            ) : (
              <span
                className={cn(
                  "inline-flex rounded-sm px-1.5 py-0.5 tabular-nums",
                  toneFor(summary.overall),
                )}
              >
                {formatScore(summary.overall)} / 5
              </span>
            )}
            <span className="text-muted-foreground ml-1.5 text-xs font-normal">
              over {summary.scoredWeeks} {summary.scoredWeeks === 1 ? "week" : "weeks"}
            </span>
          </Fact>
        </dl>
      </section>

      <section className="bg-card divide-y rounded-sm border">
        {weeks.map(({ week, average, state, open }) => {
          const active = week.params.filter((p) => p.isActive)
          const chip = STATE_CHIP[state]
          const isCurrent = current?.week.weekNumber === week.weekNumber
          return (
            <div
              key={week.weekNumber}
              className={cn(
                "flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-start",
                isCurrent && "bg-primary/5",
              )}
            >
              <div className="w-36 shrink-0">
                <p className="text-sm font-medium">
                  Week {week.weekNumber}
                  {isCurrent && (
                    <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                      this week
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">{dayLabel(week.date)}</p>
                {week.note && (
                  <p className="text-[10px] text-sky-600 dark:text-sky-400">{week.note}</p>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
                      chip.className,
                    )}
                  >
                    {chip.label}
                  </span>
                  {active.map((p) => {
                    const v = week.scores[p.key]
                    return (
                      <span
                        key={p.key}
                        className="bg-muted/50 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px]"
                      >
                        <span className="text-muted-foreground">{p.label}</span>
                        <span
                          className={cn(
                            "rounded-sm px-1 font-semibold tabular-nums",
                            v ? SCORE_TONE[v] : "text-muted-foreground/50",
                          )}
                        >
                          {v ?? "-"}
                        </span>
                      </span>
                    )
                  })}
                </div>
                {week.comment && (
                  <p className="text-muted-foreground line-clamp-2 text-xs whitespace-pre-wrap">
                    {week.comment}
                  </p>
                )}
                {week.reviewedBy && week.reviewedAt && (
                  <p className="text-muted-foreground/70 text-[10px]">
                    by {name(week.reviewedBy)} ·{" "}
                    {new Date(week.reviewedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "inline-flex min-w-10 justify-center rounded-sm px-1.5 py-0.5 text-sm font-semibold tabular-nums",
                    average === null ? "text-muted-foreground/50" : toneFor(average),
                  )}
                  title="This Friday's average"
                >
                  {formatScore(average)}
                </span>
                {data.canEdit &&
                  (open ? (
                    <Button
                      variant={state === "done" ? "outline" : "default"}
                      className="h-8 px-3 text-xs"
                      onClick={() => setFilling(week)}
                    >
                      {state === "done" ? "Edit" : "Review"}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground w-20 text-right text-[11px]">
                      Opens Monday
                    </span>
                  ))}
              </div>
            </div>
          )
        })}
      </section>

      <section className="bg-card rounded-sm border">
        <h3 className="border-b px-5 py-3 text-sm font-semibold">Scoring guide</h3>
        <ul className="grid gap-1.5 px-5 py-3 sm:grid-cols-2 lg:grid-cols-5">
          {SCORING_GUIDE.map((g) => (
            <li key={g.score} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm font-semibold",
                  SCORE_TONE[g.score],
                )}
              >
                {g.score}
              </span>
              <span className="font-medium">{g.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <WeekDialog
        employeeId={employeeId}
        reviewId={review.id}
        week={filling}
        onClose={() => setFilling(null)}
        onEditParams={(w) => {
          setFilling(null)
          setParamsFor(w)
        }}
      />

      <ReviewParamsDialog
        open={paramsFor !== null}
        onOpenChange={(o) => !o && setParamsFor(null)}
        week={
          paramsFor && paramsFor !== "default"
            ? {
                reviewId: review.id,
                employeeId,
                weekNumber: paramsFor.weekNumber,
                label: `week ${paramsFor.weekNumber} (${dayLabel(paramsFor.date)})`,
                params: paramsFor.params,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this weekly review?"
        description="Every Friday's scores and comments are deleted. You can start a fresh review afterwards."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => setConfirmDelete(false) })}
      />
    </div>
  )
}

/** One Friday: a 1-5 per visible parameter and a comment, saved together. */
function WeekDialog({
  employeeId,
  reviewId,
  week,
  onClose,
  onEditParams,
}: {
  employeeId: string
  reviewId: string
  week: WeeklyReviewWeek | null
  onClose: () => void
  onEditParams: (week: WeeklyReviewWeek) => void
}) {
  return (
    <FormDialog
      open={week !== null}
      onOpenChange={(o) => !o && onClose()}
      title={week ? `Week ${week.weekNumber} · ${dayLabel(week.date)}` : ""}
      description="Score each parameter from 1 (Unsatisfactory) to 5 (Excellent) for this week, then add a comment. Click a chosen score again to clear it."
      isEdit
      size="lg"
      submitLabel="Save"
      submitDisabled
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Remounts per Friday, so the draft starts from what is saved. */}
      {week && (
        <WeekForm
          key={week.weekNumber}
          employeeId={employeeId}
          reviewId={reviewId}
          week={week}
          onClose={onClose}
          onEditParams={() => onEditParams(week)}
        />
      )}
    </FormDialog>
  )
}

function WeekForm({
  employeeId,
  reviewId,
  week,
  onClose,
  onEditParams,
}: {
  employeeId: string
  reviewId: string
  week: WeeklyReviewWeek
  onClose: () => void
  onEditParams: () => void
}) {
  const save = useSaveWeek(employeeId, reviewId)
  const active = week.params.filter((p) => p.isActive)
  const [scores, setScores] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(active.map((p) => [p.key, week.scores[p.key] ?? null])),
  )
  const [comment, setComment] = useState(week.comment ?? "")

  const submit = () =>
    save.mutate(
      { weekNumber: week.weekNumber, scores, comment: comment.trim() || null },
      { onSuccess: onClose },
    )

  return (
    <div className="space-y-5">
      <ul className="space-y-2.5">
        {active.map((p) => (
          <li key={p.key} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">{p.label}</span>
            <div className="flex gap-1" role="radiogroup" aria-label={p.label}>
              {[1, 2, 3, 4, 5].map((n) => {
                const chosen = scores[p.key] === n
                const guide = SCORING_GUIDE.find((g) => g.score === n)
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    title={`${n} - ${guide?.label ?? ""}`}
                    onClick={() => setScores((s) => ({ ...s, [p.key]: chosen ? null : n }))}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-sm text-sm font-semibold transition-transform hover:scale-105",
                      chosen
                        ? cn(SCORE_TONE[n], "ring-foreground ring-2")
                        : "bg-muted/60 text-muted-foreground",
                    )}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-1.5">
        <label htmlFor={`week-comment-${week.weekNumber}`} className="text-sm font-medium">
          Comment
        </label>
        <Textarea
          id={`week-comment-${week.weekNumber}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="How did the week go? Wins, gaps, what to focus on next week…"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground"
          onClick={onEditParams}
        >
          <Settings2 className="mr-1.5 h-4 w-4" />
          Parameters for this Friday
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} loading={save.isPending}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  )
}

export function WeeklyReviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-sm border">
        <div className="border-b px-5 py-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
        <div className="grid gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card space-y-2 rounded-sm border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
