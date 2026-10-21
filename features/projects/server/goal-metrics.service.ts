import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { addDays, latestCalendarDay, startOfDayUTC, todayUtc } from "@/lib/dates"
import { createNotification } from "@/lib/notifications"
import {
  GOAL_ORDER,
  GOAL_SELECT_LITE,
  summariseGoalRows,
  ymd,
  type GoalActualMap,
  type GoalSeriesInfo,
} from "../lib/goal-derivation"
import { periodKey, planMonthPeriod, type GoalPeriod } from "../lib/goal-periods"
import { formatMonth } from "../lib/calendar-months"
import { projectHref } from "../lib/project-href"
import { canManageProject } from "./project-access"

// The numbers behind goals: results entered against them, Meta purchases for Paid, the monthly
// editions of recurring goals (copied from the latest), stopping a series, and its growth history.

/** After a month ends, its owner has this long to enter the last numbers; managers any time. */
const GRACE_DAYS = 7
const MAX_RESULT = 1_000_000_000
const MAX_NOTE = 300

/** Who owns a service on a project now - accountable for its part of a goal by default. */
export async function serviceOwnerId(projectId: string, service: string): Promise<string | null> {
  const row = await db.projectServiceOwner.findUnique({
    where: { projectId_service: { projectId, service } },
    select: { employeeId: true },
  })
  return row?.employeeId ?? null
}

/** The window a goal's results belong to: its month, else creation to its target date (or today). */
function resultWindow(g: {
  periodStart: Date | null
  periodEnd: Date | null
  targetDate: Date | null
  createdAt: Date
}): GoalPeriod {
  return {
    start: g.periodStart ?? startOfDayUTC(g.createdAt),
    end: g.periodEnd ?? g.targetDate ?? todayUtc(),
  }
}

/**
 * Meta Ads purchases for the goals that read them, summed over each goal's window (up to today).
 * One query per such goal - a project has a handful.
 */
export async function loadMetaActuals(
  projectId: string,
  rows: readonly {
    id: string
    actualSource: string
    periodStart: Date | null
    periodEnd: Date | null
    targetDate: Date | null
    createdAt: Date
  }[],
): Promise<GoalActualMap> {
  const meta = rows.filter((r) => r.actualSource === "META_PURCHASES")
  if (meta.length === 0) return new Map()
  const today = todayUtc()
  const out = new Map<string, number>()
  for (const r of meta) {
    const w = resultWindow(r)
    const end = w.end < today ? w.end : today
    if (end < w.start) {
      out.set(r.id, 0)
      continue
    }
    const sum = await db.metaCampaignMetric.aggregate({
      where: { campaign: { projectId }, date: { gte: w.start, lte: end } },
      _sum: { purchases: true },
    })
    out.set(r.id, sum._sum.purchases ?? 0)
  }
  return out
}

/** The project's recurring goals, for the month switcher and the growth chart. */
export async function goalSeriesInfo(projectId: string): Promise<GoalSeriesInfo[]> {
  const series = await db.projectGoalSeries.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      stoppedAt: true,
      goals: {
        where: { parentId: null },
        orderBy: { periodStart: "asc" },
        select: { periodStart: true },
      },
    },
  })
  return series.map((s) => ({
    id: s.id,
    title: s.title,
    stoppedAt: s.stoppedAt?.toISOString() ?? null,
    months: s.goals.filter((g) => g.periodStart).map((g) => periodKey(g.periodStart!)),
  }))
}

/** Project managers, the goal's owner, and on a service part the service's two owners. */
async function mayEnterResults(
  session: Session,
  projectId: string,
  goal: { ownerId: string | null; service: string | null },
): Promise<{ allowed: boolean; manager: boolean }> {
  if (await canManageProject(session, projectId)) return { allowed: true, manager: true }
  const me = session.user.id
  if (goal.ownerId === me) return { allowed: true, manager: false }
  if (goal.service) {
    const owners = await db.projectServiceOwner.findUnique({
      where: { projectId_service: { projectId, service: goal.service } },
      select: { employeeId: true, secondaryEmployeeId: true },
    })
    if (owners && (owners.employeeId === me || owners.secondaryEmployeeId === me)) {
      return { allowed: true, manager: false }
    }
  }
  return { allowed: false, manager: false }
}

function parseDay(value: unknown): Date {
  if (value === undefined || value === null || value === "") return todayUtc()
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("The date must look like YYYY-MM-DD.")
  }
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new ValidationError("That date is not a real date.")
  return d
}

async function goalForResults(projectId: string, goalId: string) {
  const goal = await db.projectGoal.findFirst({
    where: { id: goalId, projectId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      service: true,
      metricLabel: true,
      targetValue: true,
      actualSource: true,
      periodStart: true,
      periodEnd: true,
      targetDate: true,
      createdAt: true,
      isActive: true,
      _count: { select: { children: { where: { targetValue: { not: null } } } } },
    },
  })
  if (!goal) throw new NotFoundError("Goal")
  return goal
}

/** "180 orders for the week of 5 Oct". Owners until a week after the month ends; managers any time. */
export async function addGoalResult(
  session: Session,
  projectId: string,
  goalId: string,
  input: { value?: unknown; recordedFor?: unknown; note?: unknown },
): Promise<{ id: string }> {
  const goal = await goalForResults(projectId, goalId)
  const who = await mayEnterResults(session, projectId, goal)
  if (!who.allowed) {
    throw new ForbiddenError(
      "Only this goal's owner, its service's owners or a project manager can enter results",
    )
  }
  if (!goal.isActive) throw new ValidationError("This goal is deactivated.")
  if (!goal.targetValue || !goal.metricLabel) {
    throw new ValidationError("Give this goal a number before entering results.")
  }
  if (goal.actualSource !== "MANUAL") {
    throw new ValidationError("This goal's results come from Meta Ads automatically.")
  }
  if (goal._count.children > 0) {
    throw new ValidationError("Enter results on the service parts - this goal adds them up.")
  }

  const value = input.value
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_RESULT) {
    throw new ValidationError("A result is a number, 0 or more.")
  }
  const day = parseDay(input.recordedFor)
  if (day > latestCalendarDay()) throw new ValidationError("A result can't be for a future day.")
  const w = resultWindow(goal)
  if (goal.periodStart && (day < w.start || day > w.end)) {
    throw new ValidationError(
      `This edition covers ${formatMonth(ymd(goal.periodStart))} - pick a day in it.`,
    )
  }
  if (!who.manager && goal.periodEnd && todayUtc() > addDays(goal.periodEnd, GRACE_DAYS)) {
    throw new ValidationError(
      `This month closed more than ${GRACE_DAYS} days ago - ask the account manager to add it.`,
    )
  }
  const note = typeof input.note === "string" ? input.note.trim().slice(0, MAX_NOTE) || null : null

  return db.$transaction(async (tx) => {
    const row = await tx.projectGoalResult.create({
      data: { goalId, recordedFor: day, value, note, enteredById: session.user.id },
      select: { id: true },
    })
    await tx.projectGoalEvent.create({
      data: {
        goalId,
        type: "EDITED",
        reason: `Result added: ${value.toLocaleString("en-IN")} ${goal.metricLabel} for ${ymd(day)}${note ? ` (${note})` : ""}`,
        actorId: session.user.id,
      },
    })
    return row
  })
}

/** A wrong number is removed, not edited; the history keeps what it said. */
export async function deleteGoalResult(
  session: Session,
  projectId: string,
  goalId: string,
  resultId: string,
): Promise<void> {
  const goal = await goalForResults(projectId, goalId)
  const result = await db.projectGoalResult.findFirst({
    where: { id: resultId, goalId },
    select: { id: true, value: true, recordedFor: true, enteredById: true },
  })
  if (!result) throw new NotFoundError("Result")
  const who = await mayEnterResults(session, projectId, goal)
  if (!who.manager && !(who.allowed && result.enteredById === session.user.id)) {
    throw new ForbiddenError("Only whoever entered it, or a project manager, can remove a result")
  }
  if (!who.manager && goal.periodEnd && todayUtc() > addDays(goal.periodEnd, GRACE_DAYS)) {
    throw new ValidationError("This month is closed - ask the account manager.")
  }
  await db.$transaction(async (tx) => {
    await tx.projectGoalResult.delete({ where: { id: result.id } })
    await tx.projectGoalEvent.create({
      data: {
        goalId,
        type: "EDITED",
        reason:
          `Result removed: ${result.value.toLocaleString("en-IN")} ${goal.metricLabel ?? ""} for ${ymd(result.recordedFor)}`.trim(),
        actorId: session.user.id,
      },
    })
  })
}

const EDITION_SELECT = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  tags: true,
  sortOrder: true,
  ownerId: true,
  metricLabel: true,
  targetValue: true,
  actualSource: true,
  periodStart: true,
  isActive: true,
  targets: { select: { deliverableType: true, quantity: true, periodStart: true } },
  children: {
    where: { isActive: true },
    orderBy: GOAL_ORDER,
    select: {
      title: true,
      description: true,
      tags: true,
      sortOrder: true,
      ownerId: true,
      metricLabel: true,
      targetValue: true,
      service: true,
      actualSource: true,
      targets: { select: { deliverableType: true, quantity: true, periodStart: true } },
    },
  },
} satisfies Prisma.ProjectGoalSelect

/**
 * Every repeating goal gets this month's edition, copied from its latest: the goal, its parts (owned
 * by each service's owner now) and their deliverable targets, moved to the new month. Results,
 * tasks and deliverables are not copied - each month is judged on its own. Safe to run any time:
 * the database allows one main goal per series per month. Returns the editions created.
 */
export async function ensureGoalEditions(
  opts: { projectId?: string; now?: Date } = {},
): Promise<{ projectId: string; goalId: string; seriesId: string }[]> {
  const month = planMonthPeriod(opts.now)
  const series = await db.projectGoalSeries.findMany({
    where: { stoppedAt: null, ...(opts.projectId ? { projectId: opts.projectId } : {}) },
    select: { id: true, projectId: true },
  })
  const created: { projectId: string; goalId: string; seriesId: string }[] = []
  for (const s of series) {
    const has = await db.projectGoal.findFirst({
      where: { seriesId: s.id, parentId: null, periodStart: month.start },
      select: { id: true },
    })
    if (has) continue
    const latest = await db.projectGoal.findFirst({
      where: { seriesId: s.id, parentId: null, periodStart: { lt: month.start } },
      orderBy: { periodStart: "desc" },
      select: EDITION_SELECT,
    })
    // A deactivated latest month reads as "we stopped"; nothing is created behind anyone's back.
    if (!latest || !latest.isActive) continue

    const owners = new Map<string, string | null>()
    for (const c of latest.children) {
      if (c.service && !owners.has(c.service)) {
        owners.set(c.service, await serviceOwnerId(s.projectId, c.service))
      }
    }
    // A target for a whole month moves to the new month; an open-ended one stays open-ended.
    const moveTargets = (
      ts: { deliverableType: string; quantity: number; periodStart: Date | null }[],
    ) =>
      ts.map((t) => ({
        deliverableType: t.deliverableType,
        quantity: t.quantity,
        periodStart: t.periodStart ? month.start : null,
        periodEnd: t.periodStart ? month.end : null,
      }))
    const from = latest.periodStart ? formatMonth(ymd(latest.periodStart)) : "the last month"

    try {
      const goalId = await db.$transaction(async (tx) => {
        const goal = await tx.projectGoal.create({
          data: {
            projectId: s.projectId,
            title: latest.title,
            description: latest.description,
            tags: latest.tags,
            sortOrder: latest.sortOrder,
            ownerId: latest.ownerId,
            metricLabel: latest.metricLabel,
            targetValue: latest.targetValue,
            actualSource: latest.actualSource,
            seriesId: s.id,
            periodStart: month.start,
            periodEnd: month.end,
            targetDate: month.end,
          },
          select: { id: true },
        })
        await tx.projectGoalEvent.create({
          data: {
            goalId: goal.id,
            type: "CREATED",
            toStatus: "NOT_STARTED",
            reason: `Repeated from ${from}`,
          },
        })
        for (const t of moveTargets(latest.targets)) {
          await tx.projectGoalTarget.create({ data: { goalId: goal.id, ...t } })
        }
        for (const c of latest.children) {
          const child = await tx.projectGoal.create({
            data: {
              projectId: s.projectId,
              parentId: goal.id,
              title: c.title,
              description: c.description,
              tags: c.tags,
              sortOrder: c.sortOrder,
              ownerId: c.service ? (owners.get(c.service) ?? c.ownerId) : c.ownerId,
              metricLabel: c.metricLabel,
              targetValue: c.targetValue,
              service: c.service,
              actualSource: c.actualSource,
              seriesId: s.id,
              periodStart: month.start,
              periodEnd: month.end,
              targetDate: month.end,
            },
            select: { id: true },
          })
          await tx.projectGoalEvent.create({
            data: {
              goalId: child.id,
              type: "CREATED",
              toStatus: "NOT_STARTED",
              reason: `Repeated from ${from}`,
            },
          })
          for (const t of moveTargets(c.targets)) {
            await tx.projectGoalTarget.create({ data: { goalId: child.id, ...t } })
          }
        }
        return goal.id
      })
      created.push({ projectId: s.projectId, goalId, seriesId: s.id })
      await announceEdition(goalId)
    } catch (err) {
      // Another rollover made this month first.
      if ((err as { code?: string })?.code === "P2002") continue
      throw err
    }
  }
  return created
}

/** Tell each part's owner (and the goal's owner) their number for the new month. */
async function announceEdition(goalId: string): Promise<void> {
  const goal = await db.projectGoal.findUnique({
    where: { id: goalId },
    select: {
      title: true,
      ownerId: true,
      metricLabel: true,
      targetValue: true,
      periodStart: true,
      project: { select: { id: true, slug: true, name: true } },
      children: { select: { ownerId: true, title: true, targetValue: true } },
    },
  })
  if (!goal) return
  const month = goal.periodStart ? formatMonth(ymd(goal.periodStart)) : ""
  const link = projectHref(goal.project, "goals")
  const fmt = (n: number | null) => (n === null ? "" : n.toLocaleString("en-IN"))
  const told = new Set<string>()
  for (const c of goal.children) {
    if (!c.ownerId || told.has(c.ownerId)) continue
    told.add(c.ownerId)
    await createNotification({
      employeeId: c.ownerId,
      title: `${month}: your ${c.title} target`,
      message:
        `${goal.project.name} - "${goal.title}": ${fmt(c.targetValue)} ${goal.metricLabel ?? ""} this month for ${c.title}.`.trim(),
      type: "info",
      link,
    })
  }
  if (goal.ownerId && !told.has(goal.ownerId)) {
    await createNotification({
      employeeId: goal.ownerId,
      title: `${month}: "${goal.title}" started`,
      message:
        `${goal.project.name}: ${fmt(goal.targetValue)} ${goal.metricLabel ?? ""} this month.`.trim(),
      type: "info",
      link,
    })
  }
}

/** Stop (or restart) a repeating goal. The months so far stay; restarting adds this month if missing. */
export async function setGoalSeriesStopped(
  projectId: string,
  seriesId: string,
  stopped: boolean,
  actorId: string | null,
): Promise<void> {
  const series = await db.projectGoalSeries.findFirst({
    where: { id: seriesId, projectId },
    select: { id: true, stoppedAt: true },
  })
  if (!series) throw new NotFoundError("Recurring goal")
  if (Boolean(series.stoppedAt) === stopped) return
  const latest = await db.projectGoal.findFirst({
    where: { seriesId, parentId: null },
    orderBy: { periodStart: "desc" },
    select: { id: true, periodStart: true },
  })
  await db.$transaction(async (tx) => {
    await tx.projectGoalSeries.update({
      where: { id: seriesId },
      data: { stoppedAt: stopped ? new Date() : null },
    })
    if (latest) {
      await tx.projectGoalEvent.create({
        data: {
          goalId: latest.id,
          type: "EDITED",
          reason: stopped
            ? `Stopped repeating - no new months after ${formatMonth(ymd(latest.periodStart))}`
            : "Repeating every month again",
          actorId,
        },
      })
    }
  })
  if (!stopped) await ensureGoalEditions({ projectId })
}

export interface SeriesMonth {
  month: string
  goalId: string
  targetValue: number | null
  actualValue: number | null
  progress: number
  status: string
  parts: {
    service: string | null
    title: string
    targetValue: number | null
    actualValue: number | null
  }[]
}

export interface SeriesHistory {
  id: string
  title: string
  metricLabel: string | null
  stoppedAt: string | null
  months: SeriesMonth[]
}

/** Every month of a repeating goal - target against reached, and each service's part - for growth. */
export async function getSeriesHistory(
  projectId: string,
  seriesId: string,
): Promise<SeriesHistory> {
  const series = await db.projectGoalSeries.findFirst({
    where: { id: seriesId, projectId },
    select: { id: true, title: true, stoppedAt: true },
  })
  if (!series) throw new NotFoundError("Recurring goal")
  const rows = await db.projectGoal.findMany({
    where: { seriesId, isActive: true },
    orderBy: GOAL_ORDER,
    select: GOAL_SELECT_LITE,
  })
  const summary = summariseGoalRows(
    rows,
    todayUtc(),
    undefined,
    await loadMetaActuals(projectId, rows),
  )
  const months = summary.goals
    .filter((g) => g.periodStart)
    .sort((a, b) => a.periodStart!.localeCompare(b.periodStart!))
    .map((g) => ({
      month: g.periodStart!.slice(0, 7),
      goalId: g.id,
      targetValue: g.targetValue,
      actualValue: g.actualValue,
      progress: g.progress,
      status: g.status,
      parts: g.children.map((c) => ({
        service: c.service,
        title: c.title,
        targetValue: c.targetValue,
        actualValue: c.actualValue,
      })),
    }))
  return {
    id: series.id,
    title: series.title,
    metricLabel: months.length
      ? (rows.find((r) => r.id === months.at(-1)!.goalId)?.metricLabel ?? null)
      : null,
    stoppedAt: series.stoppedAt?.toISOString() ?? null,
    months,
  }
}

/**
 * A service changed hands: its open parts of goals (this month on, and one-time ones not finished)
 * move to the new owner. Past months keep who was accountable then.
 */
export async function syncServiceGoalOwners(
  projectId: string,
  service: string,
  ownerId: string | null,
): Promise<void> {
  const month = planMonthPeriod()
  await db.projectGoal.updateMany({
    where: {
      projectId,
      service,
      status: { notIn: ["DONE", "DISCARDED"] },
      OR: [{ periodEnd: null }, { periodEnd: { gte: month.start } }],
    },
    data: { ownerId },
  })
}

/**
 * Monday: owners of numbered goals they fill in by hand, with nothing entered for a week, get one
 * reminder each listing them. Claimed per day, so it sends once.
 */
export async function runGoalResultReminders(
  now: Date = new Date(),
): Promise<{ sent: number; skipped: boolean }> {
  const today = startOfDayUTC(now)
  if (today.getUTCDay() !== 1) return { sent: 0, skipped: true }
  try {
    await db.digestRun.create({ data: { kind: "goal-results", periodStart: today } })
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return { sent: 0, skipped: true }
    throw err
  }

  const month = planMonthPeriod(now)
  const weekAgo = addDays(today, -7)
  const goals = await db.projectGoal.findMany({
    where: {
      isActive: true,
      targetValue: { not: null },
      actualSource: "MANUAL",
      ownerId: { not: null },
      status: { notIn: ["DONE", "DISCARDED"] },
      // Numbers go on the parts; a goal that adds its parts up is never chased itself.
      children: { none: { isActive: true, targetValue: { not: null } } },
      project: { isArchived: false },
      // This month's editions (last month's is still open on the 1st week) and live one-time goals.
      OR: [
        { periodStart: month.start },
        { periodEnd: { gte: weekAgo }, periodStart: { lt: month.start } },
        { seriesId: null, OR: [{ targetDate: null }, { targetDate: { gte: weekAgo } }] },
      ],
    },
    select: {
      title: true,
      ownerId: true,
      project: { select: { id: true, slug: true, name: true } },
      parent: { select: { title: true } },
      results: { where: { createdAt: { gte: weekAgo } }, select: { id: true }, take: 1 },
    },
  })

  const byOwner = new Map<string, { lines: string[]; link: string }>()
  for (const g of goals) {
    if (g.results.length > 0 || !g.ownerId) continue
    const line = `${g.project.name}: ${g.parent ? `${g.parent.title} - ${g.title}` : g.title}`
    const entry = byOwner.get(g.ownerId)
    if (entry) entry.lines.push(line)
    else byOwner.set(g.ownerId, { lines: [line], link: projectHref(g.project, "goals") })
  }
  for (const [ownerId, { lines, link }] of byOwner) {
    await createNotification({
      employeeId: ownerId,
      title: "Enter last week's results",
      message:
        lines.length === 1
          ? `${lines[0]} has no numbers for the past week.`
          : `${lines.length} goals have no numbers for the past week: ${lines.slice(0, 3).join("; ")}${lines.length > 3 ? "…" : ""}`,
      type: "warning",
      link,
    })
  }
  return { sent: byOwner.size, skipped: false }
}
