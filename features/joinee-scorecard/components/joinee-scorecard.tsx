"use client"

import { useState } from "react"
import { ClipboardCheck, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FormDialog } from "@/components/shared/form-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmployeeCombobox } from "@/features/employees"
import { TONE } from "@/lib/constants"
import { cn, formatDate } from "@/lib/utils"
import {
  RECOMMENDATIONS,
  SCORECARD_CRITERIA,
  SCORECARD_DAYS,
  SCORING_GUIDE,
  dayAverages,
  formatScore,
  ratingFor,
  scorecardSummary,
  type Recommendation,
  type ScoreKey,
} from "../lib/scorecard"
import {
  useDeleteScorecard,
  useScorecard,
  useSetDayScore,
  useStartScorecard,
  useUpdateScorecard,
} from "../hooks/use-scorecard"
import type { Scorecard } from "../types"

// One component everywhere: HR edits it (onboarding:write), the employee sees it read-only.

/** Colour for a score or an average, by the guide entry it rounds to. */
const SCORE_TONE: Record<number, string> = {
  5: TONE.green,
  4: TONE.emerald,
  3: TONE.amber,
  2: TONE.orange,
  1: TONE.red,
}
const toneFor = (score: number | null) =>
  score === null ? "" : (SCORE_TONE[ratingFor(score)?.score ?? 0] ?? "")

const name = (p: { firstName: string; lastName: string } | null | undefined) =>
  p ? `${p.firstName} ${p.lastName}`.trim() : "-"

/** "Mon 5 Oct" - stored dates are UTC midnights. */
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

/** Today as "YYYY-MM-DD" in the viewer's own calendar. */
function localTodayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

const MANAGER = SCORECARD_CRITERIA.filter((c) => c.side === "MANAGER")
const HR = SCORECARD_CRITERIA.filter((c) => c.side === "HR")

export function JoineeScorecard({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useScorecard(employeeId)

  if (isLoading) return <JoineeScorecardSkeleton />
  // A failed load must never read as "no scorecard yet", or HR would start a duplicate.
  if (isError || !data) {
    return (
      <div className="bg-card flex flex-col items-center gap-3 rounded-sm border px-6 py-10 text-center">
        <p className="font-semibold">Couldn&apos;t load the scorecard</p>
        <p className="text-muted-foreground max-w-md text-sm">
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          Try again
        </Button>
      </div>
    )
  }
  if (!data.scorecard) return <NotStarted employeeId={employeeId} canEdit={data.canEdit} />
  return <ScorecardBody employeeId={employeeId} card={data.scorecard} canEdit={data.canEdit} />
}

function NotStarted({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const start = useStartScorecard(employeeId)
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-sm border px-6 py-10 text-center">
      <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-sm">
        <ClipboardCheck className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold">No 15-day scorecard yet</p>
        <p className="text-muted-foreground max-w-md text-sm">
          {canEdit
            ? "Track this joinee's first 15 working days: daily 1-5 ratings by the reporting manager and HR, then observations and a recommendation."
            : "HR has not started a 15-day scorecard for this employee."}
        </p>
      </div>
      {canEdit && (
        <Button onClick={() => start.mutate({})} disabled={start.isPending}>
          Start scorecard
        </Button>
      )}
    </div>
  )
}

function ScorecardBody({
  employeeId,
  card,
  canEdit,
}: {
  employeeId: string
  card: Scorecard
  canEdit: boolean
}) {
  const update = useUpdateScorecard(employeeId, card.id)
  const remove = useDeleteScorecard(employeeId, card.id)
  const setScore = useSetDayScore(employeeId, card.id)
  const [spocOpen, setSpocOpen] = useState(false)
  const [spocId, setSpocId] = useState<string | undefined>(card.hrSpocId ?? undefined)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const summary = scorecardSummary(card.days)
  const first = card.days[0]?.date
  const last = card.days.at(-1)?.date
  const today = localTodayKey()

  return (
    <div className="space-y-4">
      <section className="bg-card rounded-sm border">
        <header className="flex items-center gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">15-Day New Joinee Scorecard</h3>
            <p className="text-muted-foreground text-xs">
              {summary.scoredDays} of {card.days.length} days scored
            </p>
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  aria-label="Scorecard actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete scorecard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        <dl className="grid gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Employee">{name(card.employee)}</Fact>
          <Fact label="Designation">{card.employee.designation?.title ?? "-"}</Fact>
          <Fact label="Joining date">{formatDate(card.employee.dateOfJoining)}</Fact>
          <Fact label="Evaluation period">
            {SCORECARD_DAYS} working days
            {first && last && (
              <span className="text-muted-foreground">
                {" "}
                · {dayLabel(first)} - {dayLabel(last)}
              </span>
            )}
          </Fact>
          <Fact label="Reporting manager">{name(card.employee.manager)}</Fact>
          <Fact label="HR SPOC">
            <span className="inline-flex items-center gap-1.5">
              {name(card.hrSpoc)}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setSpocOpen(true)}
                  className="text-muted-foreground hover:text-foreground rounded-sm p-0.5"
                  aria-label="Change HR SPOC"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          </Fact>
        </dl>
      </section>

      <section className="bg-card overflow-hidden rounded-sm border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground text-xs">
                <th rowSpan={2} className="w-20 px-4 py-2 text-left font-medium">
                  Day
                </th>
                <th rowSpan={2} className="w-28 px-2 py-2 text-left font-medium">
                  Date
                </th>
                <th colSpan={3} className="border-l px-2 pt-2 pb-1 text-center font-semibold">
                  Manager
                </th>
                <th colSpan={3} className="border-l px-2 pt-2 pb-1 text-center font-semibold">
                  HR
                </th>
                <th colSpan={3} className="border-l px-2 pt-2 pb-1 text-center font-semibold">
                  Average
                </th>
              </tr>
              <tr className="bg-muted/40 text-muted-foreground border-b text-[11px] leading-tight">
                {[...MANAGER, ...HR].map((c, i) => (
                  <th
                    key={c.key}
                    className={cn("px-2 pb-2 text-center font-medium", i % 3 === 0 && "border-l")}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="border-l px-2 pb-2 text-center font-medium">Manager</th>
                <th className="px-2 pb-2 text-center font-medium">HR</th>
                <th className="px-2 pb-2 text-center font-medium">Daily overall</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {card.days.map((day) => {
                const avg = dayAverages(day)
                const isToday = day.date.slice(0, 10) === today
                return (
                  <tr key={day.dayNumber} className={cn(isToday && "bg-primary/5")}>
                    <td className="px-4 py-1.5 font-medium whitespace-nowrap">
                      Day {day.dayNumber}
                      {isToday && (
                        <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                          today
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-2 py-1.5 whitespace-nowrap">
                      {dayLabel(day.date)}
                    </td>
                    {[...MANAGER, ...HR].map((c, i) => (
                      <td
                        key={c.key}
                        className={cn("px-2 py-1.5 text-center", i % 3 === 0 && "border-l")}
                      >
                        <ScoreCell
                          value={day[c.key]}
                          label={`Day ${day.dayNumber} - ${c.side === "HR" ? "HR" : "Manager"}: ${c.label}`}
                          editable={canEdit}
                          onChange={(value) =>
                            setScore.mutate({
                              dayNumber: day.dayNumber,
                              field: c.key as ScoreKey,
                              value,
                            })
                          }
                        />
                      </td>
                    ))}
                    <AvgCell value={avg.manager} first />
                    <AvgCell value={avg.hr} />
                    <AvgCell value={avg.overall} strong />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="bg-card rounded-sm border">
          <h3 className="border-b px-5 py-3 text-sm font-semibold">15-day summary</h3>
          <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
            <SummaryTile label="Manager average" value={summary.manager} />
            <SummaryTile label="HR average" value={summary.hr} />
            <SummaryTile label="Overall score" value={summary.overall} />
            <div className="px-5 py-4">
              <p className="text-muted-foreground text-xs">Overall rating</p>
              <p className="mt-1.5">
                {summary.rating ? (
                  <span
                    className={cn(
                      "inline-flex rounded-sm px-2 py-0.5 text-sm font-semibold",
                      toneFor(summary.overall),
                    )}
                  >
                    {summary.rating.label}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-lg">-</span>
                )}
              </p>
            </div>
          </div>
        </section>
        <section className="bg-card rounded-sm border">
          <h3 className="border-b px-5 py-3 text-sm font-semibold">Scoring guide</h3>
          <ul className="space-y-1.5 px-5 py-3">
            {SCORING_GUIDE.map((g) => (
              <li key={g.score} className="flex items-center gap-2.5 text-xs">
                <span
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm font-semibold",
                    SCORE_TONE[g.score],
                  )}
                >
                  {g.score}
                </span>
                <span className="font-medium">{g.label}</span>
                <span className="text-muted-foreground truncate">{g.description}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Observations
          key={card.managerObservations ?? ""}
          title="Manager - key observations"
          hint="Strengths, role-specific progress, client/account handling, areas requiring improvement."
          value={card.managerObservations}
          editable={canEdit}
          saving={update.isPending}
          onSave={(v) => update.mutate({ managerObservations: v })}
        />
        <Observations
          key={card.hrObservations ?? ""}
          title="HR - key observations"
          hint="Attendance, conduct, communication, collaboration, culture fit, learning and onboarding."
          value={card.hrObservations}
          editable={canEdit}
          saving={update.isPending}
          onSave={(v) => update.mutate({ hrObservations: v })}
        />
      </div>

      <section className="bg-card rounded-sm border">
        <h3 className="border-b px-5 py-3 text-sm font-semibold">15-day HR recommendation</h3>
        <div className="flex flex-wrap gap-2 px-5 py-4" role="radiogroup">
          {RECOMMENDATIONS.map((r) => {
            const chosen = card.recommendation === r.value
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={!canEdit || update.isPending}
                onClick={() =>
                  update.mutate({ recommendation: chosen ? null : (r.value as Recommendation) })
                }
                className={cn(
                  "flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors",
                  chosen ? "border-foreground bg-muted font-medium" : "text-muted-foreground",
                  canEdit ? "hover:bg-muted/60 hover:text-foreground" : "cursor-default",
                  !canEdit && !chosen && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border",
                    chosen && "border-foreground",
                  )}
                >
                  {chosen && <span className="bg-foreground h-2 w-2 rounded-full" />}
                </span>
                {r.label}
              </button>
            )
          })}
        </div>
      </section>

      <FormDialog
        open={spocOpen}
        onOpenChange={setSpocOpen}
        title="HR SPOC"
        isEdit
        isPending={update.isPending}
        size="sm"
        onSubmit={(e) => {
          e.preventDefault()
          update.mutate({ hrSpocId: spocId ?? null }, { onSuccess: () => setSpocOpen(false) })
        }}
      >
        <div className="space-y-2">
          <Label>HR point of contact for {card.employee.firstName}</Label>
          <EmployeeCombobox
            value={spocId}
            onChange={setSpocId}
            excludeId={card.employeeId}
            initialLabel={card.hrSpoc ? name(card.hrSpoc) : undefined}
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this scorecard?"
        description="Every score, observation and the recommendation are deleted. You can start a fresh scorecard afterwards."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => setConfirmDelete(false) })}
      />
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

/** One 1-5 score. HR clicks it to pick; everyone else just sees it. */
function ScoreCell({
  value,
  label,
  editable,
  onChange,
}: {
  value: number | null
  label: string
  editable: boolean
  onChange: (value: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const face = (
    <span
      className={cn(
        "inline-flex h-8 w-10 items-center justify-center rounded-sm text-sm font-semibold tabular-nums",
        value === null ? "text-muted-foreground/50" : SCORE_TONE[value],
        value === null && editable && "border border-dashed",
      )}
    >
      {value ?? "-"}
    </span>
  )
  if (!editable) return face

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${value ?? "not scored"}`}
          className="hover:ring-foreground/30 focus-visible:ring-ring rounded-sm transition-shadow outline-none hover:ring-1 focus-visible:ring-2"
        >
          {face}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center">
        <p className="text-muted-foreground mb-2 max-w-56 px-1 text-xs">{label}</p>
        <div className="flex gap-1">
          {SCORING_GUIDE.slice()
            .reverse()
            .map((g) => (
              <button
                key={g.score}
                type="button"
                title={`${g.score} - ${g.label}`}
                onClick={() => {
                  onChange(g.score)
                  setOpen(false)
                }}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-sm text-sm font-semibold transition-transform hover:scale-105",
                  SCORE_TONE[g.score],
                  value === g.score && "ring-foreground ring-2",
                )}
              >
                {g.score}
              </button>
            ))}
        </div>
        {value !== null && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className="text-muted-foreground hover:text-foreground mt-2 w-full rounded-sm px-1 py-1 text-left text-xs"
          >
            Clear score
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

function AvgCell({
  value,
  first = false,
  strong = false,
}: {
  value: number | null
  first?: boolean
  strong?: boolean
}) {
  return (
    <td className={cn("px-2 py-1.5 text-center", first && "border-l")}>
      <span
        className={cn(
          "inline-flex min-w-10 justify-center rounded-sm px-1.5 py-0.5 text-sm tabular-nums",
          value === null ? "text-muted-foreground/50" : toneFor(value),
          strong && "font-semibold",
        )}
      >
        {formatScore(value)}
      </span>
    </td>
  )
}

function SummaryTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="px-5 py-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          value === null && "text-muted-foreground",
        )}
      >
        {formatScore(value)}
        {value !== null && <span className="text-muted-foreground text-sm font-normal"> / 5</span>}
      </p>
    </div>
  )
}

function Observations({
  title,
  hint,
  value,
  editable,
  saving,
  onSave,
}: {
  title: string
  hint: string
  value: string | null
  editable: boolean
  saving: boolean
  onSave: (value: string | null) => void
}) {
  const [draft, setDraft] = useState(value ?? "")
  const dirty = draft.trim() !== (value ?? "").trim()
  return (
    <section className="bg-card flex flex-col rounded-sm border">
      <div className="border-b px-5 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      <div className="flex-1 px-5 py-4">
        {editable ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              placeholder="Write observations..."
              aria-label={title}
            />
            {dirty && (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDraft(value ?? "")} disabled={saving}>
                  Discard
                </Button>
                <Button onClick={() => onSave(draft.trim() || null)} disabled={saving}>
                  Save
                </Button>
              </div>
            )}
          </div>
        ) : value ? (
          <p className="text-sm whitespace-pre-wrap">{value}</p>
        ) : (
          <p className="text-muted-foreground text-sm">No observations yet.</p>
        )}
      </div>
    </section>
  )
}

export function JoineeScorecardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-sm border">
        <div className="border-b px-5 py-4">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
        <div className="grid gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card space-y-2 rounded-sm border p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  )
}
