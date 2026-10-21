"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Check, ChevronLeft, Plus, Target, Trash2, Users } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateField } from "@/components/shared/date-field"
import { useProjectTeams } from "../hooks/use-projects"
import { useProjectGoals } from "../hooks/use-goals"
import { serviceInfo, serviceTeams } from "../lib/project-services"
import {
  daysIn,
  formatPeriod,
  parseDay,
  periodFor,
  presetPeriod,
  weekOf,
  ymd,
} from "../lib/delivery-period"

// Plan a period in three steps (when, who, what); every item inherits the window and lands in one write.

type Step = "when" | "who" | "what"

/** A window already chosen - the dialog adds items to it rather than asking. */
interface FixedPeriod {
  start: string
  end: string
}

/** The goal a plan serves: every item counts towards it. */
export interface PlanGoal {
  id: string
  title: string
  /** A service part's code; its usual teams are ticked for you. */
  service: string | null
  /** yyyy-MM-dd. A monthly edition's month, offered as the period. */
  periodStart: string | null
  periodEnd: string | null
}

const NO_GOAL = "__none"

/** A week already on the board: its start (yyyy-MM-dd) and the items it holds. */
interface ExistingPeriod {
  start: string | null
  rows: readonly unknown[]
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

const PRESETS: { label: string; offset: number }[] = [
  { label: "This week", offset: 0 },
  { label: "Next week", offset: 1 },
]

/** "14-18 Sep 2026 · 6 items already planned" - a week says so if it is taken. */
function withPlanned(label: string, items: number | undefined): string {
  return items ? `${label} · ${items} item${items === 1 ? "" : "s"} already planned` : label
}

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
  existing,
  goal,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Add items to an existing deliverable: the window is fixed and step one is skipped. */
  period?: FixedPeriod
  /** Lets a week that already has items say so; planning it again adds to it. */
  existing?: readonly ExistingPeriod[]
  /** Planning from a goal: it is fixed, and its month is offered first. */
  goal?: PlanGoal
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Body only exists while open, so every opening starts at step one. */}
        {open && (
          <Body
            projectId={projectId}
            fixed={period}
            existing={existing}
            goal={goal}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** This month's open goals and their parts, for the "counts towards" pick. */
function useGoalChoices(projectId: string, skip: boolean): PlanGoal[] {
  const goals = useProjectGoals(skip ? "" : projectId)
  return React.useMemo(() => {
    const open = (g: { isActive: boolean; status: string }) =>
      g.isActive && g.status !== "DONE" && g.status !== "DISCARDED"
    const out: PlanGoal[] = []
    for (const g of goals.data?.goals ?? []) {
      if (!open(g)) continue
      out.push({
        id: g.id,
        title: g.title,
        service: g.service,
        periodStart: g.periodStart,
        periodEnd: g.periodEnd,
      })
      for (const c of g.children) {
        if (!open(c)) continue
        out.push({
          id: c.id,
          title: `${g.title} › ${c.title}`,
          service: c.service,
          periodStart: c.periodStart,
          periodEnd: c.periodEnd,
        })
      }
    }
    return out
  }, [goals.data])
}

function GoalPick({
  fixedGoal,
  choices,
  value,
  onChange,
}: {
  fixedGoal?: PlanGoal
  choices: PlanGoal[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  if (fixedGoal) {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Target className="h-3.5 w-3.5 shrink-0" />
        Counts towards <span className="text-foreground font-medium">{fixedGoal.title}</span>
      </p>
    )
  }
  if (choices.length === 0) return null
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-[11px]">Counts towards a goal</Label>
      <Select value={value ?? NO_GOAL} onValueChange={(v) => onChange(v === NO_GOAL ? null : v)}>
        <SelectTrigger className="h-9 text-sm" aria-label="Counts towards a goal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_GOAL}>No goal</SelectItem>
          {choices.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function Body({
  projectId,
  fixed,
  existing,
  goal,
  onClose,
}: {
  projectId: string
  fixed?: FixedPeriod
  existing?: readonly ExistingPeriod[]
  goal?: PlanGoal
  onClose: () => void
}) {
  const qc = useQueryClient()
  const teams = useProjectTeams(projectId)
  const teamList = React.useMemo(() => teams.data?.data ?? [], [teams.data])

  const goalChoices = useGoalChoices(projectId, Boolean(goal))
  const [goalId, setGoalId] = React.useState<string | null>(goal?.id ?? null)
  const chosenGoal = goal ?? goalChoices.find((g) => g.id === goalId) ?? null
  const goalFrom = chosenGoal?.periodStart ?? null
  const goalTo = chosenGoal?.periodEnd ?? null
  const goalMonth = React.useMemo(() => {
    const a = parseDay(goalFrom)
    const b = parseDay(goalTo)
    return a && b ? periodFor("range", a, b) : null
  }, [goalFrom, goalTo])

  const [step, setStep] = React.useState<Step>(fixed ? "who" : "when")

  const [presetIdx, setPresetIdx] = React.useState(0)
  /** "preset" = this/next week, "week" = another week, "range" = two dates, "month" = the goal's. */
  const [mode, setMode] = React.useState<"preset" | "week" | "range" | "month">(
    goal?.periodStart ? "month" : "preset",
  )
  // Any day of the week wanted - it is read as that week's Monday to Friday.
  const [anyDay, setAnyDay] = React.useState("")
  const [rangeFrom, setRangeFrom] = React.useState("")
  const [rangeTo, setRangeTo] = React.useState("")

  const preset = PRESETS[presetIdx]!
  const period = React.useMemo(() => {
    if (fixed) {
      const a = parseDay(fixed.start)
      const b = parseDay(fixed.end)
      return a && b ? periodFor("range", a, b) : null
    }
    if (mode === "month") return goalMonth
    if (mode === "preset") return presetPeriod("week", preset.offset)
    if (mode === "range") {
      const a = parseDay(rangeFrom)
      const b = parseDay(rangeTo)
      // periodFor("range") accepts a backwards pair.
      return a && b ? periodFor("range", a, b) : null
    }
    const d = parseDay(anyDay)
    return d ? weekOf(d) : null
  }, [fixed, mode, preset, anyDay, rangeFrom, rangeTo, goalMonth])

  const alreadyPlanned = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const p of existing ?? []) {
      if (p.start) m.set(p.start, (m.get(p.start) ?? 0) + p.rows.length)
    }
    return m
  }, [existing])
  const already = period ? (alreadyPlanned.get(ymd(period.start)) ?? 0) : 0

  const [chosenTeams, setChosenTeams] = React.useState<Set<string>>(new Set())
  const toggleTeam = (id: string) =>
    setChosenTeams((cur) => {
      const next = new Set(cur)
      if (next.has(id)) {
        next.delete(id)
        setLines((ls) => ls.filter((l) => l.teamId !== id))
      } else {
        next.add(id)
        // A newly ticked team arrives with one empty item.
        setLines((ls) => [...ls, newLine(id)])
      }
      return next
    })

  const allTeamsChosen = teamList.length > 0 && teamList.every((t) => chosenTeams.has(t.id))

  /** All or nothing, adding a starter item per newly ticked team without touching typed ones. */
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

  const [lines, setLines] = React.useState<Line[]>([])
  const setLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  /** A service's usual teams arrive ticked - only while nothing is ticked, so a choice is kept. */
  const suggestTeams = (g: PlanGoal | null) => {
    if (!g?.service || chosenTeams.size > 0) return
    const names = new Set(serviceTeams(g.service))
    const picks = teamList.filter((t) => names.has(t.name))
    if (picks.length === 0) return
    setChosenTeams(new Set(picks.map((t) => t.id)))
    setLines((ls) => [...ls, ...picks.map((t) => newLine(t.id))])
  }

  const pickGoal = (id: string | null) => {
    setGoalId(id)
    const g = goalChoices.find((x) => x.id === id) ?? null
    if (mode === "month" && !g?.periodStart) setMode("preset")
    if (step === "who") suggestTeams(g)
  }
  const usualTeams = chosenGoal?.service ? serviceTeams(chosenGoal.service) : []

  const filled = lines.filter((l) => l.type.trim() && l.title.trim())
  const totalRows = filled.length

  const plan = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ data: { created: number } }>(`/api/projects/${projectId}/deliverables/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["deliverables"] })
      void qc.invalidateQueries({ queryKey: ["my-owed-deliverables"] })
      void qc.invalidateQueries({ queryKey: ["project-goals", projectId] })
      const { created } = res.data
      toast.success(
        fixed
          ? `Added ${created} item${created === 1 ? "" : "s"}`
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
      lines: filled.map((l) => ({
        teamId: l.teamId,
        type: l.type.trim(),
        title: l.title.trim(),
        quantity: Math.max(1, Number(l.quantity) || 1),
        goalId: chosenGoal?.id ?? null,
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
            ? "Pick the week first - the deliverable is named by it, and every item you add is owed inside it. A week that already has items just gets more."
            : step === "who"
              ? fixed
                ? "Pick every team with something more to make in this window."
                : `For ${period ? formatPeriod(period.start, period.end) : "this period"}. Pick every team with something to make.`
              : fixed
                ? "These join the items already planned. Nothing already there changes."
                : period
                  ? formatPeriod(period.start, period.end)
                  : ""}
        </DialogDescription>
      </DialogHeader>

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
            <GoalPick fixedGoal={goal} choices={goalChoices} value={goalId} onChange={pickGoal} />

            {goalMonth && (
              <PresetCard
                label="The goal's month"
                detail={withPlanned(
                  formatPeriod(goalMonth.start, goalMonth.end),
                  alreadyPlanned.get(ymd(goalMonth.start)),
                )}
                active={mode === "month"}
                onClick={() => setMode("month")}
              />
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {PRESETS.map((p, i) => {
                const pp = presetPeriod("week", p.offset)
                return (
                  <PresetCard
                    key={p.label}
                    label={p.label}
                    detail={withPlanned(
                      formatPeriod(pp.start, pp.end),
                      alreadyPlanned.get(ymd(pp.start)),
                    )}
                    active={mode === "preset" && presetIdx === i}
                    onClick={() => {
                      setMode("preset")
                      setPresetIdx(i)
                    }}
                  />
                )
              })}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <PresetCard
                label="Another week"
                detail={
                  mode === "week" && period
                    ? withPlanned(formatPeriod(period.start, period.end), already)
                    : "Pick any day in it"
                }
                active={mode === "week"}
                onClick={() => setMode("week")}
              />
              <PresetCard
                label="A date range"
                detail={
                  mode === "range" && period
                    ? withPlanned(formatPeriod(period.start, period.end), already)
                    : "Any start and end"
                }
                active={mode === "range"}
                onClick={() => setMode("range")}
              />
            </div>

            {mode === "week" && (
              <div className="space-y-1.5">
                <Label required className="text-muted-foreground text-[11px]">
                  Any day of that week
                </Label>
                <DateField value={anyDay} onChange={setAnyDay} placeholder="Pick a day" modal />
                <p className="text-muted-foreground text-[11px]">
                  {period
                    ? `Monday to Friday: ${formatPeriod(period.start, period.end)}.`
                    : "A week is read as Monday to Friday."}
                </p>
              </div>
            )}

            {mode === "range" && (
              <div className="space-y-1.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label required className="text-muted-foreground text-[11px]">
                      Start
                    </Label>
                    <DateField
                      value={rangeFrom}
                      onChange={setRangeFrom}
                      placeholder="First day"
                      modal
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label required className="text-muted-foreground text-[11px]">
                      End
                    </Label>
                    <DateField value={rangeTo} onChange={setRangeTo} placeholder="Last day" modal />
                  </div>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {period
                    ? `${formatPeriod(period.start, period.end)} - ${daysIn(period)} days.`
                    : "Both dates are included. A plan covers at most a year."}
                </p>
              </div>
            )}

            {already > 0 && (
              <p className="text-muted-foreground text-[11px]">
                This period already has {already} item{already === 1 ? "" : "s"} planned. What you
                add joins them - nothing already there changes.
              </p>
            )}
          </>
        )}

        {step === "who" && (
          <>
            {fixed && (
              <GoalPick fixedGoal={goal} choices={goalChoices} value={goalId} onChange={pickGoal} />
            )}
            {usualTeams.length > 0 && (
              <p className="text-muted-foreground text-[11px]">
                {serviceInfo(chosenGoal!.service!)?.name ?? "This service"} work is usually made by{" "}
                {usualTeams.join(", ")} - ticked for you; change it freely.
              </p>
            )}
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
                  This project has no teams. Every project gets the standard six - ask an admin.
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
            <Button
              onClick={() => {
                suggestTeams(chosenGoal)
                setStep("who")
              }}
              disabled={!period}
            >
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
