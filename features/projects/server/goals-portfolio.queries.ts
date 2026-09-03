import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import {
  GOAL_ORDER,
  GOAL_SELECT_LITE,
  summariseGoalRows,
  type GoalNode,
  type GoalRowLite,
} from "./goals.service"

// =============================================================================
// Goals across the whole portfolio, for the Progress page.
//
// The Goals tab answers "how is THIS project's plan going". This answers the
// question a manager opens Progress to ask: "across everything I run, what did
// we say we would achieve, and are we going to?" Tasks tell you what people are
// doing; goals tell you whether it adds up to what was promised. The page had
// only the first half.
//
// ── ONE QUERY, NOT ONE PER PROJECT ───────────────────────────────────────────
// Every goal for every in-scope project comes back in a single findMany and is
// grouped in memory, then each group is handed to summariseGoalRows - the exact
// function the Goals tab uses. So the progress bar on this page and the progress
// bar on the tab are computed by the same code from the same columns, and cannot
// disagree. Looping getProjectGoals() would have been N round-trips AND a second
// place for the rollup to drift.
//
// ── DEACTIVATED GOALS ARE OUT ────────────────────────────────────────────────
// Always. `includeInactive` is a Goals-tab affordance for someone auditing one
// project; a portfolio roll-up that silently included soft-deleted goals would
// report a denominator nobody can see.
// =============================================================================

export interface ProjectGoalsRow {
  projectId: string
  projectName: string
  projectCode: string
  /** For linking straight to the project's Goals tab. */
  projectSlug: string | null
  /** 0-100, averaged over countable MAIN goals - the tab's own figure. */
  overallProgress: number
  totalGoals: number
  doneGoals: number
  overdueGoals: number
  atRiskGoals: number
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
    /** In scope but with no goals set at all. Worth naming: a project with no
     *  stated goal is not a project at 0%, it is a project nobody has aimed. */
    projectsWithoutGoals: number
    totalGoals: number
    doneGoals: number
    overdueGoals: number
    atRiskGoals: number
    /** Averaged over PROJECTS, not goals - see the note in the code. */
    overallProgress: number
    nextTargetDate: string | null
  }
  /** Every tag in use across the scope, for filtering the list client-side. */
  allTags: string[]
}

/**
 * Which projects this person may see goals for.
 *
 * Mirrors canAccessProject (features/projects/server/project-access.ts) applied
 * across the whole table rather than to one id: the global readers see
 * everything, everyone else sees what they own or sit on a team for. Kept in
 * step with that function deliberately - a goal visible here but 403 when opened
 * is worse than one that never appeared.
 */
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
    // LITE: no event history. Nothing on the Progress page renders it, and it
    // is `take: 25` per goal - the largest thing in this payload by far.
    select: { ...GOAL_SELECT_LITE, projectId: true },
  })

  const byProject = new Map<string, GoalRowLite[]>()
  for (const r of rows) {
    const list = byProject.get(r.projectId)
    if (list) list.push(r)
    else byProject.set(r.projectId, [r])
  }

  // One `today` for the whole sweep: computing it per project would let the date
  // roll over mid-loop and mark one project's goal overdue and another's not.
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const out: ProjectGoalsRow[] = []
  for (const p of projects) {
    const summary = summariseGoalRows(byProject.get(p.id) ?? [], today)
    out.push({
      projectId: p.id,
      projectName: p.name,
      projectCode: p.code,
      projectSlug: p.slug,
      overallProgress: summary.overallProgress,
      totalGoals: summary.totalGoals,
      doneGoals: summary.doneGoals,
      overdueGoals: summary.overdueGoals,
      // Main goals only, matching totalGoals - a portfolio row that counted
      // at-risk sub-goals against a denominator of main goals could report
      // "5 at risk of 3".
      atRiskGoals: summary.goals.filter((g) => g.status === "AT_RISK").length,
      discardedGoals: summary.discardedGoals,
      nextTargetDate: summary.nextTargetDate,
      goals: summary.goals,
    })
  }

  // Busiest and most at-risk first: the row you need is the one in trouble, not
  // the one that sorts first alphabetically.
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
      // Averaged over PROJECTS rather than pooling every goal, so an account
      // with twenty goals cannot drown out one with three. The question this
      // page asks is "how are my projects doing", and each project is one
      // answer. Projects with NO goals are excluded from the denominator - they
      // are unaimed, not failing, and counting them as 0% would say otherwise.
      overallProgress:
        withGoals.length === 0
          ? 0
          : Math.round(withGoals.reduce((s, p) => s + p.overallProgress, 0) / withGoals.length),
      nextTargetDate: upcoming[0] ?? null,
    },
    allTags,
  }
}
