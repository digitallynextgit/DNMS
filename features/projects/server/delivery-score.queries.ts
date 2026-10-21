import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { todayUtc } from "@/lib/dates"
import { GOAL_SELECT, summariseGoalRows, type GoalNode } from "../lib/goal-derivation"
import { monthPeriod, periodKey, planMonthPeriod } from "../lib/goal-periods"
import {
  addTally,
  deliverableTally,
  deliveryScore,
  goalAchievement,
  taskTally,
  type DeliveryScore,
  type OnTimeCount,
} from "../lib/delivery-score"
import { resolveReportScope, type ReportRole } from "./deliverables-report"
import { loadMetaActuals } from "./goal-metrics.service"

// Delivery scores for a month, for everyone the caller may see (the Progress page's scope): people
// by the goals they own and the deliverables and tasks due on them; teams by their deliverables and
// tasks. Members see their own row only.

export interface ScoredPerson {
  id: string
  name: string
  designation: string | null
  score: DeliveryScore
}

export interface ScoredTeam {
  id: string
  name: string
  projectId: string
  projectName: string
  score: DeliveryScore
}

export interface DeliveryScores {
  month: string
  role: ReportRole
  people: ScoredPerson[]
  teams: ScoredTeam[]
}

interface Acc {
  goals: number[]
  deliverables: OnTimeCount
  tasks: OnTimeCount
}
const emptyAcc = (): Acc => ({
  goals: [],
  deliverables: { onTime: 0, due: 0 },
  tasks: { onTime: 0, due: 0 },
})

const byScore = (
  a: { score: DeliveryScore; name: string },
  b: { score: DeliveryScore; name: string },
) => (b.score.score ?? -1) - (a.score.score ?? -1) || a.name.localeCompare(b.name)

/** Numbered goals that count on their own: service parts, and numbered goals with no numbered parts. */
function scoredGoals(goals: GoalNode[]): GoalNode[] {
  const out: GoalNode[] = []
  for (const g of goals) {
    const parts = g.children.filter((c) => c.targetValue !== null && c.isActive)
    if (parts.length > 0) out.push(...parts)
    else if (g.targetValue !== null) out.push(g)
  }
  return out.filter((g) => g.isActive && g.status !== "DISCARDED")
}

export async function getDeliveryScores(
  session: Session,
  opts: { month?: string | null; projectId?: string | null } = {},
): Promise<DeliveryScores> {
  const scope = await resolveReportScope(session)
  const period = monthPeriod(opts.month) ?? planMonthPeriod()
  const today = todayUtc()

  const projectIds =
    scope.projectIds === null
      ? opts.projectId
        ? [opts.projectId]
        : null
      : opts.projectId
        ? scope.projectIds.filter((id) => id === opts.projectId)
        : scope.projectIds
  const inProjects = projectIds === null ? {} : { projectId: { in: projectIds } }
  // Project work only: adhoc tasks have no project and no score here.
  const taskProjects: Prisma.ProjectTaskWhereInput =
    projectIds === null ? { projectId: { not: null } } : inProjects
  const window = { gte: period.start, lte: period.end }

  const [deliverables, tasks, projects] = await Promise.all([
    db.projectDeliverable.findMany({
      where: { ...inProjects, dueOn: window, status: { not: "DISCARDED" } },
      select: { status: true, dueOn: true, completedOn: true, employeeId: true, teamId: true },
    }),
    db.projectTask.findMany({
      where: { ...taskProjects, dueDate: window },
      select: { status: true, dueDate: true, completedAt: true, assigneeId: true, teamId: true },
    }),
    // Projects with a number due this month: a monthly edition, or a one-time goal due in it.
    db.project.findMany({
      where: {
        ...(projectIds === null ? {} : { id: { in: projectIds } }),
        projectGoals: {
          some: {
            isActive: true,
            targetValue: { not: null },
            OR: [{ periodStart: period.start }, { seriesId: null, targetDate: window }],
          },
        },
      },
      select: { id: true, ownerId: true },
    }),
  ])

  const people = new Map<string, Acc>()
  const teams = new Map<string, Acc>()
  const accOf = (m: Map<string, Acc>, id: string) => {
    const a = m.get(id) ?? emptyAcc()
    m.set(id, a)
    return a
  }

  for (const d of deliverables) {
    const t = deliverableTally(d, today)
    if (d.employeeId) addTally(accOf(people, d.employeeId).deliverables, t)
    if (d.teamId) addTally(accOf(teams, d.teamId).deliverables, t)
  }
  for (const k of tasks) {
    const t = taskTally(k, today)
    if (k.assigneeId) addTally(accOf(people, k.assigneeId).tasks, t)
    if (k.teamId) addTally(accOf(teams, k.teamId).tasks, t)
  }

  for (const p of projects) {
    const rows = await db.projectGoal.findMany({
      where: {
        projectId: p.id,
        isActive: true,
        OR: [{ periodStart: period.start }, { seriesId: null }],
      },
      select: GOAL_SELECT,
    })
    const summary = summariseGoalRows(rows, today, undefined, await loadMetaActuals(p.id, rows))
    for (const g of scoredGoals(summary.goals)) {
      // One-time goals count in the month they are due.
      if (
        !g.periodStart &&
        !(g.targetDate && g.targetDate.slice(0, 7) === periodKey(period.start))
      ) {
        continue
      }
      const a = goalAchievement(g.actualValue, g.targetValue, g.paceValue)
      // Nobody named: the account manager answers for it.
      const owner = g.ownerId ?? p.ownerId
      if (a !== null) accOf(people, owner).goals.push(a)
    }
  }

  // Only the rows this caller may see.
  const seePerson = (id: string) => scope.employeeIds === null || scope.employeeIds.includes(id)
  const seeTeam = (id: string) => scope.teamIds === null || scope.teamIds.includes(id)
  const personIds = [...people.keys()].filter(seePerson)
  const teamIds = [...teams.keys()].filter(seeTeam)

  const [employees, teamRows] = await Promise.all([
    db.employee.findMany({
      where: { id: { in: personIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        designation: { select: { title: true } },
      },
    }),
    db.projectTeam.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
    }),
  ])
  const score = (a: Acc) =>
    deliveryScore({ goalAchievements: a.goals, deliverables: a.deliverables, tasks: a.tasks })

  return {
    month: periodKey(period.start),
    role: scope.role,
    people: employees
      .map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName ?? ""}`.trim(),
        designation: e.designation?.title ?? null,
        score: score(people.get(e.id)!),
      }))
      .filter((p) => p.score.basedOn > 0)
      .sort(byScore),
    teams: teamRows
      .map((t) => ({
        id: t.id,
        name: t.name,
        projectId: t.projectId,
        projectName: t.project.name,
        score: score(teams.get(t.id)!),
      }))
      .filter((t) => t.score.basedOn > 0)
      .sort(byScore),
  }
}
