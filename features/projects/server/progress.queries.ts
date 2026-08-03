import "server-only"

import { db } from "@/server/db"
import { getSeoRollup } from "@/features/seo/server/seo.queries"

// =============================================================================
// "How is this project actually going?"
//
// The project Overview only counted teams, members and tasks, which says nothing
// about progress. This answers three questions in one payload:
//   1. Delivery: how much is done, how much is late, and is the pace holding
//   2. Who: the same numbers per team and per member
//   3. Search: what the tracked sites are doing, since for most of these clients
//      that IS the outcome the work is judged on
//
// Rates are null rather than 0 when there is nothing to measure. A team with no
// finished tasks has an UNKNOWN on-time rate, not a 0% one, and showing 0% would
// read as failure where the honest answer is "no data yet".
// =============================================================================

const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "ON_HOLD"] as const
const TREND_WEEKS = 8

export interface ProgressBucket {
  total: number
  todo: number
  inProgress: number
  inReview: number
  done: number
  onHold: number
  discarded: number
  overdue: number
  /** Finished on or before the due date. */
  onTime: number
  late: number
  /** done / (total excluding discarded), 0..100, null when nothing to measure. */
  completionRate: number | null
  /** onTime / (onTime + late), 0..100, null when nothing has been completed. */
  onTimeRate: number | null
  estimatedHours: number
  loggedHours: number
}

export interface TeamProgress extends ProgressBucket {
  id: string
  name: string
  members: number
}

export interface MemberProgress extends ProgressBucket {
  id: string
  name: string
  profilePhoto: string | null
  teamName: string | null
}

export interface UpcomingTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string
  /** Lets the Overview filter this list down to "my next tasks" without a second query. */
  assigneeId: string | null
  assigneeName: string | null
  teamName: string | null
  overdue: boolean
}

export interface SeoSiteProgress {
  id: string
  label: string
  domain: string
  clicks: number
  clicksChange: number | null
  impressions: number
  position: number
  /** Latest stored scorecard, when one has been built. */
  score: number | null
  coverage: number | null
  band: string | null
  openTasks: number
  overdueTasks: number
  criticalAlerts: number
}

export interface ProjectProgress {
  summary: ProgressBucket
  byTeam: TeamProgress[]
  byMember: MemberProgress[]
  /** Completed count per week, oldest first, for the pace chart. */
  trend: { weekStart: string; completed: number; due: number }[]
  upcoming: UpcomingTask[]
  seo: SeoSiteProgress[]
  /** Combined search totals across the project's sites, null when none tracked. */
  seoTotals: { clicks: number; clicksChange: number | null; impressions: number } | null
}

type TaskRow = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: Date | null
  completedAt: Date | null
  estimatedHours: number | null
  loggedHours: number
  teamId: string | null
  assigneeId: string | null
  assignee: { id: string; firstName: string; lastName: string; profilePhoto: string | null } | null
  team: { id: string; name: string } | null
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10)

function emptyBucket(): ProgressBucket {
  return {
    total: 0,
    todo: 0,
    inProgress: 0,
    inReview: 0,
    done: 0,
    onHold: 0,
    discarded: 0,
    overdue: 0,
    onTime: 0,
    late: 0,
    completionRate: null,
    onTimeRate: null,
    estimatedHours: 0,
    loggedHours: 0,
  }
}

/** Fold one task into a bucket. `now` is passed in so every bucket in a run
 *  judges "overdue" against the same instant. */
function addTask(b: ProgressBucket, t: TaskRow, now: Date) {
  b.total++
  b.estimatedHours += t.estimatedHours ?? 0
  b.loggedHours += t.loggedHours

  switch (t.status) {
    case "TODO":
      b.todo++
      break
    case "IN_PROGRESS":
      b.inProgress++
      break
    case "IN_REVIEW":
      b.inReview++
      break
    case "DONE":
      b.done++
      break
    case "ON_HOLD":
      b.onHold++
      break
    case "DISCARDED":
    case "CANCELLED":
      b.discarded++
      break
  }

  if (t.status === "DONE") {
    // Completed with no due date cannot be judged either way, so it counts
    // toward neither on-time nor late.
    if (t.dueDate) {
      const finished = t.completedAt ?? now
      if (finished <= endOfDay(t.dueDate)) b.onTime++
      else b.late++
    }
  } else if (
    t.dueDate &&
    endOfDay(t.dueDate) < now &&
    (OPEN_STATUSES as readonly string[]).includes(t.status)
  ) {
    b.overdue++
  }
}

/** A task due on the 5th is not late until the 5th is over. */
function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(23, 59, 59, 999)
  return x
}

function finalise(b: ProgressBucket): ProgressBucket {
  const countable = b.total - b.discarded
  b.completionRate = countable > 0 ? Math.round((b.done / countable) * 1000) / 10 : null
  const judged = b.onTime + b.late
  b.onTimeRate = judged > 0 ? Math.round((b.onTime / judged) * 1000) / 10 : null
  b.estimatedHours = Math.round(b.estimatedHours * 10) / 10
  b.loggedHours = Math.round(b.loggedHours * 10) / 10
  return b
}

/**
 * @param range Optional yyyy-mm-dd window. Scopes to tasks DUE inside it, the
 *   same rule the Progress page's headline tiles use - otherwise the tiles and
 *   this breakdown disagree, and a range with no work still shows a full report.
 */
export async function getProjectProgress(
  projectId: string,
  range?: { from?: string | null; to?: string | null },
): Promise<ProjectProgress | null> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } })
  if (!project) return null

  const now = new Date()

  const dueRange =
    range?.from || range?.to
      ? {
          dueDate: {
            ...(range.from && { gte: new Date(`${range.from}T00:00:00.000Z`) }),
            ...(range.to && { lte: new Date(`${range.to}T23:59:59.999Z`) }),
          },
        }
      : {}

  const [tasks, teams] = await Promise.all([
    db.projectTask.findMany({
      where: { projectId, approvalStatus: { not: "REJECTED" }, ...dueRange },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        estimatedHours: true,
        loggedHours: true,
        teamId: true,
        assigneeId: true,
        assignee: {
          select: { id: true, firstName: true, lastName: true, profilePhoto: true },
        },
        team: { select: { id: true, name: true } },
      },
    }) as Promise<TaskRow[]>,
    db.projectTeam.findMany({
      where: { projectId },
      select: { id: true, name: true, _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    }),
  ])

  // --- summary, per team, per member ---------------------------------------
  const summary = emptyBucket()
  const teamBuckets = new Map<string, TeamProgress>()
  for (const t of teams) {
    teamBuckets.set(t.id, { ...emptyBucket(), id: t.id, name: t.name, members: t._count.members })
  }
  // Tasks with no team still need somewhere to go, or the per-team numbers
  // would silently not add up to the summary.
  const UNASSIGNED = "__no_team__"
  teamBuckets.set(UNASSIGNED, {
    ...emptyBucket(),
    id: UNASSIGNED,
    name: "No team",
    members: 0,
  })

  const memberBuckets = new Map<string, MemberProgress>()

  for (const t of tasks) {
    addTask(summary, t, now)

    const teamKey = t.teamId && teamBuckets.has(t.teamId) ? t.teamId : UNASSIGNED
    addTask(teamBuckets.get(teamKey)!, t, now)

    if (t.assignee) {
      let m = memberBuckets.get(t.assignee.id)
      if (!m) {
        m = {
          ...emptyBucket(),
          id: t.assignee.id,
          name: `${t.assignee.firstName} ${t.assignee.lastName}`,
          profilePhoto: t.assignee.profilePhoto,
          teamName: t.team?.name ?? null,
        }
        memberBuckets.set(t.assignee.id, m)
      }
      addTask(m, t, now)
    }
  }

  finalise(summary)
  const byTeam = [...teamBuckets.values()]
    .filter((t) => t.total > 0 || t.id !== UNASSIGNED)
    .map(finalise) as TeamProgress[]
  const byMember = ([...memberBuckets.values()] as MemberProgress[])
    .map(finalise as (b: ProgressBucket) => ProgressBucket)
    .map((b) => b as MemberProgress)
    .sort((a, b) => b.total - a.total)

  // --- weekly pace ----------------------------------------------------------
  // Monday-start weeks, oldest first.
  const weekStart = new Date(now)
  weekStart.setUTCHours(0, 0, 0, 0)
  weekStart.setUTCDate(weekStart.getUTCDate() - ((now.getUTCDay() + 6) % 7))

  const trend: { weekStart: string; completed: number; due: number }[] = []
  for (let i = TREND_WEEKS - 1; i >= 0; i--) {
    const start = new Date(weekStart)
    start.setUTCDate(start.getUTCDate() - i * 7)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 7)
    trend.push({
      weekStart: dateKey(start),
      completed: tasks.filter((t) => t.completedAt && t.completedAt >= start && t.completedAt < end)
        .length,
      due: tasks.filter((t) => t.dueDate && t.dueDate >= start && t.dueDate < end).length,
    })
  }

  // --- what is coming up ----------------------------------------------------
  const upcoming: UpcomingTask[] = tasks
    .filter((t) => t.dueDate && (OPEN_STATUSES as readonly string[]).includes(t.status))
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    // Deep enough that a single person's own next tasks are always in here, so
    // the Overview can derive "my next tasks" client-side.
    .slice(0, 40)
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: dateKey(t.dueDate!),
      assigneeId: t.assigneeId,
      assigneeName: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : null,
      teamName: t.team?.name ?? null,
      overdue: endOfDay(t.dueDate!) < now,
    }))

  // --- search performance ---------------------------------------------------
  // Reuses the SEO roll-up so these numbers can never disagree with the SEO tab.
  const rollup = await getSeoRollup(projectId)
  const cards = await db.seoScorecard.findMany({
    where: { property: { projectId } },
    orderBy: { periodEnd: "desc" },
    select: { propertyId: true, score: true, coverage: true, band: true },
  })
  const latestCard = new Map<string, (typeof cards)[number]>()
  for (const c of cards) if (!latestCard.has(c.propertyId)) latestCard.set(c.propertyId, c)

  const seo: SeoSiteProgress[] = rollup.properties.map((p) => {
    const card = latestCard.get(p.id)
    return {
      id: p.id,
      label: p.label,
      domain: p.domain,
      clicks: p.clicks.current,
      clicksChange: p.clicks.comparable ? p.clicks.change : null,
      impressions: p.impressions.current,
      position: p.position.current,
      score: card?.score ?? null,
      coverage: card?.coverage ?? null,
      band: card?.band ?? null,
      openTasks: p.openTasks,
      overdueTasks: p.overdueTasks,
      criticalAlerts: p.alerts.filter((a) => a.level === "critical").length,
    }
  })

  return {
    summary,
    byTeam,
    byMember,
    trend,
    upcoming,
    seo,
    seoTotals: seo.length
      ? {
          clicks: rollup.totals.clicks.current,
          clicksChange: rollup.totals.clicks.comparable ? rollup.totals.clicks.change : null,
          impressions: rollup.totals.impressions.current,
        }
      : null,
  }
}
