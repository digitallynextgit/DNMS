import "server-only"

import type { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { PERMISSIONS } from "@/lib/constants"
import { hasAnyPermission, hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { addDays, startOfDayUTC, toDateOnly, todayUtc, workingDaysBetween } from "@/lib/dates"
import { requirePermission, requireSession, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import { SCORECARD_DAYS, SCORE_KEYS, isRecommendation, isScore } from "../lib/scorecard"

// 15-day new-joinee scorecard. Only raw 1-5 scores are stored; averages come from lib/scorecard.ts.

const PERSON = { select: { id: true, firstName: true, lastName: true } } as const

const SCORECARD_SELECT = {
  id: true,
  employeeId: true,
  hrSpocId: true,
  managerObservations: true,
  hrObservations: true,
  recommendation: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNo: true,
      profilePhoto: true,
      dateOfJoining: true,
      designation: { select: { title: true } },
      manager: PERSON,
    },
  },
  hrSpoc: PERSON,
  days: {
    orderBy: { dayNumber: "asc" },
    select: {
      dayNumber: true,
      date: true,
      mgrJobRole: true,
      mgrCommunication: true,
      mgrLearning: true,
      hrDiscipline: true,
      hrCulture: true,
      hrLearning: true,
    },
  },
} satisfies Prisma.JoineeScorecardSelect

const NOT_FOUND = "Scorecard not found"

/** First `count` working days from `start`; floating holidays count as working days. */
async function firstWorkingDays(start: Date, count: number): Promise<Date[]> {
  const from = startOfDayUTC(start)
  // 3 calendar days per working day leaves ample room for weekends and holidays.
  const to = addDays(from, count * 3)
  const holidays = await db.holiday.findMany({
    where: { isOptional: false, date: { gte: from, lte: to } },
    select: { date: true },
  })
  const keys = new Set(holidays.map((h) => toDateOnly(h.date)))
  return workingDaysBetween(from, to, keys).slice(0, count)
}

/** No permission check (callers decide). Returns the existing id rather than throwing. */
export async function startScorecardFor(
  employeeId: string,
  opts: { actorId?: string | null; hrSpocId?: string | null } = {},
): Promise<{ id: string; created: boolean } | null> {
  const existing = await db.joineeScorecard.findUnique({
    where: { employeeId },
    select: { id: true },
  })
  if (existing) return { id: existing.id, created: false }

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, dateOfJoining: true },
  })
  if (!employee) return null

  const dates = await firstWorkingDays(employee.dateOfJoining ?? todayUtc(), SCORECARD_DAYS)
  // Top-level createMany, not a nested create: the tenant guard only stamps top-level writes.
  const id = await db.$transaction(async (tx) => {
    const card = await tx.joineeScorecard.create({
      data: {
        employeeId,
        hrSpocId: opts.hrSpocId ?? null,
        createdById: opts.actorId ?? null,
      },
      select: { id: true },
    })
    await tx.joineeScorecardDay.createMany({
      data: dates.map((date, i) => ({ scorecardId: card.id, dayNumber: i + 1, date })),
    })
    return card.id
  })
  return { id, created: true }
}

function rightsFor(
  session: Awaited<ReturnType<typeof requireSession>>,
  employeeId: string,
): { canRead: boolean; canEdit: boolean } {
  const canEdit = hasPermission(session, PERMISSIONS.ONBOARDING_WRITE)
  const canRead =
    canEdit ||
    session.user.id === employeeId ||
    hasAnyPermission(session, [PERMISSIONS.ONBOARDING_READ])
  return { canRead, canEdit }
}

export async function getScorecard(employeeId: string): Promise<
  ActionResult<{
    scorecard: Prisma.JoineeScorecardGetPayload<{ select: typeof SCORECARD_SELECT }> | null
    canEdit: boolean
  }>
> {
  return runAction(async () => {
    const session = await requireSession()
    if (!employeeId) return fail("employeeId is required")
    const { canRead, canEdit } = rightsFor(session, employeeId)
    if (!canRead) return fail("You can only view your own scorecard", undefined, 403)
    const scorecard = await db.joineeScorecard.findUnique({
      where: { employeeId },
      select: SCORECARD_SELECT,
    })
    return ok({ scorecard, canEdit })
  })
}

/** For employees who joined before scorecards existed. */
export async function createScorecard(input: {
  employeeId?: string
  hrSpocId?: string | null
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ONBOARDING_WRITE)
    if (!input.employeeId) return fail("employeeId is required")
    const started = await startScorecardFor(input.employeeId, {
      actorId: session.user.id,
      hrSpocId: input.hrSpocId ?? null,
    })
    if (!started) return fail("Employee not found", undefined, 404)
    if (!started.created) return fail("This employee already has a scorecard", undefined, 409)
    await createAuditLog(session, {
      action: "joinee_scorecard.create",
      module: "onboarding",
      entityType: "JoineeScorecard",
      entityId: started.id,
      changes: { employeeId: input.employeeId },
      ...(await getAuditMeta()),
    })
    return ok({ id: started.id })
  })
}

export async function updateScorecard(
  id: string,
  input: {
    hrSpocId?: string | null
    managerObservations?: string | null
    hrObservations?: string | null
    recommendation?: string | null
  },
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ONBOARDING_WRITE)
    const data: Prisma.JoineeScorecardUncheckedUpdateInput = {}
    if (input.hrSpocId !== undefined) data.hrSpocId = input.hrSpocId || null
    const text = (v: string | null) => (typeof v === "string" && v.trim() ? v.trim() : null)
    if (input.managerObservations !== undefined)
      data.managerObservations = text(input.managerObservations)
    if (input.hrObservations !== undefined) data.hrObservations = text(input.hrObservations)
    if (input.recommendation !== undefined) {
      if (input.recommendation !== null && !isRecommendation(input.recommendation))
        return fail("Unknown recommendation")
      data.recommendation = input.recommendation
    }
    if (Object.keys(data).length === 0) return fail("Nothing to update")

    const found = await db.joineeScorecard.findUnique({ where: { id }, select: { id: true } })
    if (!found) return fail(NOT_FOUND, undefined, 404)
    await db.joineeScorecard.update({ where: { id }, data })
    if (input.recommendation !== undefined) {
      await createAuditLog(session, {
        action: "joinee_scorecard.recommendation",
        module: "onboarding",
        entityType: "JoineeScorecard",
        entityId: id,
        changes: { recommendation: input.recommendation },
        ...(await getAuditMeta()),
      })
    }
    return ok({ id })
  })
}

/** Set (or clear, with null) any of one day's six scores. */
export async function updateScorecardDay(
  id: string,
  dayNumber: number,
  scores: Record<string, unknown>,
): Promise<ActionResult<{ dayNumber: number }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ONBOARDING_WRITE)
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > SCORECARD_DAYS)
      return fail(`Day must be 1-${SCORECARD_DAYS}`)

    const data: Record<string, number | null> = {}
    for (const key of SCORE_KEYS) {
      if (!(key in scores)) continue
      const v = scores[key]
      if (v !== null && !isScore(v)) return fail("Scores are whole numbers from 1 to 5")
      data[key] = v as number | null
    }
    if (Object.keys(data).length === 0) return fail("Nothing to update")

    const res = await db.joineeScorecardDay.updateMany({
      where: { scorecardId: id, dayNumber },
      data,
    })
    if (res.count === 0) return fail(NOT_FOUND, undefined, 404)
    return ok({ dayNumber })
  })
}

export async function deleteScorecard(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ONBOARDING_WRITE)
    const res = await db.joineeScorecard.deleteMany({ where: { id } })
    if (res.count === 0) return fail(NOT_FOUND, undefined, 404)
    await createAuditLog(session, {
      action: "joinee_scorecard.delete",
      module: "onboarding",
      entityType: "JoineeScorecard",
      entityId: id,
      ...(await getAuditMeta()),
    })
    return ok({ id })
  })
}
