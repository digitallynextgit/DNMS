import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { ForbiddenError } from "@/lib/errors"
import { todayUtc } from "@/lib/dates"
import { employeeSlug } from "@/lib/utils"
import { GOAL_SELECT, summariseGoalRows, type GoalNode } from "../lib/goal-derivation"
import { monthPeriod, periodKey, planMonthPeriod, type GoalPeriod } from "../lib/goal-periods"
import {
  addTally,
  deliverableTally,
  deliveryScore,
  goalAchievement,
  taskTally,
  type DeliveryScore,
  type OnTimeCount,
} from "../lib/delivery-score"
import { resolveReportScope, type ReportRole, type ReportScope } from "./deliverables-report"
import { loadMetaActuals } from "./goal-metrics.service"

// Delivery scores for a month, for everyone the caller may see (the Progress page's scope): people
// by the goals they own and the deliverables and tasks due on them; teams by their deliverables and
// tasks. Members see their own row only. The list and one row's breakdown read the same items, so
// the items always add up to the score.

export interface ScoredPerson {
  id: string
  /** For the profile link: /employees/<slug>, as the directory links them. */
  slug: string
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

export interface ScoreProjectRef {
  id: string
  name: string
  slug: string | null
}

/** How an item counted: on time, late, not due yet, or left out (held / discarded). */
export type ItemResult = "on_time" | "late" | "not_due" | "left_out"

export interface ScoreGoalItem {
  id: string
  title: string
  parentTitle: string | null
  project: ScoreProjectRef
  metricLabel: string | null
  target: number
  actual: number
  expected: number | null
  /** 0-100, what the goals part averages. */
  achievement: number
}

export interface ScoreDeliverableItem {
  id: string
  title: string
  type: string
  quantity: number
  project: ScoreProjectRef
  teamName: string | null
  personName: string | null
  status: string
  dueOn: string | null
  completedOn: string | null
  result: ItemResult
}

export interface ScoreTaskItem {
  id: string
  title: string
  project: ScoreProjectRef
  teamName: string | null
  personName: string | null
  status: string
  dueDate: string | null
  completedAt: string | null
  result: ItemResult
}

export interface DeliveryScoreItems {
  month: string
  /** Whose items: a person's name, or "Team · Project". */
  title: string
  score: DeliveryScore
  goals: ScoreGoalItem[]
  deliverables: ScoreDeliverableItem[]
  tasks: ScoreTaskItem[]
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
const scoreOf = (a: Acc) =>
  deliveryScore({ goalAchievements: a.goals, deliverables: a.deliverables, tasks: a.tasks })

const byScore = (
  a: { score: DeliveryScore; name: string },
  b: { score: DeliveryScore; name: string },
) => (b.score.score ?? -1) - (a.score.score ?? -1) || a.name.localeCompare(b.name)

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const nameOf = (p: { firstName: string; lastName: string | null } | null) =>
  p ? `${p.firstName} ${p.lastName ?? ""}`.trim() : null
const PERSON = { select: { firstName: true, lastName: true } } as const
const PROJECT = { select: { id: true, name: true, slug: true } } as const

/** Numbered goals that count on their own: service parts, and numbered goals with no numbered parts. */
function scoredGoals(goals: GoalNode[]): { node: GoalNode; parentTitle: string | null }[] {
  const out: { node: GoalNode; parentTitle: string | null }[] = []
  for (const g of goals) {
    const parts = g.children.filter((c) => c.targetValue !== null && c.isActive)
    if (parts.length > 0) out.push(...parts.map((node) => ({ node, parentTitle: g.title })))
    else if (g.targetValue !== null) out.push({ node: g, parentTitle: null })
  }
  return out.filter((g) => g.node.isActive && g.node.status !== "DISCARDED")
}

/** The caller's projects, narrowed to one when asked; null = every project. */
function projectFilter(scope: ReportScope, projectId?: string | null): string[] | null {
  if (scope.projectIds === null) return projectId ? [projectId] : null
  return projectId ? scope.projectIds.filter((id) => id === projectId) : scope.projectIds
}

/** Every item that scores in the month, optionally only one person's or one team's. */
async function loadItems(
  period: GoalPeriod,
  projectIds: string[] | null,
  only: { personId?: string; teamId?: string } = {},
) {
  const inProjects = projectIds === null ? {} : { projectId: { in: projectIds } }
  // Project work only: adhoc tasks have no project and no score here.
  const taskProjects: Prisma.ProjectTaskWhereInput =
    projectIds === null ? { projectId: { not: null } } : inProjects
  const window = { gte: period.start, lte: period.end }
  const today = todayUtc()

  const [deliverables, tasks, projects] = await Promise.all([
    db.projectDeliverable.findMany({
      where: {
        ...inProjects,
        dueOn: window,
        ...(only.personId ? { employeeId: only.personId } : {}),
        ...(only.teamId ? { teamId: only.teamId } : {}),
      },
      orderBy: [{ dueOn: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        type: true,
        quantity: true,
        status: true,
        dueOn: true,
        completedOn: true,
        employeeId: true,
        teamId: true,
        employee: PERSON,
        team: { select: { name: true } },
        project: PROJECT,
      },
    }),
    db.projectTask.findMany({
      where: {
        ...taskProjects,
        dueDate: window,
        ...(only.personId ? { assigneeId: only.personId } : {}),
        ...(only.teamId ? { teamId: only.teamId } : {}),
      },
      orderBy: [{ dueDate: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        completedAt: true,
        assigneeId: true,
        teamId: true,
        assignee: PERSON,
        team: { select: { name: true } },
        project: PROJECT,
      },
    }),
    // Teams have no goals part; people's goals come from projects with a number due this month.
    only.teamId
      ? Promise.resolve([])
      : db.project.findMany({
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
          select: { id: true, name: true, slug: true, ownerId: true },
        }),
  ])

  const goals: { ownerId: string; item: ScoreGoalItem; achievement: number }[] = []
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
    for (const { node: g, parentTitle } of scoredGoals(summary.goals)) {
      // One-time goals count in the month they are due.
      if (
        !g.periodStart &&
        !(g.targetDate && g.targetDate.slice(0, 7) === periodKey(period.start))
      ) {
        continue
      }
      const a = goalAchievement(g.actualValue, g.targetValue, g.paceValue)
      // Nobody named: the account manager answers for it.
      const ownerId = g.ownerId ?? p.ownerId
      if (a === null || (only.personId && ownerId !== only.personId)) continue
      goals.push({
        ownerId,
        achievement: a,
        item: {
          id: g.id,
          title: g.title,
          parentTitle,
          project: { id: p.id, name: p.name, slug: p.slug },
          metricLabel: g.metricLabel,
          target: g.targetValue!,
          actual: g.actualValue ?? 0,
          expected: g.paceValue,
          achievement: Math.round(a * 100),
        },
      })
    }
  }

  const result = (t: "on_time" | "late" | null, status: string): ItemResult =>
    t ?? (["DISCARDED", "CANCELLED", "ON_HOLD"].includes(status) ? "left_out" : "not_due")

  return {
    goals,
    deliverables: deliverables.map((d) => {
      const t = deliverableTally(d, today)
      return {
        employeeId: d.employeeId,
        teamId: d.teamId,
        tally: t,
        item: {
          id: d.id,
          title: d.title,
          type: d.type,
          quantity: d.quantity,
          project: d.project,
          teamName: d.team?.name ?? null,
          personName: nameOf(d.employee),
          status: d.status,
          dueOn: ymd(d.dueOn),
          completedOn: ymd(d.completedOn),
          result: result(t, d.status),
        } satisfies ScoreDeliverableItem,
      }
    }),
    tasks: tasks.map((k) => {
      const t = taskTally(k, today)
      return {
        assigneeId: k.assigneeId,
        teamId: k.teamId,
        tally: t,
        item: {
          id: k.id,
          title: k.title,
          project: k.project!,
          teamName: k.team?.name ?? null,
          personName: nameOf(k.assignee),
          status: k.status,
          dueDate: ymd(k.dueDate),
          completedAt: k.completedAt?.toISOString() ?? null,
          result: result(t, k.status),
        } satisfies ScoreTaskItem,
      }
    }),
  }
}

export async function getDeliveryScores(
  session: Session,
  opts: { month?: string | null; projectId?: string | null } = {},
): Promise<DeliveryScores> {
  const scope = await resolveReportScope(session)
  const period = monthPeriod(opts.month) ?? planMonthPeriod()
  const items = await loadItems(period, projectFilter(scope, opts.projectId))

  const people = new Map<string, Acc>()
  const teams = new Map<string, Acc>()
  const accOf = (m: Map<string, Acc>, id: string) => {
    const a = m.get(id) ?? emptyAcc()
    m.set(id, a)
    return a
  }
  for (const d of items.deliverables) {
    if (d.employeeId) addTally(accOf(people, d.employeeId).deliverables, d.tally)
    if (d.teamId) addTally(accOf(teams, d.teamId).deliverables, d.tally)
  }
  for (const k of items.tasks) {
    if (k.assigneeId) addTally(accOf(people, k.assigneeId).tasks, k.tally)
    if (k.teamId) addTally(accOf(teams, k.teamId).tasks, k.tally)
  }
  for (const g of items.goals) accOf(people, g.ownerId).goals.push(g.achievement)

  // Only the rows this caller may see.
  const personIds = [...people.keys()].filter((id) => seesPerson(scope, id))
  const teamIds = [...teams.keys()].filter((id) => seesTeam(scope, id))

  const [employees, teamRows] = await Promise.all([
    db.employee.findMany({
      where: { id: { in: personIds } },
      select: {
        id: true,
        employeeNo: true,
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

  return {
    month: periodKey(period.start),
    role: scope.role,
    people: employees
      .map((e) => ({
        id: e.id,
        slug: employeeSlug(e.employeeNo, e.firstName, e.lastName ?? ""),
        name: nameOf(e)!,
        designation: e.designation?.title ?? null,
        score: scoreOf(people.get(e.id)!),
      }))
      .filter((p) => p.score.basedOn > 0)
      .sort(byScore),
    teams: teamRows
      .map((t) => ({
        id: t.id,
        name: t.name,
        projectId: t.projectId,
        projectName: t.project.name,
        score: scoreOf(teams.get(t.id)!),
      }))
      .filter((t) => t.score.basedOn > 0)
      .sort(byScore),
  }
}

const seesPerson = (scope: ReportScope, id: string) =>
  scope.employeeIds === null || scope.employeeIds.includes(id)
const seesTeam = (scope: ReportScope, id: string) =>
  scope.teamIds === null || scope.teamIds.includes(id)

/** One person's or one team's month, item by item - what their score is made of. */
export async function getDeliveryScoreItems(
  session: Session,
  opts: {
    month?: string | null
    projectId?: string | null
    personId?: string | null
    teamId?: string | null
  },
): Promise<DeliveryScoreItems> {
  const scope = await resolveReportScope(session)
  const period = monthPeriod(opts.month) ?? planMonthPeriod()
  const personId = opts.personId || undefined
  const teamId = personId ? undefined : opts.teamId || undefined
  if (!personId && !teamId) throw new ForbiddenError("Say whose score to open.")
  if (personId && !seesPerson(scope, personId)) {
    throw new ForbiddenError("That person's work is not yours to see.")
  }
  if (teamId && !seesTeam(scope, teamId)) {
    throw new ForbiddenError("That team's work is not yours to see.")
  }

  const items = await loadItems(period, projectFilter(scope, opts.projectId), { personId, teamId })
  const acc = emptyAcc()
  for (const d of items.deliverables) addTally(acc.deliverables, d.tally)
  for (const k of items.tasks) addTally(acc.tasks, k.tally)
  for (const g of items.goals) acc.goals.push(g.achievement)

  let title = ""
  if (personId) {
    const e = await db.employee.findUnique({ where: { id: personId }, select: PERSON.select })
    title = nameOf(e) ?? "Person"
  } else {
    const t = await db.projectTeam.findUnique({
      where: { id: teamId },
      select: { name: true, project: { select: { name: true } } },
    })
    title = t ? `${t.name} · ${t.project.name}` : "Team"
  }

  return {
    month: periodKey(period.start),
    title,
    score: scoreOf(acc),
    goals: items.goals.map((g) => g.item),
    deliverables: items.deliverables.map((d) => d.item),
    tasks: items.tasks.map((k) => k.item),
  }
}
