import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

import { db } from "@/server/db"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { canManageProject } from "./project-access"
import { logActivity } from "./activity"
import { cleanType, MAX_QUANTITY, MAX_TYPE_LENGTH } from "../lib/deliverable-types"
import { normaliseType } from "../lib/goal-derivation"

// =============================================================================
// What a goal actually PROMISED: "20 reels, September".
//
// A goal used to be measurable only through the work planned under it, which
// answers "did we do the things we listed" and not "did we deliver what we
// said we would". Those two come apart the moment a task list is optimistic or
// a client asks for a number. A target is the second question, written down
// before the month starts, so the goal can grade itself against it.
//
// ── FREE TEXT, SNAPPED TO THE PROJECT'S OWN SPELLING ─────────────────────────
// The type is matched against ProjectDeliverable.type, which is free text with
// per-team suggestions (see lib/deliverable-types.ts). A target typed "reel"
// on a project that already logs "Reel" is STORED as "Reel", so the goal board
// and the deliverables tab name the same thing the same way. Matching itself
// is case-folded either way - the snap is about how it reads.
//
// ── PERIODS MAY NOT OVERLAP ──────────────────────────────────────────────────
// Two targets for the same type over overlapping dates make "made" ambiguous:
// one delivery would count towards both, and the goal would report progress it
// did not make. So per goal and per type: dated periods must not overlap, and
// there is at most ONE open-ended target - the standing commitment, "50 pages
// eventually" - which is exempt from the overlap rule because it measures a
// different thing from the monthly ones beside it.
//
// ── MANAGE-ONLY, LIKE THE GOAL ITSELF ────────────────────────────────────────
// A team manager may break a goal into work; that is theirs to plan. Changing
// what was PROMISED is the account manager's call, so this mirrors goal CRUD
// rather than the task-staffing boundary.
// =============================================================================

const TARGET_SELECT = {
  id: true,
  deliverableType: true,
  quantity: true,
  periodStart: true,
  periodEnd: true,
} satisfies Prisma.ProjectGoalTargetSelect

export type GoalTargetRow = Prisma.ProjectGoalTargetGetPayload<{ select: typeof TARGET_SELECT }>

export interface GoalTargetInput {
  deliverableType: string
  quantity: number
  /** yyyy-MM-dd, inclusive. Null on both ends = counts everything ever. */
  periodStart?: string | null
  periodEnd?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function parseDay(value: string | null | undefined, label: string): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`The ${label} must look like YYYY-MM-DD.`)
  }
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new ValidationError(`That ${label} is not a real date.`)
  return d
}

function parseQuantity(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isInteger(n) || n < 1) {
    throw new ValidationError("A target needs a whole number of things, at least one.")
  }
  if (n > MAX_QUANTITY) throw new ValidationError(`A target cannot exceed ${MAX_QUANTITY}.`)
  return n
}

/**
 * Snap a typed type onto the casing the project already uses, if any.
 *
 * Deliberately a local copy of the rule deliverables.service.ts applies when a
 * deliverable is logged: both write into the same free-text vocabulary, and a
 * target stored as "reel" beside rows that say "Reel" would still MATCH (the
 * tally is case-folded) but would read as a second type on screen.
 */
async function canonicalType(projectId: string, raw: string): Promise<string> {
  const cleaned = cleanType(raw ?? "")
  if (!cleaned) {
    throw new ValidationError("Say what this target counts - reels, pages, banners.")
  }
  if (cleaned.length > MAX_TYPE_LENGTH) {
    throw new ValidationError(`Keep the type under ${MAX_TYPE_LENGTH} characters.`)
  }
  const existing = await db.projectDeliverable.findFirst({
    where: { projectId, type: { equals: cleaned, mode: "insensitive" } },
    select: { type: true },
    orderBy: { createdAt: "asc" },
  })
  return existing?.type ?? cleaned
}

/** Two periods clash when neither ends before the other begins. */
function overlaps(
  a: { start: Date | null; end: Date | null },
  b: { start: Date | null; end: Date | null },
): boolean {
  const aStart = a.start ? a.start.getTime() : -Infinity
  const aEnd = a.end ? a.end.getTime() : Infinity
  const bStart = b.start ? b.start.getTime() : -Infinity
  const bEnd = b.end ? b.end.getTime() : Infinity
  return aStart <= bEnd && bStart <= aEnd
}

// ─────────────────────────────────────────────────────────────────────────────
// How a target reads in the history
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

const day = (d: Date): string => `${MONTHS[d.getUTCMonth()]!} ${d.getUTCDate()}`

function fmtPeriod(start: Date | null, end: Date | null): string | null {
  if (!start && !end) return null
  if (start && end) {
    const sameMonth =
      start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()
    return sameMonth ? `${day(start)}–${end.getUTCDate()}` : `${day(start)} – ${day(end)}`
  }
  return start ? `from ${day(start)}` : `until ${day(end!)}`
}

/** "20 x Reel (Sep 1-30)" - what a person would say out loud. */
function describe(t: {
  deliverableType: string
  quantity: number
  periodStart: Date | null
  periodEnd: Date | null
}): string {
  const period = fmtPeriod(t.periodStart, t.periodEnd)
  return `${t.quantity} × ${t.deliverableType}${period ? ` (${period})` : ""}`
}

/**
 * Refuse a target that would make "made" ambiguous.
 *
 * Compared in memory rather than with a clever WHERE: a goal carries a handful
 * of targets, and the type match runs through the same case-folding the tally
 * uses, which a SQL comparison would have to restate and could drift from.
 */
async function assertNoClash(
  goalId: string,
  typeKey: string,
  period: { start: Date | null; end: Date | null },
  exceptId?: string,
): Promise<void> {
  const siblings = await db.projectGoalTarget.findMany({
    where: { goalId, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: TARGET_SELECT,
  })
  const sameType = siblings.filter((s) => normaliseType(s.deliverableType) === typeKey)

  if (!period.start && !period.end) {
    if (sameType.some((s) => !s.periodStart && !s.periodEnd)) {
      throw new ValidationError(
        "This goal already has an ongoing target for that type. Edit it, or give this one a period.",
      )
    }
    return
  }

  const clash = sameType
    .filter((s) => s.periodStart || s.periodEnd)
    .find((s) => overlaps(period, { start: s.periodStart, end: s.periodEnd }))
  if (clash) {
    throw new ValidationError(
      `That period overlaps an existing target for the same type (${describe(clash)}). One delivery cannot count towards two targets.`,
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared by the three writes
// ─────────────────────────────────────────────────────────────────────────────

/** The goal, once we know the caller is allowed to touch this project's goals. */
async function loadGoal(session: Session, projectId: string, goalId: string) {
  if (!(await canManageProject(session, projectId))) {
    throw new ForbiddenError("Only project managers can set what a goal promises.")
  }
  const goal = await db.projectGoal.findFirst({
    where: { id: goalId, projectId },
    select: { id: true, title: true },
  })
  if (!goal) throw new NotFoundError("Goal")
  return goal
}

/**
 * The project feed entry. The goal's own append-only history is written inside
 * each transaction beside the row it describes; this is the second, coarser
 * trail the project activity list reads, and it is best-effort by design
 * (logActivity swallows its own failures rather than failing the write).
 */
async function record(
  projectId: string,
  goal: { id: string; title: string },
  actorId: string,
  change: string,
  meta: Record<string, unknown>,
): Promise<void> {
  await logActivity({
    projectId,
    actorId,
    type: "GOAL_TARGET_CHANGED",
    entityType: "GOAL",
    entityId: goal.id,
    meta: { goalTitle: goal.title, change, ...meta },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

export async function addGoalTarget(
  session: Session,
  projectId: string,
  goalId: string,
  input: GoalTargetInput,
): Promise<GoalTargetRow> {
  const goal = await loadGoal(session, projectId, goalId)

  const deliverableType = await canonicalType(projectId, input.deliverableType)
  const quantity = parseQuantity(input.quantity)
  const periodStart = parseDay(input.periodStart, "start date")
  const periodEnd = parseDay(input.periodEnd, "end date")
  if (periodStart && periodEnd && periodStart > periodEnd) {
    throw new ValidationError("A target's period cannot end before it starts.")
  }
  await assertNoClash(goalId, normaliseType(deliverableType), {
    start: periodStart,
    end: periodEnd,
  })

  const actorId = session.user.id
  // The target and the line of history explaining it land together, or neither
  // does - the same rule every other goal write follows.
  const target = await db.$transaction(async (tx) => {
    const created = await tx.projectGoalTarget.create({
      data: { goalId, deliverableType, quantity, periodStart, periodEnd, createdById: actorId },
      select: TARGET_SELECT,
    })
    await tx.projectGoalEvent.create({
      data: { goalId, type: "EDITED", reason: `Target added: ${describe(created)}`, actorId },
    })
    return created
  })

  await record(projectId, goal, actorId, `Target added: ${describe(target)}`, {
    targetId: target.id,
    deliverableType: target.deliverableType,
    quantity: target.quantity,
  })
  return target
}

export async function updateGoalTarget(
  session: Session,
  projectId: string,
  goalId: string,
  targetId: string,
  input: Partial<GoalTargetInput>,
): Promise<GoalTargetRow> {
  const goal = await loadGoal(session, projectId, goalId)

  const existing = await db.projectGoalTarget.findFirst({
    where: { id: targetId, goalId },
    select: TARGET_SELECT,
  })
  if (!existing) throw new NotFoundError("Target")

  // Every field is optional on a PATCH, so the candidate starts as what is
  // stored and only what was sent moves. `undefined` leaves a period alone;
  // `null` clears it, which is the only way to make a target open-ended again.
  const deliverableType =
    input.deliverableType === undefined
      ? existing.deliverableType
      : await canonicalType(projectId, input.deliverableType)
  const quantity = input.quantity === undefined ? existing.quantity : parseQuantity(input.quantity)
  const periodStart =
    input.periodStart === undefined
      ? existing.periodStart
      : parseDay(input.periodStart, "start date")
  const periodEnd =
    input.periodEnd === undefined ? existing.periodEnd : parseDay(input.periodEnd, "end date")
  if (periodStart && periodEnd && periodStart > periodEnd) {
    throw new ValidationError("A target's period cannot end before it starts.")
  }
  await assertNoClash(
    goalId,
    normaliseType(deliverableType),
    { start: periodStart, end: periodEnd },
    targetId,
  )

  const before = describe(existing)
  const actorId = session.user.id
  const target = await db.$transaction(async (tx) => {
    const updated = await tx.projectGoalTarget.update({
      where: { id: targetId },
      data: { deliverableType, quantity, periodStart, periodEnd },
      select: TARGET_SELECT,
    })
    await tx.projectGoalEvent.create({
      data: {
        goalId,
        type: "EDITED",
        reason: `Target changed: ${before} → ${describe(updated)}`,
        actorId,
      },
    })
    return updated
  })

  await record(projectId, goal, actorId, `Target changed: ${before} → ${describe(target)}`, {
    targetId,
    deliverableType: target.deliverableType,
    quantity: target.quantity,
  })
  return target
}

export async function removeGoalTarget(
  session: Session,
  projectId: string,
  goalId: string,
  targetId: string,
): Promise<{ id: string }> {
  const goal = await loadGoal(session, projectId, goalId)

  const existing = await db.projectGoalTarget.findFirst({
    where: { id: targetId, goalId },
    select: TARGET_SELECT,
  })
  if (!existing) throw new NotFoundError("Target")

  // What it said stays in the history even though the row does not: "we
  // dropped the September reels commitment" is the part worth keeping.
  const gone = describe(existing)
  const actorId = session.user.id
  await db.$transaction(async (tx) => {
    await tx.projectGoalTarget.delete({ where: { id: targetId } })
    await tx.projectGoalEvent.create({
      data: { goalId, type: "EDITED", reason: `Target removed: ${gone}`, actorId },
    })
  })

  await record(projectId, goal, actorId, `Target removed: ${gone}`, {
    targetId,
    deliverableType: existing.deliverableType,
    quantity: existing.quantity,
  })
  return { id: targetId }
}
