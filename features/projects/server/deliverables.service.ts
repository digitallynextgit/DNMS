import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db, type DbTransaction } from "@/server/db"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { latestCalendarDay, todayUtc } from "@/lib/dates"
import { canAccessProject, canManageProject } from "./project-access"
import { logActivity } from "./activity"
import { dedupeLinks, isSafeHttpUrl } from "../lib/task-links"
import { MAX_LINKS, MAX_QUANTITY, MAX_TYPE_LENGTH, cleanType } from "../lib/deliverable-types"
import {
  CREATABLE_STATUSES,
  allowedTransition,
  isMadeStatus,
  isOpenStatus,
  periodClosesOn,
  periodOpen,
  type DeliverableActor,
  type DeliverableStatus,
} from "../lib/deliverable-lifecycle"

// =============================================================================
// Logging what was produced.
//
// Tasks record what people are doing and hours record how long it took. This is
// the third column - what came out - and it is the one a client is paying for.
// One row per thing (or batch: `quantity`), dated by the day it was finished.
//
// ── WHO MAY LOG FOR WHOM ─────────────────────────────────────────────────────
// Anyone on a project logs their own output. Logging on somebody ELSE's behalf,
// or editing somebody else's entry, is for the people who run the work: a
// project admin, the account manager, or the manager of that person's team on
// the project. A member edits their own entries without limit - the entry is
// their claim about their own work, and the manager can always see who wrote it
// (`loggedById`) and when.
//
// ── THE TEAM IS STAMPED, NOT CHOSEN ──────────────────────────────────────────
// A person is on at most one team per project (enforced by the schema), so the
// entry takes that team at logging time. Stamped rather than looked up later so
// a team change or dissolution does not rewrite what was reported for last
// month.
//
// ── A ROW HAS A LIFE, NOT JUST A DATE ────────────────────────────────────────
// A row can also be a PROMISE (PLANNED - "three reels by Friday") that later
// becomes a thing, and once delivered it can be accepted or sent back. Which
// moves are legal, and who may make them, live in ../lib/deliverable-lifecycle
// so the buttons and this file cannot disagree. Every write here appends a
// ProjectDeliverableEvent: the ledger is what gets reported on, so how a number
// changed has to be answerable months later.
//
// ── THE PERIOD LOCK ──────────────────────────────────────────────────────────
// A member may correct their own entry for LOCK_DAYS after the day it counts
// for. After that the period has been reported on and a quiet edit rewrites a
// number somebody already sent a client - so it takes a project manager, and it
// is written to the history as LOCKED_EDIT rather than a plain EDITED.
// =============================================================================

export interface DeliverableInput {
  employeeId?: string
  type: string
  title: string
  quantity?: number
  /** PLANNED / IN_PROGRESS / DELIVERED at create; anything at update. */
  status?: DeliverableStatus
  startedOn?: string | null
  /** Required once the row is DELIVERED or beyond; defaults to today. */
  completedOn?: string | null
  /** When an owed row is owed by. Free to be in the future - that is the point. */
  dueOn?: string | null
  goalId?: string | null
  links?: string[]
  notes?: string | null
  taskId?: string | null
}

export interface StatusChangeInput {
  status: DeliverableStatus
  reason?: string | null
  completedOn?: string | null
  note?: string | null
}

/**
 * One PATCH can carry both the form's fields and a move, so it also carries the
 * two things a move can need: the `reason` a rejection or un-acceptance must
 * give, and the optional acceptance `note`.
 */
export interface DeliverableUpdateInput extends Partial<DeliverableInput> {
  reason?: string | null
  note?: string | null
}

const ymd = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null)

function parseDay(value: string | null | undefined, label: string): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${label} must look like YYYY-MM-DD.`)
  }
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new ValidationError(`${label} is not a real date.`)
  return d
}

/**
 * The upper bound for a date somebody says has already happened.
 *
 * Not plain UTC-today: a date picker is LOCAL, and after 18:30 UTC a person in
 * Kolkata (or all day in Auckland) legitimately picks a day that UTC has not
 * reached. See latestCalendarDay.
 */
function assertNotFuture(d: Date | null, label: string): void {
  if (d && d > latestCalendarDay()) {
    throw new ValidationError(`The ${label} date cannot be in the future.`)
  }
}

/**
 * Snap a typed type onto the casing the project already uses, if any.
 *
 * "reel" typed onto a project that already has "Reel" is stored as "Reel", so
 * the by-type count has one row, not two. A genuinely new type is stored as
 * typed - a team's own spelling is the right spelling.
 */
async function canonicalType(projectId: string, raw: string): Promise<string> {
  const cleaned = cleanType(raw)
  if (!cleaned)
    throw new ValidationError("Say what kind of thing this is - a video, a page, a banner.")
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

function normaliseLinks(raw: unknown): string[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) throw new ValidationError("Links must be a list.")
  const cleaned = dedupeLinks(raw.map((l) => String(l)))
  const bad = cleaned.find((l) => !isSafeHttpUrl(l))
  if (bad) throw new ValidationError(`Not a valid web link: ${bad}`)
  return cleaned.slice(0, MAX_LINKS)
}

function normaliseQuantity(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return 1
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > MAX_QUANTITY) {
    throw new ValidationError(`Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`)
  }
  return n
}

function normaliseTitle(raw: string | undefined): string {
  const t = raw?.trim()
  if (!t) throw new ValidationError("Give it a title - what was made?")
  if (t.length > 200) throw new ValidationError("Keep the title under 200 characters.")
  return t
}

/** The team this person sits on for this project, or null. */
async function teamOf(projectId: string, employeeId: string): Promise<string | null> {
  const m = await db.projectTeamMember.findUnique({
    where: { projectId_employeeId: { projectId, employeeId } },
    select: { teamId: true },
  })
  return m?.teamId ?? null
}

/** Does this person manage the team `employeeId` sits on for this project? */
async function managesTeamOf(session: Session, projectId: string, employeeId: string) {
  const team = await db.projectTeam.findFirst({
    where: {
      projectId,
      managerId: session.user.id,
      members: { some: { employeeId } },
    },
    select: { id: true },
  })
  return !!team
}

/**
 * May `session` log output on behalf of `employeeId` for this project?
 * Yourself: any member. Someone else: admin, account manager, or their team's
 * manager.
 */
export async function canLogFor(
  session: Session,
  projectId: string,
  employeeId: string,
): Promise<boolean> {
  if (employeeId === session.user.id) return canAccessProject(session, projectId)
  if (await canManageProject(session, projectId)) return true
  return managesTeamOf(session, projectId, employeeId)
}

/** May `session` change or remove this entry? */
export async function canEditDeliverable(
  session: Session,
  d: { projectId: string; employeeId: string; loggedById: string | null },
): Promise<boolean> {
  if (d.employeeId === session.user.id || d.loggedById === session.user.id) return true
  if (await canManageProject(session, d.projectId)) return true
  return managesTeamOf(session, d.projectId, d.employeeId)
}

/**
 * The caller's standing on ONE row, resolved once per request.
 *
 * Everything downstream - which transitions are legal, whether the period lock
 * applies - asks this instead of re-running the same three permission queries
 * per question.
 */
export async function resolveActor(
  session: Session,
  projectId: string,
  employeeId: string,
  loggedById?: string | null,
): Promise<DeliverableActor> {
  if (await canManageProject(session, projectId)) return "project_manager"
  if (await managesTeamOf(session, projectId, employeeId)) return "team_manager"
  if (session.user.id === employeeId || (loggedById && session.user.id === loggedById))
    return "maker"
  return "none"
}

/** The lock refusal, naming the rule and the person who can lift it. */
function lockError(completedOn: Date): ValidationError {
  return new ValidationError(
    `This entry's period closed on ${ymd(periodClosesOn(completedOn))}. Ask a project manager to change it.`,
    { code: "PERIOD_LOCKED" },
  )
}

/** A member may only touch dates whose period is still open. Managers may. */
function assertPeriodOpen(actor: DeliverableActor, dates: (Date | null)[], today: Date): void {
  if (actor === "project_manager") return
  for (const d of dates) {
    if (d && !periodOpen(d, today)) throw lockError(d)
  }
}

type Changes = Record<string, [unknown, unknown]>

const sameValue = (a: unknown, b: unknown): boolean =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => v === b[i])
    : a === b

/** Record a field that actually moved. Returns false when nothing changed. */
function noteChange(changes: Changes, field: string, before: unknown, after: unknown): boolean {
  if (sameValue(before, after)) return false
  changes[field] = [before, after]
  return true
}

const asJson = (changes: Changes): Prisma.InputJsonValue =>
  changes as unknown as Prisma.InputJsonValue

/** Turn a refusal from the lifecycle table into the right HTTP failure. */
function transitionError(why: string, reason: "actor" | "path"): Error {
  return reason === "actor"
    ? new ForbiddenError(why)
    : new ValidationError(why, { code: "BAD_TRANSITION" })
}

/** A rejection has to say why - the maker is the one who reads it. */
function requireReason(reason: string | null | undefined): string {
  const r = reason?.trim() ?? ""
  if (r.length < 3) throw new ValidationError("Say why in a few words - the maker sees this.")
  return r.slice(0, 2000)
}

interface TransitionResult {
  data: Prisma.ProjectDeliverableUncheckedUpdateInput
  changes: Changes
  /** The date the row now counts for, when the move set one. */
  completedOn: Date | null
}

/**
 * What a legal move DOES to the row, on top of the status itself.
 *
 * Redelivery is the interesting one: the row keeps its identity and its history
 * but takes the NEW completion date, because the ledger's question is "when did
 * the client get this", not "when did we first try". The overwritten date is
 * kept in the event's `changes` so the first attempt is not lost.
 */
function transitionEffects(
  existing: { status: DeliverableStatus; startedOn: Date | null; completedOn: Date | null },
  to: DeliverableStatus,
  opts: {
    actorId: string
    reason?: string | null
    completedOn?: Date | null
    note?: string | null
  },
  today: Date,
): TransitionResult {
  const data: Prisma.ProjectDeliverableUncheckedUpdateInput = { status: to }
  const changes: Changes = {}
  let completedOn: Date | null = existing.completedOn

  if (to === "IN_PROGRESS" && !existing.startedOn) {
    data.startedOn = today
    changes.startedOn = [null, ymd(today)]
  }

  if (to === "DELIVERED" && (isOpenStatus(existing.status) || existing.status === "REJECTED")) {
    completedOn = opts.completedOn ?? today
    data.completedOn = completedOn
    noteChange(changes, "completedOn", ymd(existing.completedOn), ymd(completedOn))
    if (existing.status === "REJECTED") data.revisionCount = { increment: 1 }
  }

  // Un-accept: the verdict is withdrawn, the delivery stands.
  if (to === "DELIVERED" && existing.status === "ACCEPTED") {
    data.acceptedAt = null
    data.acceptedById = null
    data.acceptanceNote = null
  }

  if (to === "ACCEPTED") {
    data.acceptedAt = new Date()
    data.acceptedById = opts.actorId
    data.acceptanceNote = opts.note?.trim() || null
  }

  return { data, changes, completedOn }
}

/** Owed work that has just been produced is no longer "nothing to log". */
async function clearOutputSkip(tx: DbTransaction, taskId: string | null): Promise<void> {
  if (!taskId) return
  await tx.projectTask.update({ where: { id: taskId }, data: { outputSkippedAt: null } })
}

async function assertGoalInProject(projectId: string, goalId: string): Promise<void> {
  const goal = await db.projectGoal.findFirst({
    where: { id: goalId, projectId },
    select: { id: true },
  })
  if (!goal) throw new ValidationError("That goal is not on this project.")
}

async function assertTaskInProject(projectId: string, taskId: string): Promise<void> {
  const task = await db.projectTask.findFirst({
    where: { id: taskId, projectId },
    select: { id: true },
  })
  if (!task) throw new NotFoundError("Task")
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createDeliverable(
  session: Session,
  projectId: string,
  input: DeliverableInput,
): Promise<{ id: string }> {
  const employeeId = input.employeeId?.trim() || session.user.id
  if (!(await canLogFor(session, projectId, employeeId))) {
    throw new ForbiddenError(
      employeeId === session.user.id
        ? "You are not on this project."
        : "Only a project admin, the account manager or their team manager can log for someone else.",
    )
  }

  const status = input.status ?? "DELIVERED"
  if (!(CREATABLE_STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError("A new entry starts as owed, in progress, or delivered.")
  }

  const actor = await resolveActor(session, projectId, employeeId)
  // Planning is a commitment made ON somebody's behalf, so it belongs to the
  // people who own the schedule, not to whoever will do the work.
  if (isOpenStatus(status) && actor !== "project_manager" && actor !== "team_manager") {
    throw new ForbiddenError("Only a project manager or the team's manager can plan work.")
  }

  const title = normaliseTitle(input.title)
  const today = todayUtc()

  const startedOn =
    parseDay(input.startedOn, "Started date") ?? (status === "IN_PROGRESS" ? today : null)
  const dueOn = parseDay(input.dueOn, "Due date")
  let completedOn = parseDay(input.completedOn, "Completed date")
  if (isMadeStatus(status)) completedOn = completedOn ?? today
  else completedOn = null

  assertNotFuture(completedOn, "completed")
  assertNotFuture(startedOn, "started")
  if (startedOn && completedOn && startedOn > completedOn) {
    throw new ValidationError("It cannot have started after it was completed.")
  }
  assertPeriodOpen(actor, [completedOn], today)

  if (input.taskId) await assertTaskInProject(projectId, input.taskId)
  if (input.goalId) await assertGoalInProject(projectId, input.goalId)

  const [type, teamId] = await Promise.all([
    canonicalType(projectId, input.type ?? ""),
    teamOf(projectId, employeeId),
  ])
  const quantity = normaliseQuantity(input.quantity)
  const taskId = input.taskId || null

  const created = await db.$transaction(async (tx) => {
    const row = await tx.projectDeliverable.create({
      data: {
        projectId,
        teamId,
        employeeId,
        loggedById: session.user.id,
        taskId,
        goalId: input.goalId || null,
        type,
        title,
        quantity,
        status,
        startedOn,
        completedOn,
        dueOn,
        links: normaliseLinks(input.links),
        notes: input.notes?.trim() || null,
      },
      select: { id: true, employee: { select: { firstName: true, lastName: true } } },
    })
    await tx.projectDeliverableEvent.create({
      data: {
        deliverableId: row.id,
        type: "CREATED",
        toStatus: status,
        actorId: session.user.id,
      },
    })
    if (status === "DELIVERED") await clearOutputSkip(tx, taskId)
    return row
  })

  await logActivity({
    projectId,
    actorId: session.user.id,
    type: "DELIVERABLE_LOGGED",
    entityType: "DELIVERABLE",
    entityId: created.id,
    meta: {
      title,
      type,
      quantity,
      status,
      employeeName: `${created.employee.firstName} ${created.employee.lastName ?? ""}`.trim(),
      completedOn: ymd(completedOn),
      dueOn: ymd(dueOn),
    },
  })

  return { id: created.id }
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

const EDIT_SELECT = {
  id: true,
  projectId: true,
  employeeId: true,
  loggedById: true,
  taskId: true,
  goalId: true,
  type: true,
  title: true,
  quantity: true,
  status: true,
  startedOn: true,
  completedOn: true,
  dueOn: true,
  links: true,
  notes: true,
} satisfies Prisma.ProjectDeliverableSelect

/**
 * Edit the entry, and optionally move it, in ONE write.
 *
 * The form submits both at once ("fix the title and mark it delivered"), so
 * splitting them into two requests would leave a half-applied row on a failure.
 * They land as one transaction and two events: what changed, and where it went.
 */
export async function updateDeliverable(
  session: Session,
  projectId: string,
  id: string,
  input: DeliverableUpdateInput,
): Promise<void> {
  const existing = await db.projectDeliverable.findFirst({
    where: { id, projectId },
    select: EDIT_SELECT,
  })
  if (!existing) throw new NotFoundError("Deliverable")
  if (!(await canEditDeliverable(session, existing))) {
    throw new ForbiddenError("You can only change your own entries, or your team's.")
  }

  const actor = await resolveActor(session, projectId, existing.employeeId, existing.loggedById)
  const today = todayUtc()

  const nextStatus =
    input.status && input.status !== existing.status ? (input.status as DeliverableStatus) : null
  let reason: string | null = null
  if (nextStatus) {
    const check = allowedTransition(existing.status, nextStatus, actor)
    if (!check.ok) throw transitionError(check.why, check.reason)
    if (check.needs.includes("reason")) reason = requireReason(input.reason)
  }

  const data: Prisma.ProjectDeliverableUncheckedUpdateInput = {}
  const changes: Changes = {}

  if (input.title !== undefined) {
    const t = normaliseTitle(input.title)
    if (noteChange(changes, "title", existing.title, t)) data.title = t
  }
  if (input.type !== undefined) {
    const t = await canonicalType(projectId, input.type)
    if (noteChange(changes, "type", existing.type, t)) data.type = t
  }
  if (input.quantity !== undefined) {
    const q = normaliseQuantity(input.quantity)
    if (noteChange(changes, "quantity", existing.quantity, q)) data.quantity = q
  }
  if (input.links !== undefined) {
    const l = normaliseLinks(input.links)
    if (noteChange(changes, "links", existing.links, l)) data.links = l
  }
  if (input.notes !== undefined) {
    const n = input.notes?.trim() || null
    if (noteChange(changes, "notes", existing.notes, n)) data.notes = n
  }

  // Dates are validated as a PAIR against whichever side is not changing.
  const completedOn =
    input.completedOn !== undefined
      ? parseDay(input.completedOn, "Completed date")
      : existing.completedOn
  const startedOn =
    input.startedOn !== undefined ? parseDay(input.startedOn, "Started date") : existing.startedOn
  const dueOn = input.dueOn !== undefined ? parseDay(input.dueOn, "Due date") : existing.dueOn

  assertNotFuture(completedOn, "completed")
  assertNotFuture(startedOn, "started")
  if (startedOn && completedOn && startedOn > completedOn) {
    throw new ValidationError("It cannot have started after it was completed.")
  }
  if (input.completedOn !== undefined) {
    if (noteChange(changes, "completedOn", ymd(existing.completedOn), ymd(completedOn))) {
      data.completedOn = completedOn
    }
  }
  if (input.startedOn !== undefined) {
    if (noteChange(changes, "startedOn", ymd(existing.startedOn), ymd(startedOn))) {
      data.startedOn = startedOn
    }
  }
  if (input.dueOn !== undefined) {
    if (noteChange(changes, "dueOn", ymd(existing.dueOn), ymd(dueOn))) data.dueOn = dueOn
  }

  if (input.taskId !== undefined) {
    if (input.taskId) await assertTaskInProject(projectId, input.taskId)
    const t = input.taskId || null
    if (noteChange(changes, "taskId", existing.taskId, t)) data.taskId = t
  }
  if (input.goalId !== undefined) {
    if (input.goalId) await assertGoalInProject(projectId, input.goalId)
    const g = input.goalId || null
    if (noteChange(changes, "goalId", existing.goalId, g)) data.goalId = g
  }

  // Reassigning the maker re-stamps the team, and needs the on-behalf right.
  if (input.employeeId !== undefined && input.employeeId !== existing.employeeId) {
    if (!(await canLogFor(session, projectId, input.employeeId))) {
      throw new ForbiddenError("You cannot move this entry to that person.")
    }
    noteChange(changes, "employeeId", existing.employeeId, input.employeeId)
    data.employeeId = input.employeeId
    data.teamId = await teamOf(projectId, input.employeeId)
  }

  const transition = nextStatus
    ? transitionEffects(
        existing,
        nextStatus,
        {
          actorId: session.user.id,
          reason,
          completedOn: input.completedOn !== undefined ? completedOn : null,
          note: input.note,
        },
        today,
      )
    : null

  const effectiveStatus = nextStatus ?? existing.status
  const finalCompletedOn = transition?.completedOn ?? completedOn
  if (isMadeStatus(effectiveStatus) && !finalCompletedOn) {
    throw new ValidationError("When was it completed?")
  }

  // The lock guards the period a row COUNTS FOR, on both sides of the edit. A
  // redelivery is exempt on the old date: the whole point of it is that the old
  // date no longer applies.
  const guarded: (Date | null)[] =
    nextStatus === "DELIVERED" && existing.status === "REJECTED"
      ? [transition?.completedOn ?? null]
      : [existing.completedOn, data.completedOn === undefined ? null : (completedOn ?? null)]
  assertPeriodOpen(actor, guarded, today)
  const lockedEdit = !periodOpen(existing.completedOn, today)

  const hasFieldEdits = Object.keys(changes).length > 0
  if (!hasFieldEdits && !transition) return

  await db.$transaction(async (tx) => {
    await tx.projectDeliverable.update({
      where: { id },
      data: { ...data, ...(transition?.data ?? {}) },
    })
    if (hasFieldEdits) {
      await tx.projectDeliverableEvent.create({
        data: {
          deliverableId: id,
          type: lockedEdit ? "LOCKED_EDIT" : "EDITED",
          changes: asJson(changes),
          actorId: session.user.id,
        },
      })
    }
    if (transition && nextStatus) {
      await tx.projectDeliverableEvent.create({
        data: {
          deliverableId: id,
          type: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: nextStatus,
          changes: Object.keys(transition.changes).length ? asJson(transition.changes) : undefined,
          reason,
          actorId: session.user.id,
        },
      })
      if (nextStatus === "DELIVERED") {
        await clearOutputSkip(tx, (data.taskId as string | null | undefined) ?? existing.taskId)
      }
    }
  })

  if (hasFieldEdits) {
    await logActivity({
      projectId,
      actorId: session.user.id,
      type: "DELIVERABLE_UPDATED",
      entityType: "DELIVERABLE",
      entityId: id,
      meta: { fields: Object.keys(changes), locked: lockedEdit },
    })
  }
  if (nextStatus) {
    await logActivity({
      projectId,
      actorId: session.user.id,
      type: "DELIVERABLE_STATUS_CHANGED",
      entityType: "DELIVERABLE",
      entityId: id,
      meta: {
        title: (data.title as string | undefined) ?? existing.title,
        from: existing.status,
        to: nextStatus,
        reason,
      },
    })
  }
}

// ─── Move ─────────────────────────────────────────────────────────────────────

/**
 * Move one row along its life: start it, deliver it, accept it, send it back.
 *
 * Separate from `updateDeliverable` because the row actions are one click each
 * and carry their own small payload (a reason, a redelivery date) rather than
 * the whole form.
 */
export async function setDeliverableStatus(
  session: Session,
  projectId: string,
  id: string,
  input: StatusChangeInput,
): Promise<void> {
  const existing = await db.projectDeliverable.findFirst({
    where: { id, projectId },
    select: {
      id: true,
      projectId: true,
      employeeId: true,
      loggedById: true,
      taskId: true,
      title: true,
      status: true,
      startedOn: true,
      completedOn: true,
    },
  })
  if (!existing) throw new NotFoundError("Deliverable")

  const to = input.status
  const actor = await resolveActor(session, projectId, existing.employeeId, existing.loggedById)
  const check = allowedTransition(existing.status, to, actor)
  if (!check.ok) throw transitionError(check.why, check.reason)

  const today = todayUtc()
  const reason = check.needs.includes("reason") ? requireReason(input.reason) : null

  const supplied = parseDay(input.completedOn, "Completed date")
  assertNotFuture(supplied, "completed")
  if (supplied && existing.startedOn && existing.startedOn > supplied) {
    throw new ValidationError("It cannot have started after it was completed.")
  }

  const transition = transitionEffects(
    existing,
    to,
    {
      actorId: session.user.id,
      reason,
      completedOn: supplied,
      note: input.note,
    },
    today,
  )

  // A redelivery is judged on the date it is being given, not the one it is
  // replacing - the old date is exactly what the move is undoing.
  const guarded: (Date | null)[] =
    existing.status === "REJECTED" && to === "DELIVERED"
      ? [transition.completedOn]
      : [existing.completedOn, transition.completedOn]
  assertPeriodOpen(actor, guarded, today)

  await db.$transaction(async (tx) => {
    await tx.projectDeliverable.update({ where: { id }, data: transition.data })
    await tx.projectDeliverableEvent.create({
      data: {
        deliverableId: id,
        type: "STATUS_CHANGED",
        fromStatus: existing.status,
        toStatus: to,
        changes: Object.keys(transition.changes).length ? asJson(transition.changes) : undefined,
        reason,
        actorId: session.user.id,
      },
    })
    if (to === "DELIVERED") await clearOutputSkip(tx, existing.taskId)
  })

  await logActivity({
    projectId,
    actorId: session.user.id,
    type: "DELIVERABLE_STATUS_CHANGED",
    entityType: "DELIVERABLE",
    entityId: id,
    meta: { title: existing.title, from: existing.status, to, reason },
  })
}

// ─── Verify ───────────────────────────────────────────────────────────────────

/**
 * Internal QC sign-off: a manager says they have looked at it.
 *
 * Distinct from ACCEPTED, which is the client's verdict recorded by staff. This
 * one is ours, and only the people who answer for the work may set it - a maker
 * verifying their own output would say nothing.
 */
export async function verifyDeliverable(
  session: Session,
  projectId: string,
  id: string,
  verified: boolean,
): Promise<void> {
  const existing = await db.projectDeliverable.findFirst({
    where: { id, projectId },
    select: {
      id: true,
      employeeId: true,
      loggedById: true,
      title: true,
      status: true,
      verifiedAt: true,
    },
  })
  if (!existing) throw new NotFoundError("Deliverable")

  const actor = await resolveActor(session, projectId, existing.employeeId, existing.loggedById)
  if (actor !== "project_manager" && actor !== "team_manager") {
    throw new ForbiddenError("Only a project manager or the maker's team manager can verify work.")
  }
  if (verified === (existing.verifiedAt !== null)) return

  await db.$transaction(async (tx) => {
    await tx.projectDeliverable.update({
      where: { id },
      data: {
        verifiedById: verified ? session.user.id : null,
        verifiedAt: verified ? new Date() : null,
      },
    })
    await tx.projectDeliverableEvent.create({
      data: {
        deliverableId: id,
        type: verified ? "VERIFIED" : "UNVERIFIED",
        actorId: session.user.id,
      },
    })
  })

  await logActivity({
    projectId,
    actorId: session.user.id,
    type: "DELIVERABLE_VERIFIED",
    entityType: "DELIVERABLE",
    entityId: id,
    meta: { title: existing.title, verified },
  })
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Remove the entry. Its files stay on the project (the FK is SET NULL): a wrong
 * log line must not destroy real work product. They remain on the Files tab
 * under Deliverables, where they can be deleted deliberately.
 *
 * An ACCEPTED row is a recorded verdict, so removing it is a project manager's
 * call alone; a made row obeys the period lock like any other edit; an owed row
 * is just a plan and whoever may touch it may drop it.
 */
export async function deleteDeliverable(
  session: Session,
  projectId: string,
  id: string,
): Promise<void> {
  const existing = await db.projectDeliverable.findFirst({
    where: { id, projectId },
    select: {
      id: true,
      projectId: true,
      employeeId: true,
      loggedById: true,
      title: true,
      status: true,
      completedOn: true,
    },
  })
  if (!existing) throw new NotFoundError("Deliverable")
  if (!(await canEditDeliverable(session, existing))) {
    throw new ForbiddenError("You can only remove your own entries, or your team's.")
  }

  const actor = await resolveActor(session, projectId, existing.employeeId, existing.loggedById)
  if (existing.status === "ACCEPTED" && actor !== "project_manager") {
    throw new ForbiddenError("Only a project manager can remove work the client has accepted.")
  }
  if (isMadeStatus(existing.status)) {
    assertPeriodOpen(actor, [existing.completedOn], todayUtc())
  }

  await db.projectDeliverable.delete({ where: { id } })
  await logActivity({
    projectId,
    actorId: session.user.id,
    type: "DELIVERABLE_DELETED",
    entityType: "DELIVERABLE",
    entityId: id,
    meta: { title: existing.title, status: existing.status },
  })
}
