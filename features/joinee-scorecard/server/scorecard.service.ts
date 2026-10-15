import "server-only"

import type { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { PERMISSIONS } from "@/lib/constants"
import { hasAnyPermission, hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { addDays, startOfDayUTC, toDateOnly, todayUtc, workingDaysBetween } from "@/lib/dates"
import { requirePermission, requireSession, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import {
  SCORECARD_CRITERIA,
  SCORECARD_DAYS,
  criterionKeyFor,
  isLegacyScoreKey,
  isRecommendation,
  isScore,
  isScorecardSide,
  type DayScores,
  type LegacyScoreKey,
  type ScorecardCriterion,
  type ScorecardSide,
} from "../lib/scorecard"
import type { ScorecardCriterionRow } from "../types"

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
      scores: true,
    },
  },
} satisfies Prisma.JoineeScorecardSelect

type ScorecardRow = Prisma.JoineeScorecardGetPayload<{ select: typeof SCORECARD_SELECT }>
type DayRow = ScorecardRow["days"][number]

const NOT_FOUND = "Scorecard not found"
const MAX_CRITERIA = 30
const MAX_LABEL = 60

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

/** The company's criteria, hidden ones included; the built-in six until HR first edits them. */
export async function listCriteriaRows(): Promise<ScorecardCriterionRow[]> {
  const rows = await db.joineeScorecardCriterion.findMany({ orderBy: { displayOrder: "asc" } })
  if (rows.length > 0) {
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      side: (isScorecardSide(r.side) ? r.side : "HR") as ScorecardSide,
      label: r.label,
      displayOrder: r.displayOrder,
      isActive: r.isActive,
    }))
  }
  return SCORECARD_CRITERIA.map((c, i) => ({ id: null, ...c, displayOrder: i, isActive: true }))
}

const activeCriteria = (rows: ScorecardCriterionRow[]): ScorecardCriterion[] =>
  rows.filter((r) => r.isActive).map(({ key, side, label }) => ({ key, side, label }))

function jsonScores(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** One day's scores for the given keys: the built-in six from their columns, the rest from JSON. */
function dayScores(row: DayRow, keys: string[]): DayScores {
  const json = jsonScores(row.scores)
  const out: DayScores = {}
  for (const key of keys) {
    const v = isLegacyScoreKey(key) ? row[key as LegacyScoreKey] : json[key]
    out[key] = isScore(v) ? v : null
  }
  return out
}

export async function getScorecardCriteria(): Promise<
  ActionResult<{ criteria: ScorecardCriterionRow[] }>
> {
  return runAction(async () => {
    await requireSession()
    return ok({ criteria: await listCriteriaRows() })
  })
}

export async function getScorecard(employeeId: string): Promise<
  ActionResult<{
    scorecard:
      | (Omit<ScorecardRow, "days"> & {
          days: { dayNumber: number; date: Date; scores: DayScores }[]
        })
      | null
    criteria: ScorecardCriterion[]
    canEdit: boolean
    canEditCriteria: boolean
  }>
> {
  return runAction(async () => {
    const session = await requireSession()
    if (!employeeId) return fail("employeeId is required")
    const { canRead, canEdit } = rightsFor(session, employeeId)
    if (!canRead) return fail("You can only view your own scorecard", undefined, 403)
    const [raw, rows] = await Promise.all([
      db.joineeScorecard.findUnique({ where: { employeeId }, select: SCORECARD_SELECT }),
      listCriteriaRows(),
    ])
    const criteria = activeCriteria(rows)
    const keys = criteria.map((c) => c.key)
    const scorecard = raw
      ? {
          ...raw,
          days: raw.days.map((d) => ({
            dayNumber: d.dayNumber,
            date: d.date,
            scores: dayScores(d, keys),
          })),
        }
      : null
    return ok({ scorecard, criteria, canEdit, canEditCriteria: canEdit })
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

/** Set (or clear, with null) any of one day's scores, by criterion key. */
export async function updateScorecardDay(
  id: string,
  dayNumber: number,
  scores: Record<string, unknown>,
): Promise<ActionResult<{ dayNumber: number }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ONBOARDING_WRITE)
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > SCORECARD_DAYS)
      return fail(`Day must be 1-${SCORECARD_DAYS}`)

    const allowed = new Set((await listCriteriaRows()).map((r) => r.key))
    const legacy: Partial<Record<LegacyScoreKey, number | null>> = {}
    const custom: Record<string, number | null> = {}
    for (const [key, v] of Object.entries(scores)) {
      if (!allowed.has(key)) continue
      if (v !== null && !isScore(v)) return fail("Scores are whole numbers from 1 to 5")
      if (isLegacyScoreKey(key)) legacy[key] = v as number | null
      else custom[key] = v as number | null
    }
    if (Object.keys(legacy).length + Object.keys(custom).length === 0)
      return fail("Nothing to update")

    const day = await db.joineeScorecardDay.findFirst({
      where: { scorecardId: id, dayNumber },
      select: { id: true, scores: true },
    })
    if (!day) return fail(NOT_FOUND, undefined, 404)

    const next = { ...jsonScores(day.scores) }
    for (const [key, v] of Object.entries(custom)) {
      if (v === null) delete next[key]
      else next[key] = v
    }
    await db.joineeScorecardDay.update({
      where: { id: day.id },
      data: {
        ...legacy,
        ...(Object.keys(custom).length > 0 ? { scores: next as Prisma.InputJsonValue } : {}),
      },
    })
    return ok({ dayNumber })
  })
}

/** HR's edit of the criteria list: rename, reorder, hide, add. Rows left out are hidden, never
 *  deleted, so the scores already given keep their meaning. */
export async function updateScorecardCriteria(input: {
  items?: unknown
}): Promise<ActionResult<{ criteria: ScorecardCriterionRow[] }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ONBOARDING_WRITE)
    const raw = Array.isArray(input.items) ? input.items : null
    if (!raw || raw.length === 0) return fail("Send the criteria list")
    if (raw.length > MAX_CRITERIA) return fail(`At most ${MAX_CRITERIA} criteria`)

    const items: { key: string | null; side: ScorecardSide; label: string; isActive: boolean }[] =
      []
    for (const it of raw) {
      const o = (it ?? {}) as Record<string, unknown>
      const label = typeof o.label === "string" ? o.label.trim() : ""
      if (!label) return fail("Every criterion needs a name")
      if (label.length > MAX_LABEL) return fail(`Names are at most ${MAX_LABEL} characters`)
      if (!isScorecardSide(o.side)) return fail("Each criterion belongs to Manager or HR")
      items.push({
        key: typeof o.key === "string" && o.key.trim() ? o.key.trim() : null,
        side: o.side,
        label,
        isActive: o.isActive !== false,
      })
    }
    for (const side of ["MANAGER", "HR"] as const) {
      if (!items.some((i) => i.side === side && i.isActive))
        return fail(`Keep at least one ${side === "HR" ? "HR" : "Manager"} criterion`)
    }

    await db.$transaction(async (tx) => {
      // First edit: seed the built-in six so their scores (own columns) keep their keys.
      if ((await tx.joineeScorecardCriterion.count()) === 0) {
        await tx.joineeScorecardCriterion.createMany({
          data: SCORECARD_CRITERIA.map((c, i) => ({
            key: c.key,
            side: c.side,
            label: c.label,
            displayOrder: i,
            isActive: true,
          })),
        })
      }
      const known = new Set(
        (await tx.joineeScorecardCriterion.findMany({ select: { key: true } })).map((r) => r.key),
      )
      const kept = new Set<string>()
      for (const [i, item] of items.entries()) {
        if (item.key && known.has(item.key)) {
          await tx.joineeScorecardCriterion.updateMany({
            where: { key: item.key },
            data: { label: item.label, side: item.side, displayOrder: i, isActive: item.isActive },
          })
          kept.add(item.key)
          continue
        }
        const base = criterionKeyFor(item.label)
        let key = base
        for (let n = 2; known.has(key) || kept.has(key); n++) key = `${base}-${n}`
        await tx.joineeScorecardCriterion.create({
          data: {
            key,
            side: item.side,
            label: item.label,
            displayOrder: i,
            isActive: item.isActive,
          },
        })
        known.add(key)
        kept.add(key)
      }
      await tx.joineeScorecardCriterion.updateMany({
        where: { key: { notIn: [...kept] } },
        data: { isActive: false },
      })
    })

    await createAuditLog(session, {
      action: "joinee_scorecard.criteria",
      module: "onboarding",
      entityType: "JoineeScorecardCriterion",
      entityId: "company",
      changes: {
        criteria: items.map((i) => `${i.side}: ${i.label}${i.isActive ? "" : " (hidden)"}`),
      },
      ...(await getAuditMeta()),
    })
    return ok({ criteria: await listCriteriaRows() })
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
