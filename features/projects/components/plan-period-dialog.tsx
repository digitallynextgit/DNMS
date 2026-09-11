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
  weekOf,
  ymd,
} from "../lib/delivery-period"

// ─────────────────────────────────────────────────────────────────────────────
// Planning a week, in the order the decision is actually made.
//
//   1. WHEN  - this week, next week, or any other week. One question, big buttons.
//   2. WHO   - which teams are on the hook.
//   3. WHAT  - per team, what they owe and how many.
//
// Deliverables are planned by the WORKING WEEK only - no months, no ad-hoc
// ranges - so every board reads the same way and the numbers compare. A week
// that already has items can be planned again: what is added joins what is
// there, and nothing already planned changes.
//
// The old dialog asked all of it at once, one deliverable at a time, which is
// why a week of work across three teams meant opening it a dozen times. Here
// the week is chosen once and every item inherits it, so the whole week lands
// in one write - or none of it does.
// ─────────────────────────────────────────────────────────────────────────────

type Step = "when" | "who" | "what"

/** A window already chosen - the dialog adds items to it rather than asking. */
interface FixedPeriod {
  start: string
  end: string
}

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

/** The weeks somebody reaches for first. Any other week is "Another week". */
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
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Add items to a deliverable that already exists. The window is fixed, step
   * one is skipped, and what is created joins what is already there.
   */
  period?: FixedPeriod
  /**
   * What is already on the board, so a week that has items says so before it
   * is picked again. Planning it again is allowed - the new items join it.
   */
  existing?: readonly ExistingPeriod[]
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
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  projectId,
  fixed,
  existing,
  onClose,
}: {
  projectId: string
  fixed?: FixedPeriod
  existing?: readonly ExistingPeriod[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const teams = useProjectTeams(projectId)
  const teamList = React.useMemo(() => teams.data?.data ?? [], [teams.data])

  // With the window already chosen there is no step one to stand on.
  const [step, setStep] = React.useState<Step>(fixed ? "who" : "when")

  // ── Step 1: when ───────────────────────────────────────────────────────────
  const [presetIdx, setPresetIdx] = React.useState(0)
  const [another, setAnother] = React.useState(false)
  // Any day of the week wanted - it is read as that week's Monday to Friday.
  const [anyDay, setAnyDay] = React.useState("")

  const preset = PRESETS[presetIdx]!
  const period = React.useMemo(() => {
    if (fixed) {
      const a = parseDay(fixed.start)
      const b = parseDay(fixed.end)
      return a && b ? periodFor("range", a, b) : null
    }
    if (!another) return presetPeriod("week", preset.offset)
    const d = parseDay(anyDay)
    return d ? weekOf(d) : null
  }, [fixed, another, preset, anyDay])

  // Items already planned, by the week's Monday - so a week can say "6 items
  // already planned" before it is picked again.
  const alreadyPlanned = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const p of existing ?? []) {
      if (p.start) m.set(p.start, (m.get(p.start) ?? 0) + p.rows.length)
    }
    return m
  }, [existing])
  const already = period ? (alreadyPlanned.get(ymd(period.start)) ?? 0) : 0

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
                const pp = presetPeriod("week", p.offset)
                return (
                  <PresetCard
                    key={p.label}
                    label={p.label}
                    detail={withPlanned(
                      formatPeriod(pp.start, pp.end),
                      alreadyPlanned.get(ymd(pp.start)),
                    )}
                    active={!another && presetIdx === i}
                    onClick={() => {
                      setAnother(false)
                      setPresetIdx(i)
                    }}
                  />
                )
              })}
            </div>

            {/* Weeks only. Any day will do - it is read as that working week. */}
            <PresetCard
              label="Another week"
              detail={
                another && period
                  ? withPlanned(formatPeriod(period.start, period.end), already)
                  : "Pick any day in it"
              }
              active={another}
              onClick={() => setAnother(true)}
            />

            {another && (
              <div className="space-y-1.5">
                <Label required className="text-muted-foreground text-[11px]">
                  Any day of that week
                </Label>
                <DateField value={anyDay} onChange={setAnyDay} placeholder="Pick a day" modal />
                <p className="text-muted-foreground text-[11px]">
                  {period
                    ? `Monday to Friday: ${formatPeriod(period.start, period.end)}.`
                    : "Deliverables are planned by the working week, Monday to Friday."}
                </p>
              </div>
            )}

            {already > 0 && (
              <p className="text-muted-foreground text-[11px]">
                This week already has {already} item{already === 1 ? "" : "s"} planned. What you add
                joins them - nothing already there changes.
              </p>
            )}
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
