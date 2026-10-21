// The work planned under a goal, by team: what each team owes, how much is made, what is late or
// still unclaimed. Pure and client-safe, so the goal tree and the tests read it the same way.

import { isOpenStatus, isOutcomeStatus, type DeliverableStatus } from "./deliverable-lifecycle"
import { sortProjectTeams } from "./project-teams"

export interface GoalPlanRow {
  id: string
  /** The goal it serves: its own goalId, else its task's. */
  goalId: string
  teamId: string | null
  teamName: string | null
  teamManagerName?: string | null
  type: string
  title: string
  quantity: number
  deliveredQuantity: number
  status: DeliverableStatus
  dueOn: Date | null
  employeeId: string | null
  employeeName: string | null
}

export interface GoalPlanItem {
  id: string
  type: string
  title: string
  quantity: number
  made: number
  status: DeliverableStatus
  /** yyyy-MM-dd */
  dueOn: string | null
  employeeName: string | null
  overdue: boolean
}

export interface GoalPlanTeam {
  teamId: string | null
  teamName: string
  /** Answers for unclaimed work. */
  managerName: string | null
  planned: number
  made: number
  /** Items still owed past their due day. */
  overdue: number
  /** Items still owed that nobody has claimed. */
  unclaimed: number
  items: GoalPlanItem[]
}

/** Goal id -> its teams' work. A goal with no work is absent. */
export type GoalPlans = Record<string, GoalPlanTeam[]>

const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** Made so far: all of it once delivered, else the part logged (a rejected one is back to owed). */
export function madeOf(r: Pick<GoalPlanRow, "status" | "quantity" | "deliveredQuantity">): number {
  if (isOutcomeStatus(r.status)) return r.quantity
  return Math.min(r.quantity, Math.max(0, r.deliveredQuantity))
}

export function groupGoalPlans(rows: readonly GoalPlanRow[], today: Date): GoalPlans {
  const byGoal = new Map<string, Map<string, GoalPlanTeam>>()
  for (const r of rows) {
    if (r.status === "DISCARDED") continue
    const teams = byGoal.get(r.goalId) ?? new Map<string, GoalPlanTeam>()
    byGoal.set(r.goalId, teams)
    const key = r.teamId ?? ""
    const team = teams.get(key) ?? {
      teamId: r.teamId,
      teamName: r.teamName ?? "No team",
      managerName: r.teamManagerName ?? null,
      planned: 0,
      made: 0,
      overdue: 0,
      unclaimed: 0,
      items: [],
    }
    teams.set(key, team)
    const open = isOpenStatus(r.status)
    const overdue = open && r.dueOn !== null && r.dueOn < today
    const made = madeOf(r)
    team.planned += r.quantity
    team.made += made
    if (overdue) team.overdue++
    if (open && !r.employeeId) team.unclaimed++
    team.items.push({
      id: r.id,
      type: r.type,
      title: r.title,
      quantity: r.quantity,
      made,
      status: r.status,
      dueOn: r.dueOn ? ymd(r.dueOn) : null,
      employeeName: r.employeeName,
      overdue,
    })
  }
  const out: GoalPlans = {}
  for (const [goalId, teams] of byGoal) {
    const ordered = sortProjectTeams([...teams.values()].map((t) => ({ name: t.teamName, t })))
    out[goalId] = ordered.map(({ t }) => ({
      ...t,
      items: t.items.sort(
        (a, b) =>
          (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") || a.title.localeCompare(b.title),
      ),
    }))
  }
  return out
}
