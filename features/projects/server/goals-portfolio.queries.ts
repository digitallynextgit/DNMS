import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { todayUtc } from "@/lib/dates"
import {
  GOAL_ORDER,
  GOAL_SELECT_LITE,
  loadGoalOutputs,
  summariseGoalRows,
  targetTypeKeys,
  type GoalNode,
  type GoalRowLite,
} from "./goals.service"

// Goals across the portfolio for the Progress page: one query, summarised per project with the
// Goals tab's own summariseGoalRows so the two can't disagree. Deactivated goals are always out.

export interface ProjectGoalsRow {
  projectId: string
  projectName: string
  projectCode: string
  projectSlug: string | null
  /** 0-100, averaged over countable MAIN goals - the tab's own figure. */
  overallProgress: number
  totalGoals: number
  doneGoals: number
  overdueGoals: number
  atRiskGoals: number
  /** Behind schedule but not yet overdue - the early warning. */
  slippingGoals: number
  discardedGoals: number
  nextTargetDate: string | null
  /** The full tree, so the detail view needs no second request. */
  goals: GoalNode[]
}

export interface GoalsPortfolio {
  projects: ProjectGoalsRow[]
  totals: {
    /** Projects that actually have goals - the ones the percentages describe. */
    projectsWithGoals: number
    /** In scope but no goals set: unaimed, not 0%. */
    projectsWithoutGoals: number
    totalGoals: number
    doneGoals: number
    overdueGoals: number
    atRiskGoals: number
    /** Averaged over projects, not goals. */
    overallProgress: number
    nextTargetDate: string | null
  }
  /** Every tag in use across the scope, for filtering the list client-side. */
  allTags: string[]
}

/** Mirrors canAccessProject across the table - keep in step, or a listed goal 403s when opened. */
function scopeWhere(session: Session) {
  if (
    hasPermission(session, PERMISSIONS.PROJECT_READ) ||
    hasPermission(session, PERMISSIONS.PROJECT_WRITE)
  ) {
    return {}
  }
  return {
    OR: [
      { ownerId: session.user.id },
      { teams: { some: { members: { some: { employeeId: session.user.id } } } } },
    ],
  }
}

export async function getGoalsPortfolio(
  session: Session,
  opts: { projectId?: string } = {},
): Promise<GoalsPortfolio> {
  const projects = await db.project.findMany({
    where: {
      ...scopeWhere(session),
      ...(opts.projectId ? { id: opts.projectId } : {}),
    },
    select: { id: true, name: true, code: true, slug: true },
    orderBy: { name: "asc" },
  })
  if (projects.length === 0) {
    return {
      projects: [],
      totals: {
        projectsWithGoals: 0,
        projectsWithoutGoals: 0,
        totalGoals: 0,
        doneGoals: 0,
        overdueGoals: 0,
        atRiskGoals: 0,
        overallProgress: 0,
        nextTargetDate: null,
      },
      allTags: [],
    }
  }

  const rows = await db.projectGoal.findMany({
    where: { projectId: { in: projects.map((p) => p.id) }, isActive: true },
    orderBy: GOAL_ORDER,
    // LITE: no event history (nothing here renders it, and it is the bulk of the payload).
    select: { ...GOAL_SELECT_LITE, projectId: true },
  })

  const byProject = new Map<string, GoalRowLite[]>()
  for (const r of rows) {
    const list = byProject.get(r.projectId)
    if (list) list.push(r)
    else byProject.set(r.projectId, [r])
  }

  // One `today` for the whole sweep so the date can't roll over mid-loop.
  const today = todayUtc()

  // One query for every project's output; each summariser only reads its own goals' ids.
  const outputs = await loadGoalOutputs(
    projects.map((p) => p.id),
    targetTypeKeys(rows),
  )

  const out: ProjectGoalsRow[] = []
  for (const p of projects) {
    const summary = summariseGoalRows(byProject.get(p.id) ?? [], today, outputs)
    out.push({
      projectId: p.id,
      projectName: p.name,
      projectCode: p.code,
      projectSlug: p.slug,
      overallProgress: summary.overallProgress,
      totalGoals: summary.totalGoals,
      doneGoals: summary.doneGoals,
      overdueGoals: summary.overdueGoals,
      // Main goals only, matching totalGoals (else "5 at risk of 3").
      atRiskGoals: summary.goals.filter((g) => g.status === "AT_RISK").length,
      // Includes sub-goals: a count of rows to look at, not compared against main goals.
      slippingGoals: summary.slippingGoals,
      discardedGoals: summary.discardedGoals,
      nextTargetDate: summary.nextTargetDate,
      goals: summary.goals,
    })
  }

  // Busiest and most at-risk first.
  out.sort(
    (a, b) =>
      b.overdueGoals - a.overdueGoals ||
      b.atRiskGoals - a.atRiskGoals ||
      b.totalGoals - a.totalGoals ||
      a.projectName.localeCompare(b.projectName),
  )

  const withGoals = out.filter((p) => p.totalGoals > 0)
  const upcoming = out
    .map((p) => p.nextTargetDate)
    .filter((d): d is string => Boolean(d))
    .sort()

  const allTags = [
    ...new Set(
      out.flatMap((p) => p.goals.flatMap((g) => [g, ...g.children]).flatMap((g) => g.tags)),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

  return {
    projects: out,
    totals: {
      projectsWithGoals: withGoals.length,
      projectsWithoutGoals: out.length - withGoals.length,
      totalGoals: out.reduce((s, p) => s + p.totalGoals, 0),
      doneGoals: out.reduce((s, p) => s + p.doneGoals, 0),
      overdueGoals: out.reduce((s, p) => s + p.overdueGoals, 0),
      atRiskGoals: out.reduce((s, p) => s + p.atRiskGoals, 0),
      // Per-project average so big accounts don't drown small ones; goal-less projects are excluded.
      overallProgress:
        withGoals.length === 0
          ? 0
          : Math.round(withGoals.reduce((s, p) => s + p.overallProgress, 0) / withGoals.length),
      nextTargetDate: upcoming[0] ?? null,
    },
    allTags,
  }
}
