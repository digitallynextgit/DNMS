"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Check, ChevronLeft, Plus, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import { toastError } from "@/lib/error-message"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateField } from "@/components/shared/date-field"
import { useProjectTeams } from "../hooks/use-projects"
import {
  formatPeriod,
  parseDay,
  periodFor,
  presetPeriod,
  repeatPeriods,
  ymd,
  type PeriodKind,
} from "../lib/delivery-period"

// ─────────────────────────────────────────────────────────────────────────────
// Planning a period, in the order the decision is actually made.
//
//   1. WHEN  - this week, this month, a range. One question, big buttons.
//   2. WHO   - which teams are on the hook.
//   3. WHAT  - per team, what they owe and how many.
//
// The old dialog asked all of it at once, one deliverable at a time, which is
// why a week of work across three teams meant opening it a dozen times. Here
// the period is chosen once and every item inherits it, so the whole week lands
// in one write - or none of it does.
// ─────────────────────────────────────────────────────────────────────────────

type Step = "when" | "who" | "what"

/** A window already chosen - the dialog adds items to it rather than asking. */
interface FixedPeriod {
  start: string
  end: string
}

interface Line {
  /** Local key. Rows are added and removed, so index is not identity. */
  key: string
  teamId: string
  type: string
  title: string
  quantity: string
}

const newLine = (teamId: string): Line => ({
  key: Math.random().toString(36).slice(2),
  teamId,
  type: "",
  title: "",
  quantity: "1",
})

/** The presets, in the order somebody reaches for them. */
const PRESETS: { label: string; kind: PeriodKind; offset: number }[] = [
  { label: "This week", kind: "week", offset: 0 },
  { label: "Next week", kind: "week", offset: 1 },
  { label: "This month", kind: "month", offset: 0 },
  { label: "Next month", kind: "month", offset: 1 },
]

function PresetCard({
  label,
  detail,
  active,
  onClick,
}: {
  label: string
  detail: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-sm border px-3 py-2.5 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="text-muted-foreground block text-[11px]">{detail}</span>
    </button>
  )
}

export function PlanPeriodDialog({
  projectId,
  open,
  onOpenChange,
  period,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Add items to a deliverable that already exists. The window is fixed, step
   * one is skipped, and what is created joins what is already there.
   */
  period?: FixedPeriod
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Body only exists while open, so every opening starts at step one. */}
        {open && <Body projectId={projectId} fixed={period} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  projectId,
  fixed,
  onClose,
}: {
  projectId: string
  fixed?: FixedPeriod
  onClose: () => void
}) {
  const qc = useQueryClient()
  const teams = useProjectTeams(projectId)
  const teamList = React.useMemo(() => teams.data?.data ?? [], [teams.data])

  // With the window already chosen there is no step one to stand on.
  const [step, setStep] = React.useState<Step>(fixed ? "who" : "when")

  // ── Step 1: when ───────────────────────────────────────────────────────────
  const [presetIdx, setPresetIdx] = React.useState(0)
  const [custom, setCustom] = React.useState(false)
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const [repeat, setRepeat] = React.useState("1")

  const preset = PRESETS[presetIdx]!
  const period = React.useMemo(() => {
    if (fixed) {
      const a = parseDay(fixed.start)
      const b = parseDay(fixed.end)
      return a && b ? periodFor("range", a, b) : null
    }
    if (!custom) return presetPeriod(preset.kind, preset.offset)
    const a = parseDay(from)
    const b = parseDay(to)
    // Both ends, or it is not a range yet - Next stays disabled rather than
    // quietly planning a single day somebody did not ask for.
    if (!a || !b) return null
    return periodFor("range", a, b)
  }, [fixed, custom, preset, from, to])

  // Adding to an existing window never repeats it: the window IS the deliverable.
  const repeatN = fixed ? 1 : Math.max(1, Math.min(Number(repeat) || 1, 52))
  const kind: PeriodKind = fixed || custom ? "range" : preset.kind
  /** What one repetition IS, in a word the sentence can use. */
  const unitWord = kind === "month" ? "month" : kind === "week" ? "week" : "range"
  const periods = React.useMemo(
    () => (period ? repeatPeriods(kind, period.start, repeatN) : []),
    [period, kind, repeatN],
  )

  // ── Step 2: who ────────────────────────────────────────────────────────────
  const [chosenTeams, setChosenTeams] = React.useState<Set<string>>(new Set())
  const toggleTeam = (id: string) =>
    setChosenTeams((cur) => {
      const next = new Set(cur)
      if (next.has(id)) {
        next.delete(id)
        setLines((ls) => ls.filter((l) => l.teamId !== id))
      } else {
        next.add(id)
        // A team with nothing under it is a team you forgot to fill in, so it
        // arrives with one empty item already waiting.
        setLines((ls) => [...ls, newLine(id)])
      }
      return next
    })

  const allTeamsChosen = teamList.length > 0 && teamList.every((t) => chosenTeams.has(t.id))

  /**
   * All or nothing, keeping the step-3 items in step.
   *
   * Selecting has to ADD a starter item for each team that did not have one,
   * and must not disturb items already typed for teams that were ticked - so
   * this cannot just replace the set and leave `lines` behind.
   */
  const toggleAllTeams = () => {
    if (allTeamsChosen) {
      setChosenTeams(new Set())
      setLines([])
      return
    }
    const missing = teamList.filter((t) => !chosenTeams.has(t.id))
    setChosenTeams(new Set(teamList.map((t) => t.id)))
    setLines((ls) => [...ls, ...missing.map((t) => newLine(t.id))])
  }

  // ── Step 3: what ───────────────────────────────────────────────────────────
  const [lines, setLines] = React.useState<Line[]>([])
  const setLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const filled = lines.filter((l) => l.type.trim() && l.title.trim())
  const totalRows = filled.length * periods.length

  const plan = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ data: { created: number; periods: number } }>(
        `/api/projects/${projectId}/deliverables/plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["deliverables"] })
      void qc.invalidateQueries({ queryKey: ["my-owed-deliverables"] })
      const { created, periods: n } = res.data
      toast.success(
        fixed
          ? `Added ${created} item${created === 1 ? "" : "s"}`
          : n > 1
            ? `Planned ${n} deliverables - ${created} items across them`
            : `Planned it - ${created} item${created === 1 ? "" : "s"} across the teams`,
      )
      onClose()
    },
    onError: (e) => toastError(e, "Could not save the plan"),
  })

  function submit() {
    if (!period || filled.length === 0) return
    plan.mutate({
      periodStart: ymd(period.start),
      periodEnd: ymd(period.end),
      kind,
      repeat: repeatN,
      lines: filled.map((l) => ({
        teamId: l.teamId,
        type: l.type.trim(),
        title: l.title.trim(),
        quantity: Math.max(1, Number(l.quantity) || 1),
      })),
    })
  }

  const teamName = (id: string) => teamList.find((t) => t.id === id)?.name ?? "Team"

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {step === "when" && <CalendarDays className="h-4 w-4" />}
          {step === "who" && <Users className="h-4 w-4" />}
          {step === "what" && <Plus className="h-4 w-4" />}
          {step === "when"
            ? "Plan a deliverable"
            : fixed
              ? `Add to ${period ? formatPeriod(period.start, period.end) : "this deliverable"}`
              : step === "who"
                ? "Which teams?"
                : "What does each team owe?"}
        </DialogTitle>
        <DialogDescription>
          {step === "when"
            ? "Pick the window first - the deliverable is named by it, and every item you add is owed inside it."
            : step === "who"
              ? fixed
                ? "Pick every team with something more to make in this window."
                : `For ${period ? formatPeriod(period.start, period.end) : "this period"}. Pick every team with something to make.`
              : fixed
                ? "These join the items already planned. Nothing already there changes."
                : `${period ? formatPeriod(period.start, period.end) : ""}${periods.length > 1 ? ` and ${periods.length - 1} more` : ""}`}
        </DialogDescription>
      </DialogHeader>

      {/* A plain progress line, so it is obvious this has three parts. */}
      <div className="flex items-center gap-1.5 text-[11px]">
        {((fixed ? ["who", "what"] : ["when", "who", "what"]) as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <span className="bg-border h-px flex-1" />}
            <span
              className={cn(
                "rounded-sm px-1.5 py-0.5 font-medium",
                step === s ? "bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              {i + 1}. {s === "when" ? "When" : s === "who" ? "Teams" : "Work"}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div className="max-h-[55vh] space-y-4 overflow-y-auto px-1 py-1">
        {step === "when" && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRESETS.map((p, i) => {
                const pp = presetPeriod(p.kind, p.offset)
                return (
                  <PresetCard
                    key={p.label}
                    label={p.label}
                    detail={formatPeriod(pp.start, pp.end)}
                    active={!custom && presetIdx === i}
                    onClick={() => {
                      setCustom(false)
                      setPresetIdx(i)
                    }}
                  />
                )
              })}
            </div>

            <PresetCard
              label="A specific range"
              detail={
                custom && period ? formatPeriod(period.start, period.end) : "Pick your own dates"
              }
              active={custom}
              onClick={() => setCustom(true)}
            />

            {custom && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label required className="text-muted-foreground text-[11px]">
                    From
                  </Label>
                  <DateField value={from} onChange={setFrom} placeholder="Start" modal />
                </div>
                <div className="space-y-1.5">
                  {/* Both ends required. "A specific range" with one date is a
                      one-day range, which nobody means and nothing says. */}
                  <Label required className="text-muted-foreground text-[11px]">
                    To
                  </Label>
                  <DateField value={to} onChange={setTo} placeholder="End" modal />
                  {from && !to && (
                    <p className="text-muted-foreground text-[11px]">
                      Pick the day the range ends.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Says what it DOES, not what it is called. "Repeat for how many
                periods?" left people counting something they had no name for -
                so the control now spells out the answer underneath it. */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">
                Plan the same work for more than one {unitWord}?
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={52}
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  className="w-24"
                  aria-label={`How many ${unitWord}s`}
                />
                <span className="text-muted-foreground text-xs">
                  {repeatN === 1 ? `${unitWord} in total` : `${unitWord}s in a row`}
                </span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                {!period ? (
                  "Pick the dates above first."
                ) : repeatN === 1 ? (
                  <>
                    Just{" "}
                    <span className="text-foreground">
                      {formatPeriod(period.start, period.end)}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    <span className="text-foreground">
                      {formatPeriod(periods[0]!.start, periods[0]!.end)}
                    </span>
                    , then {repeatN - 1} more, ending{" "}
                    <span className="text-foreground">
                      {formatPeriod(
                        periods[periods.length - 1]!.start,
                        periods[periods.length - 1]!.end,
                      )}
                    </span>
                    . Everything you plan next is created once per {unitWord}.
                  </>
                )}
              </p>
            </div>
          </>
        )}

        {step === "who" && (
          <>
            {teamList.length > 1 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-[11px]">
                  {chosenTeams.size} of {teamList.length} selected
                </span>
                <button
                  type="button"
                  onClick={toggleAllTeams}
                  className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-4"
                >
                  {allTeamsChosen ? "Clear all" : "Select all"}
                </button>
              </div>
            )}
            <div className="divide-border/70 divide-y overflow-hidden rounded-sm border">
              {teamList.length === 0 && (
                <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                  This project has no teams yet. Add one on the Teams tab first.
                </p>
              )}
              {teamList.map((t) => {
                const on = chosenTeams.has(t.id)
                return (
                  <label
                    key={t.id}
                    className={cn(
                      "hover:bg-muted/40 flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                      on && "bg-primary/5",
                    )}
                  >
                    <Checkbox checked={on} onCheckedChange={() => toggleTeam(t.id)} />
                    <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {t.members?.length ?? 0} members
                    </span>
                  </label>
                )
              })}
            </div>
          </>
        )}

        {step === "what" &&
          [...chosenTeams].map((teamId) => (
            <div key={teamId} className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="text-muted-foreground h-3.5 w-3.5" />
                <h4 className="text-sm font-semibold">{teamName(teamId)}</h4>
              </div>
              {lines
                .filter((l) => l.teamId === teamId)
                .map((l) => (
                  <div key={l.key} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_72px_auto]">
                    <Input
                      value={l.type}
                      onChange={(e) => setLine(l.key, { type: e.target.value })}
                      placeholder="Reel, Blog, Banner…"
                      aria-label="Type"
                    />
                    <Input
                      value={l.title}
                      onChange={(e) => setLine(l.key, { title: e.target.value })}
                      placeholder="What is it?"
                      aria-label="Title"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                      aria-label="How many"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remove this item"
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setLines((ls) => [...ls, newLine(teamId)])}
              >
                <Plus className="h-3.5 w-3.5" /> Another for {teamName(teamId)}
              </Button>
            </div>
          ))}
      </div>

      <DialogFooter className="sm:justify-between">
        <div className="text-muted-foreground flex items-center text-xs">
          {step === "what" && totalRows > 0 && (
            <span>
              {totalRows} deliverable{totalRows === 1 ? "" : "s"} will be created, owed by their
              teams
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {step !== "when" && !(fixed && step === "who") && (
            <Button
              variant="ghost"
              onClick={() => setStep(step === "what" ? "who" : "when")}
              disabled={plan.isPending}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          )}
          {step === "when" && (
            <Button onClick={() => setStep("who")} disabled={!period}>
              Next
            </Button>
          )}
          {step === "who" && (
            <Button onClick={() => setStep("what")} disabled={chosenTeams.size === 0}>
              Next
            </Button>
          )}
          {step === "what" && (
            <Button onClick={submit} disabled={totalRows === 0} loading={plan.isPending}>
              <Check className="h-4 w-4" /> {fixed ? "Add" : "Create"}{" "}
              {totalRows > 0 ? totalRows : ""}
            </Button>
          )}
        </div>
      </DialogFooter>
    </>
  )
}
