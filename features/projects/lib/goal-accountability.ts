// "Why behind": for a goal with a number, the first of these that applies - achieved, no plan, not
// reported, waiting on the client, work behind, results short, on track - with the people and items
// behind it. Pure rules: AI may explain a verdict, never decide one.

import type { GoalNode } from "./goal-derivation"
import type { GoalPlanItem, GoalPlanTeam } from "./goal-plan"

export type VerdictKind =
  | "ACHIEVED"
  | "ON_TRACK"
  | "NOT_STARTED"
  | "NO_PLAN"
  | "NOT_REPORTED"
  | "BLOCKED_BY_CLIENT"
  | "OUTPUT_BEHIND"
  | "OUTCOME_SHORT"

export type VerdictTone = "good" | "neutral" | "warn" | "bad"

export interface Responsible {
  who: string
  why: string
}

export interface VerdictItem {
  kind: "deliverable" | "task" | "requirement"
  id: string
  title: string
  detail: string
}

export interface GoalVerdict {
  kind: VerdictKind
  label: string
  tone: VerdictTone
  summary: string
  responsible: Responsible[]
  items: VerdictItem[]
  /** On a main goal: each numbered part's own verdict. */
  parts?: { goalId: string; title: string; verdict: GoalVerdict }[]
}

export const VERDICT_LABEL: Record<VerdictKind, string> = {
  ACHIEVED: "Achieved",
  ON_TRACK: "On track",
  NOT_STARTED: "Not started yet",
  NO_PLAN: "No plan",
  NOT_REPORTED: "Not reported",
  BLOCKED_BY_CLIENT: "Waiting on the client",
  OUTPUT_BEHIND: "Work behind",
  OUTCOME_SHORT: "Results short",
}

const TONE: Record<VerdictKind, VerdictTone> = {
  ACHIEVED: "good",
  ON_TRACK: "good",
  NOT_STARTED: "neutral",
  NO_PLAN: "bad",
  NOT_REPORTED: "warn",
  BLOCKED_BY_CLIENT: "warn",
  OUTPUT_BEHIND: "bad",
  OUTCOME_SHORT: "warn",
}

/** Worst first: which part's problem a main goal leads with. */
const SEVERITY: VerdictKind[] = [
  "NO_PLAN",
  "OUTPUT_BEHIND",
  "BLOCKED_BY_CLIENT",
  "NOT_REPORTED",
  "OUTCOME_SHORT",
  "ON_TRACK",
  "NOT_STARTED",
  "ACHIEVED",
]

/** No results for this long reads as "not reported". */
export const REPORT_GAP_DAYS = 8

export type VerdictGoal = Pick<
  GoalNode,
  | "id"
  | "title"
  | "status"
  | "ownerName"
  | "metricLabel"
  | "targetValue"
  | "actualValue"
  | "paceValue"
  | "periodStart"
  | "periodEnd"
  | "createdAt"
  | "actualSource"
  | "lastResultOn"
  | "tasks"
>

export interface VerdictInput {
  goal: VerdictGoal
  plan: readonly GoalPlanTeam[] | undefined
  /** The project's account manager, who answers for an ownerless part and plans the work. */
  amName: string | null
  today: Date
}

const DAY = 86_400_000
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00.000Z`)
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN")

function make(
  kind: VerdictKind,
  summary: string,
  responsible: Responsible[] = [],
  items: VerdictItem[] = [],
): GoalVerdict {
  // One line per person: the same name for two reasons reads as one.
  const seen = new Set<string>()
  const people = responsible.filter((r) => {
    if (seen.has(r.who)) return false
    seen.add(r.who)
    return true
  })
  return { kind, label: VERDICT_LABEL[kind], tone: TONE[kind], summary, responsible: people, items }
}

/** Late or stuck planned work, with who answers for each item. */
function lateWork(plan: readonly GoalPlanTeam[]) {
  const late: { team: GoalPlanTeam; item: GoalPlanItem }[] = []
  for (const team of plan) {
    for (const item of team.items) {
      if (item.overdue || item.status === "STUCK") late.push({ team, item })
    }
  }
  return late
}

/** The verdict for one goal with a number (a service part, or a numbered goal with no parts). */
export function goalVerdict({ goal, plan, amName, today }: VerdictInput): GoalVerdict | null {
  if (goal.targetValue === null || goal.status === "DISCARDED") return null
  const am = amName ?? "The account manager"
  const owner = goal.ownerName ?? `${am} (no owner set)`
  const metric = goal.metricLabel?.toLowerCase() ?? "results"
  const actual = goal.actualValue ?? 0
  const target = goal.targetValue

  const start = goal.periodStart ? day(goal.periodStart) : day(goal.createdAt)
  if (start > today) return make("NOT_STARTED", `Starts on ${start.toISOString().slice(0, 10)}.`)
  if (goal.status === "DONE" || actual >= target) {
    return make("ACHIEVED", `${fmt(actual)} of ${fmt(target)} ${metric}.`)
  }

  const teams = plan ?? []
  // A closed month is judged as of its last day.
  const end = goal.periodEnd ? day(goal.periodEnd) : null
  const asOf = end && end < today ? end : today
  const last = goal.lastResultOn ? day(goal.lastResultOn) : start
  const silentDays = Math.round((asOf.getTime() - last.getTime()) / DAY)
  const unreported = goal.actualSource === "MANUAL" && silentDays >= REPORT_GAP_DAYS
  const pace = goal.paceValue
  const behind = pace !== null && actual < pace

  // Nothing planned only matters once the number is in doubt: a part on pace without a plan is fine.
  if (teams.length === 0 && (behind || unreported)) {
    return make(
      "NO_PLAN",
      `No work is planned for "${goal.title}" - its owner can't move the number with nothing to do.`,
      [
        { who: owner, why: "owns this part" },
        { who: am, why: "plans the work" },
      ],
    )
  }
  if (unreported) {
    return make(
      "NOT_REPORTED",
      goal.lastResultOn
        ? `No ${metric} entered for ${silentDays} days, so the number may be out of date.`
        : `No ${metric} entered yet.`,
      [{ who: owner, why: "enters the results" }],
    )
  }
  if (!behind) {
    return make(
      "ON_TRACK",
      pace === null
        ? `${fmt(actual)} of ${fmt(target)} ${metric}.`
        : `${fmt(actual)} of ${fmt(target)} ${metric} - at or ahead of the ${fmt(pace)} expected by now.`,
    )
  }
  const gapText = `${fmt(pace! - actual)} ${metric} behind pace (${fmt(actual)} vs ${fmt(pace!)} by now)`

  const waiting = new Map<string, { id: string; title: string; tasks: string[] }>()
  for (const t of goal.tasks) {
    if (!t.waitingOn || t.status === "DONE" || t.status === "DISCARDED") continue
    const w = waiting.get(t.waitingOn.id) ?? { ...t.waitingOn, tasks: [] }
    w.tasks.push(t.title)
    waiting.set(t.waitingOn.id, w)
  }
  if (waiting.size > 0) {
    const list = [...waiting.values()]
    return make(
      "BLOCKED_BY_CLIENT",
      `${gapText}, and work is waiting on the client.`,
      [{ who: "The client", why: `hasn't provided: ${list.map((w) => w.title).join(", ")}` }],
      list.map((w) => ({
        kind: "requirement" as const,
        id: w.id,
        title: w.title,
        detail: `holding ${w.tasks.join(", ")}`,
      })),
    )
  }

  const late = lateWork(teams)
  const lateTasks = goal.tasks.filter((t) => t.overdue)
  if (late.length > 0 || lateTasks.length > 0) {
    const responsible: Responsible[] = []
    const counts = new Map<string, { n: number; why: string }>()
    const blame = (who: string, why: string) => {
      const c = counts.get(who) ?? { n: 0, why }
      c.n++
      counts.set(who, c)
    }
    for (const { team, item } of late) {
      if (item.employeeName) blame(item.employeeName, `late on ${team.teamName} work`)
      else
        blame(
          team.managerName ?? `${team.teamName} manager`,
          `${team.teamName} work nobody has claimed`,
        )
    }
    for (const t of lateTasks) blame(t.assigneeName ?? am, "late tasks")
    for (const [who, c] of counts) responsible.push({ who, why: `${c.n} ${c.why}` })
    const items: VerdictItem[] = [
      ...late.map(({ team, item }) => ({
        kind: "deliverable" as const,
        id: item.id,
        title: item.title,
        detail: `${team.teamName} · ${item.made}/${item.quantity} made · ${
          item.status === "STUCK" ? "stuck" : `due ${item.dueOn}`
        } · ${item.employeeName ?? "unclaimed"}`,
      })),
      ...lateTasks.map((t) => ({
        kind: "task" as const,
        id: t.id,
        title: t.title,
        detail: `due ${t.dueDate} · ${t.assigneeName ?? "unassigned"}`,
      })),
    ]
    return make("OUTPUT_BEHIND", `${gapText}: planned work is late.`, responsible, items)
  }

  return make(
    "OUTCOME_SHORT",
    `${gapText}, though the planned work is on time - worth a look at the approach.`,
    [
      { who: owner, why: "owns this part" },
      { who: am, why: "reviews the plan" },
    ],
  )
}

/** A main goal: its own verdict, or with numbered parts, led by its worst part's. */
export function mainGoalVerdict(
  goal: VerdictGoal & { children: VerdictGoal[] },
  plans: Readonly<Record<string, readonly GoalPlanTeam[]>>,
  amName: string | null,
  today: Date,
): GoalVerdict | null {
  const parts = goal.children
    .map((c) => ({
      goalId: c.id,
      title: c.title,
      verdict: goalVerdict({ goal: c, plan: plans[c.id], amName, today }),
    }))
    .filter((p): p is { goalId: string; title: string; verdict: GoalVerdict } => p.verdict !== null)
  if (parts.length === 0) return goalVerdict({ goal, plan: plans[goal.id], amName, today })

  const actual = goal.actualValue ?? 0
  if (goal.targetValue !== null && (goal.status === "DONE" || actual >= goal.targetValue)) {
    return { ...make("ACHIEVED", `${fmt(actual)} of ${fmt(goal.targetValue)}.`), parts }
  }
  const worst = [...parts].sort(
    (a, b) => SEVERITY.indexOf(a.verdict.kind) - SEVERITY.indexOf(b.verdict.kind),
  )[0]!
  const troubled = parts.filter((p) => p.verdict.tone === "bad" || p.verdict.tone === "warn")
  const summary =
    troubled.length === 0
      ? `All ${parts.length} parts are on track.`
      : `${troubled.length} of ${parts.length} parts need attention: ${troubled
          .map((p) => `${p.title} (${p.verdict.label.toLowerCase()})`)
          .join(", ")}.`
  return {
    ...make(
      worst.verdict.kind,
      summary,
      troubled.flatMap((p) => p.verdict.responsible),
    ),
    parts,
  }
}
