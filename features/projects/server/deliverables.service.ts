import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db, type DbTransaction } from "@/server/db"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { latestCalendarDay, todayUtc } from "@/lib/dates"
import { canAccessProject, canManageProject } from "./project-access"
import { logActivity } from "./activity"
import { openFirstStatusPeriod } from "./task-status-periods"
import { periodProblem, ymd as ymdOf } from "../lib/delivery-period"
import { dedupeLinks, isSafeHttpUrl } from "../lib/task-links"
import { MAX_LINKS, MAX_QUANTITY, MAX_TYPE_LENGTH, cleanType } from "../lib/deliverable-types"
import {
  CREATABLE_STATUSES,
  allowedTransition,
  hasProof,
  isMadeStatus,
  isOpenStatus,
  periodClosesOn,
  periodOpen,
  type DeliverableActor,
  type DeliverableStatus,
  MAX_REPEAT,
  repeatDueDates,
  type RepeatEvery,
} from "../lib/deliverable-lifecycle"

// Logging what was produced. Members log/edit their own output; logging for someone else needs a
// project admin, the account manager or that person's team manager. The team is stamped at logging
// time. Every write appends a ProjectDeliverableEvent; past LOCK_DAYS only a PM may edit.

export interface DeliverableInput {
  /** Who will make it. Omit on an owed row to leave it to the team; required once delivered. */
  employeeId?: string | null
  /** Which team owes it. Required when there is no employee. */
  teamId?: string | null
  type: string
  title: string
  quantity?: number
  /** How many of `quantity` are made - moves as work lands, so the status needn't lie. */
  deliveredQuantity?: number
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
  /** Repeat the commitment weekly/monthly from `dueOn`. Owed work only. */
  repeat?: { every: RepeatEvery; count: number } | null
}

export interface StatusChangeInput {
  status: DeliverableStatus
  reason?: string | null
  completedOn?: string | null
  note?: string | null
}

/** A PATCH may carry fields and a move together, so it also carries the move's `reason` / `note`. */
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

/** Not after the user's LOCAL today (see latestCalendarDay) - pickers are local, not UTC. */
function assertNotFuture(d: Date | null, label: string): void {
  if (d && d > latestCalendarDay()) {
    throw new ValidationError(`The ${label} date cannot be in the future.`)
  }
}

/** Snap a typed type onto the project's casing ("reel" -> "Reel"); new types stay as typed. */
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

/** Clamped, not rejected: the promise may be edited down after work was logged. */
function normaliseDeliveredQuantity(raw: unknown, promised: number): number {
  if (raw === undefined || raw === null || raw === "") return 0
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) {
    throw new ValidationError("Completed must be a whole number, 0 or more.")
  }
  return Math.min(n, promised)
}

/**
 * Delivered needs proof (link, file or note), checked against what this request leaves behind.
 * No account-manager exemption: delivered with no record is a gap the client will see.
 */
function assertLogged(
  existing: { links: string[]; notes: string | null; _count: { files: number } },
  input: DeliverableUpdateInput,
  to: DeliverableStatus,
): void {
  if (to !== "DELIVERED") return
  const links = input.links !== undefined ? normaliseLinks(input.links) : existing.links
  const notes = input.notes !== undefined ? input.notes : existing.notes
  const files = existing._count.files > 0 ? [existing._count.files] : []
  if (!hasProof({ links, files, notes })) {
    throw new ValidationError(
      "The log is missing - add the link, the file or a note that shows what was made.",
    )
  }
}

/** The maker must log every promised unit before DELIVERED; a PM may close a row out early. */
function assertFullyMade(
  existing: { quantity: number; deliveredQuantity: number },
  input: DeliverableUpdateInput,
  actor: DeliverableActor,
  to: DeliverableStatus,
): void {
  if (to !== "DELIVERED" || actor === "project_manager") return
  const promised =
    input.quantity !== undefined ? normaliseQuantity(input.quantity) : existing.quantity
  const made =
    input.deliveredQuantity !== undefined
      ? normaliseDeliveredQuantity(input.deliveredQuantity, promised)
      : existing.deliveredQuantity
  if (made < promised) {
    throw new ValidationError(
      `Only ${made} of ${promised} are logged. Log the rest before marking it delivered.`,
    )
  }
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

/** This person's team on the project when they are on exactly one; null when none or several. */
async function teamOf(projectId: string, employeeId: string): Promise<string | null> {
  const rows = await db.projectTeamMember.findMany({
    where: { projectId, employeeId },
    select: { teamId: true },
    take: 2,
  })
  return rows.length === 1 ? rows[0]!.teamId : null
}

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

/** For team-owed rows, which have no member to look the team up through. */
async function managesTeam(session: Session, projectId: string, teamId: string) {
  const team = await db.projectTeam.findFirst({
    where: { id: teamId, projectId, managerId: session.user.id },
    select: { id: true },
  })
  return !!team
}

async function isOnTeam(session: Session, projectId: string, teamId: string) {
  const m = await db.projectTeamMember.findFirst({
    where: { projectId, teamId, employeeId: session.user.id },
    select: { teamId: true },
  })
  return !!m
}

/** Row owner for permissions: the assignee, else the team that owes it (unassigned != unowned). */
export interface DeliverableOwner {
  employeeId: string | null
  teamId: string | null
  loggedById?: string | null
}

/** Does this person manage the row's team - or, for a row with no team, any team of its assignee? */
async function managesOwner(
  session: Session,
  projectId: string,
  owner: DeliverableOwner,
): Promise<boolean> {
  if (owner.teamId) return managesTeam(session, projectId, owner.teamId)
  return !!owner.employeeId && managesTeamOf(session, projectId, owner.employeeId)
}

/** Log for `employeeId`? Self: any member. Others: admin, AM, or their team's manager. */
export async function canLogFor(
  session: Session,
  projectId: string,
  employeeId: string,
): Promise<boolean> {
  if (employeeId === session.user.id) return canAccessProject(session, projectId)
  if (await canManageProject(session, projectId)) return true
  return managesTeamOf(session, projectId, employeeId)
}

/** How many lines one plan may carry. A week of work, not a year of it. */
const MAX_PLAN_LINES = 60

export async function canEditDeliverable(
  session: Session,
  d: DeliverableOwner & { projectId: string },
): Promise<boolean> {
  if (d.employeeId === session.user.id || d.loggedById === session.user.id) return true
  if (await canManageProject(session, d.projectId)) return true
  return managesOwner(session, d.projectId, d)
}

/** The caller's standing on ONE row, resolved once per request. */
export async function resolveActor(
  session: Session,
  projectId: string,
  owner: DeliverableOwner,
): Promise<DeliverableActor> {
  if (await canManageProject(session, projectId)) return "project_manager"
  if (await managesOwner(session, projectId, owner)) return "team_manager"
  if (
    (owner.employeeId && session.user.id === owner.employeeId) ||
    (owner.loggedById && session.user.id === owner.loggedById)
  ) {
    return "maker"
  }
  // Unclaimed: anyone on the owing team stands as the maker, so they can claim it.
  if (!owner.employeeId && owner.teamId && (await isOnTeam(session, projectId, owner.teamId))) {
    return "maker"
  }
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

/** Side effects of a move. A redelivery takes the NEW date; the old one is kept in the event. */
function transitionEffects(
  existing: {
    status: DeliverableStatus
    startedOn: Date | null
    completedOn: Date | null
    employeeId: string | null
  },
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

  // Sent back: clear the stage-one check - it belonged to that delivery, not the row.
  if (to === "REJECTED") {
    data.verifiedAt = null
    data.verifiedById = null
  }

  // Un-accept: the verdict is withdrawn, the delivery stands.
  if (to === "DELIVERED" && existing.status === "ACCEPTED") {
    data.acceptedAt = null
    data.acceptedById = null
    data.acceptanceNote = null
  }

  // Unclaimed work just made: whoever moved it made it (a made row needs a maker).
  if (!existing.employeeId && isMadeStatus(to)) {
    data.employeeId = opts.actorId
    changes.employeeId = [null, opts.actorId]
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

async function assertTeamInProject(projectId: string, teamId: string): Promise<void> {
  const team = await db.projectTeam.findFirst({
    where: { id: teamId, projectId },
    select: { id: true },
  })
  if (!team) throw new NotFoundError("Team")
}

async function assertTaskInProject(projectId: string, taskId: string): Promise<void> {
  const task = await db.projectTask.findFirst({
    where: { id: taskId, projectId },
    select: { id: true },
  })
  if (!task) throw new NotFoundError("Task")
}

export async function createDeliverable(
  session: Session,
  projectId: string,
  input: DeliverableInput,
): Promise<{ id: string; created: number }> {
  const status = input.status ?? "DELIVERED"
  if (!(CREATABLE_STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError("A new entry starts as owed, in progress, or delivered.")
  }

  // Only an explicit employeeId: null means "nobody yet" (owed work only); omitted still means "me".
  const unassigned = input.employeeId === null
  if (unassigned && !isOpenStatus(status)) {
    throw new ValidationError("Something that has been made needs a maker.")
  }
  const employeeId = unassigned ? null : input.employeeId?.trim() || session.user.id

  const explicitTeam = input.teamId?.trim() || null
  if (unassigned && !explicitTeam) {
    throw new ValidationError("Owed work with nobody on it needs a team to owe it.")
  }
  if (explicitTeam) await assertTeamInProject(projectId, explicitTeam)

  if (employeeId && !(await canLogFor(session, projectId, employeeId))) {
    throw new ForbiddenError(
      employeeId === session.user.id
        ? "You are not on this project."
        : "Only a project admin, the account manager or their team manager can log for someone else.",
    )
  }

  const actor = await resolveActor(session, projectId, { employeeId, teamId: explicitTeam })
  // Planning commits someone else's time, so it belongs to whoever owns the schedule.
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

  // An explicit team wins: the team that was ASKED stays accountable.
  const [type, memberTeam] = await Promise.all([
    canonicalType(projectId, input.type ?? ""),
    employeeId ? teamOf(projectId, employeeId) : Promise.resolve(null),
  ])
  const teamId = explicitTeam ?? memberTeam
  const quantity = normaliseQuantity(input.quantity)
  const taskId = input.taskId || null

  const repeat = input.repeat ?? null
  if (repeat) {
    if (!isOpenStatus(status)) {
      throw new ValidationError("Only owed work repeats - something made happened once.")
    }
    if (!dueOn) throw new ValidationError("A repeating commitment needs a first due date.")
    if (!Number.isFinite(repeat.count) || repeat.count < 1) {
      throw new ValidationError("Say how many times it repeats.")
    }
    if (repeat.count > MAX_REPEAT) {
      throw new ValidationError(`That is more than ${MAX_REPEAT} - plan a year at a time.`)
    }
    if (repeat.every !== "WEEK" && repeat.every !== "MONTH") {
      throw new ValidationError("A commitment repeats weekly or monthly.")
    }
  }
  const dueDates = repeat && dueOn ? repeatDueDates(dueOn, repeat.every, repeat.count) : [dueOn]

  const created = await db.$transaction(async (tx) => {
    const rows = await Promise.all(
      dueDates.map((due) =>
        tx.projectDeliverable.create({
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
            dueOn: due,
            links: normaliseLinks(input.links),
            notes: input.notes?.trim() || null,
          },
          select: { id: true, employee: { select: { firstName: true, lastName: true } } },
        }),
      ),
    )
    const row = rows[0]!
    // One CREATED event per row: each is its own commitment from here on.
    await tx.projectDeliverableEvent.createMany({
      data: rows.map((r) => ({
        deliverableId: r.id,
        type: "CREATED" as const,
        toStatus: status,
        actorId: session.user.id,
      })),
    })
    if (status === "DELIVERED") await clearOutputSkip(tx, taskId)
    return { row, count: rows.length }
  })

  await logActivity({
    projectId,
    actorId: session.user.id,
    type: "DELIVERABLE_LOGGED",
    entityType: "DELIVERABLE",
    entityId: created.row.id,
    meta: {
      title,
      type,
      quantity,
      status,
      employeeName: created.row.employee
        ? `${created.row.employee.firstName} ${created.row.employee.lastName ?? ""}`.trim()
        : null,
      completedOn: ymd(completedOn),
      dueOn: ymd(dueOn),
      // A repeat is one decision; the feed should read as one line, not twelve.
      repeated: created.count > 1 ? created.count : undefined,
    },
  })

  return { id: created.row.id, created: created.count }
}

const EDIT_SELECT = {
  id: true,
  projectId: true,
  employeeId: true,
  teamId: true,
  loggedById: true,
  taskId: true,
  goalId: true,
  type: true,
  title: true,
  quantity: true,
  deliveredQuantity: true,
  status: true,
  startedOn: true,
  completedOn: true,
  dueOn: true,
  links: true,
  notes: true,
  // For the Delivered gate: files are the one proof not on the row.
  _count: { select: { files: true } },
} satisfies Prisma.ProjectDeliverableSelect

/** Edit and optionally move the entry in ONE transaction (two events), so nothing half-applies. */
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

  const actor = await resolveActor(session, projectId, existing)
  const today = todayUtc()

  const nextStatus =
    input.status && input.status !== existing.status ? (input.status as DeliverableStatus) : null
  let reason: string | null = null
  if (nextStatus) {
    const check = allowedTransition(existing.status, nextStatus, actor)
    if (!check.ok) throw transitionError(check.why, check.reason)
    if (check.needs.includes("reason")) reason = requireReason(input.reason)
    assertFullyMade(existing, input, actor, nextStatus)
    assertLogged(existing, input, nextStatus)
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

  // Progress follows the promise when it is edited down ("it was only ever 2").
  const promised = (data.quantity as number | undefined) ?? existing.quantity
  if (input.deliveredQuantity !== undefined) {
    const made = normaliseDeliveredQuantity(input.deliveredQuantity, promised)
    if (noteChange(changes, "deliveredQuantity", existing.deliveredQuantity, made)) {
      data.deliveredQuantity = made
    }
  } else if (existing.deliveredQuantity > promised) {
    data.deliveredQuantity = promised
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

  // Reassigning doesn't move the team it was asked of - that team stays accountable.
  if (input.employeeId !== undefined && input.employeeId !== existing.employeeId) {
    const nextEmployee = input.employeeId
    if (nextEmployee === null) {
      if (!isOpenStatus(existing.status)) {
        throw new ValidationError("Something that has been made keeps its maker.")
      }
      if (!existing.teamId) {
        throw new ValidationError("Give it a team before taking the person off it.")
      }
      if (actor !== "project_manager" && actor !== "team_manager") {
        throw new ForbiddenError("Only a project manager or the team's manager can unassign work.")
      }
      noteChange(changes, "employeeId", existing.employeeId, null)
      data.employeeId = null
    } else {
      if (!(await canLogFor(session, projectId, nextEmployee))) {
        throw new ForbiddenError("You cannot move this entry to that person.")
      }
      // Claiming is open to the owing team (resolveActor made them makers); reassigning isn't.
      if (actor === "none") throw new ForbiddenError("This is not yours to assign.")
      noteChange(changes, "employeeId", existing.employeeId, nextEmployee)
      data.employeeId = nextEmployee
      if (!existing.teamId) data.teamId = await teamOf(projectId, nextEmployee)
    }
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

  // Made means fully made - keeps the number honest after a PM closes a row out early.
  if (nextStatus && isMadeStatus(nextStatus)) {
    const promisedNow = (data.quantity as number | undefined) ?? existing.quantity
    if (existing.deliveredQuantity !== promisedNow) {
      noteChange(changes, "deliveredQuantity", existing.deliveredQuantity, promisedNow)
      data.deliveredQuantity = promisedNow
    }
  }

  const effectiveStatus = nextStatus ?? existing.status
  const finalCompletedOn = transition?.completedOn ?? completedOn
  if (isMadeStatus(effectiveStatus) && !finalCompletedOn) {
    throw new ValidationError("When was it completed?")
  }

  // The lock guards the period a row counts for, both sides; a redelivery is exempt on the old date.
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

/** One-click row moves (start, deliver, accept, send back), separate from the full-form update. */
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
      teamId: true,
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
  const actor = await resolveActor(session, projectId, existing)
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

  // A redelivery is judged on its new date, not the one it replaces.
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

/**
 * May this person sign off stage one (internal QC)? The team's manager - or, when they made it
 * themselves, the maker's line manager. Nobody checks their own work.
 */
async function canVerify(
  session: Session,
  projectId: string,
  owner: DeliverableOwner,
  actor: DeliverableActor,
): Promise<boolean> {
  const me = session.user.id
  // The account manager is the final authority and has nobody above them.
  if (actor === "project_manager") return true
  if (owner.employeeId && owner.employeeId === me) return false
  if (actor === "team_manager") return true

  // Team manager made it themselves: their own manager takes the stage.
  if (!owner.employeeId || !owner.teamId) return false
  const team = await db.projectTeam.findFirst({
    where: { id: owner.teamId, projectId },
    select: { managerId: true },
  })
  if (!team || team.managerId !== owner.employeeId) return false
  const maker = await db.employee.findUnique({
    where: { id: owner.employeeId },
    select: { managerId: true },
  })
  return Boolean(maker?.managerId && maker.managerId === me)
}

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
      teamId: true,
      loggedById: true,
      title: true,
      status: true,
      verifiedAt: true,
    },
  })
  if (!existing) throw new NotFoundError("Deliverable")

  const actor = await resolveActor(session, projectId, existing)
  if (!(await canVerify(session, projectId, existing, actor))) {
    throw new ForbiddenError(
      "Only the team manager, the maker's own manager or the account manager can check this work - and nobody checks their own.",
    )
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

/**
 * Remove the entry; its files stay on the project (FK SET NULL). ACCEPTED rows are PM-only, made
 * rows obey the period lock, owed rows are just plans.
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
      teamId: true,
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

  const actor = await resolveActor(session, projectId, existing)
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

/**
 * Start owed work: claim it if unowned, move it to IN_PROGRESS and create a linked task, so finishing
 * the task prompts for this row's output. The one place a plain member may raise a project task.
 */
export async function startDeliverable(
  session: Session,
  projectId: string,
  id: string,
): Promise<{ taskId: string; claimed: boolean }> {
  const existing = await db.projectDeliverable.findFirst({
    where: { id, projectId },
    select: {
      id: true,
      employeeId: true,
      teamId: true,
      loggedById: true,
      status: true,
      title: true,
      type: true,
      quantity: true,
      dueOn: true,
      goalId: true,
      taskId: true,
    },
  })
  if (!existing) throw new NotFoundError("Deliverable")
  if (!isOpenStatus(existing.status)) {
    throw new ValidationError("That work has already been delivered.", { code: "BAD_TRANSITION" })
  }
  if (existing.taskId) {
    throw new ValidationError("That is already being tracked as a task.", {
      code: "BAD_TRANSITION",
    })
  }

  const actor = await resolveActor(session, projectId, existing)
  if (actor === "none") throw new ForbiddenError("This is not yours to start.")

  // Only unowned work changes hands - a manager starting someone's row doesn't steal it.
  const claimed = !existing.employeeId
  const ownerId = existing.employeeId ?? session.user.id
  const today = todayUtc()

  const taskId = await db.$transaction(async (tx) => {
    const task = await tx.projectTask.create({
      data: {
        projectId,
        teamId: existing.teamId,
        title: existing.quantity > 1 ? `${existing.title} (${existing.quantity})` : existing.title,
        status: "IN_PROGRESS",
        assigneeId: ownerId,
        creatorId: session.user.id,
        dueDate: existing.dueOn,
        goalId: existing.goalId,
        // It exists to produce this deliverable, so the completion prompt must fire.
        producesOutput: true,
        isManagerCreated: ownerId !== session.user.id,
      },
      select: { id: true },
    })
    await openFirstStatusPeriod(tx, {
      taskId: task.id,
      status: "IN_PROGRESS",
      actorId: session.user.id,
    })

    const changes: Changes = {}
    if (claimed) changes.employeeId = [null, ownerId]
    if (existing.status !== "IN_PROGRESS") changes.status = [existing.status, "IN_PROGRESS"]
    changes.taskId = [null, task.id]

    await tx.projectDeliverable.update({
      where: { id },
      data: {
        employeeId: ownerId,
        status: "IN_PROGRESS",
        startedOn: today,
        taskId: task.id,
      },
    })
    await tx.projectDeliverableEvent.create({
      data: {
        deliverableId: id,
        type: "STATUS_CHANGED",
        fromStatus: existing.status,
        toStatus: "IN_PROGRESS",
        changes: asJson(changes),
        actorId: session.user.id,
      },
    })
    return task.id
  })

  await logActivity({
    projectId,
    actorId: session.user.id,
    type: "DELIVERABLE_STATUS_CHANGED",
    entityType: "DELIVERABLE",
    entityId: id,
    meta: { title: existing.title, from: existing.status, to: "IN_PROGRESS", taskId, claimed },
  })

  return { taskId, claimed }
}

/** One line of a plan: what a team owes, and how many. */
export interface PlanLine {
  teamId: string
  type: string
  title: string
  quantity?: number
  /** Optional: name somebody now instead of leaving it to the team manager. */
  employeeId?: string | null
  goalId?: string | null
  notes?: string | null
}

export interface PlanInput {
  /** Inclusive window, yyyy-MM-dd. Every row created carries it. */
  periodStart: string
  periodEnd: string
  lines: PlanLine[]
}

/** Commit a period's work across teams in one transaction. Rows start unassigned, owed by the team. */
export async function planDeliverables(
  session: Session,
  projectId: string,
  input: PlanInput,
): Promise<{ created: number }> {
  // Account manager only: a period plan is a promise to the client across every team.
  if (!(await canManageProject(session, projectId))) {
    throw new ForbiddenError("Only the account manager can plan a period of work.")
  }

  const start = parseDay(input.periodStart, "Period start")
  const end = parseDay(input.periodEnd, "Period end")
  if (!start || !end) throw new ValidationError("A plan needs a period to cover.")

  const problem = periodProblem(start, end)
  if (problem) throw new ValidationError(problem)

  const lines = input.lines ?? []
  if (lines.length === 0) throw new ValidationError("Add at least one thing to the plan.")
  if (lines.length > MAX_PLAN_LINES) {
    throw new ValidationError(`That is more than ${MAX_PLAN_LINES} lines - split the plan.`)
  }

  // Every team must be on this project and staffable by the caller.
  const teamIds = [...new Set(lines.map((l) => l.teamId))]
  for (const teamId of teamIds) {
    if (!teamId) throw new ValidationError("Every line needs a team to owe it.")
    await assertTeamInProject(projectId, teamId)
  }

  // Planning the same period again adds to it rather than replacing it.

  // Resolved before the transaction so it isn't held open across N round trips.
  const resolved = await Promise.all(
    lines.map(async (l) => {
      if (l.goalId) await assertGoalInProject(projectId, l.goalId)
      if (l.employeeId && !(await canLogFor(session, projectId, l.employeeId))) {
        throw new ForbiddenError("You cannot put that person on this work.")
      }
      return {
        teamId: l.teamId,
        employeeId: l.employeeId || null,
        goalId: l.goalId || null,
        type: await canonicalType(projectId, l.type ?? ""),
        title: normaliseTitle(l.title),
        quantity: normaliseQuantity(l.quantity),
        notes: l.notes?.trim() || null,
      }
    }),
  )

  const rows = resolved.map((l) => ({
    projectId,
    teamId: l.teamId,
    employeeId: l.employeeId,
    loggedById: session.user.id,
    goalId: l.goalId,
    type: l.type,
    title: l.title,
    quantity: l.quantity,
    notes: l.notes,
    status: "PLANNED" as const,
    // The deadline is the end of the week it is owed across.
    dueOn: end,
    periodStart: start,
    periodEnd: end,
  }))

  const created = await db.$transaction(async (tx) => {
    const made = await tx.projectDeliverable.createManyAndReturn({
      data: rows,
      select: { id: true },
    })
    await tx.projectDeliverableEvent.createMany({
      data: made.map((r) => ({
        deliverableId: r.id,
        type: "CREATED" as const,
        toStatus: "PLANNED" as const,
        actorId: session.user.id,
      })),
    })
    return made.length
  })

  await logActivity({
    projectId,
    actorId: session.user.id,
    type: "DELIVERABLE_LOGGED",
    entityType: "DELIVERABLE",
    entityId: projectId,
    meta: {
      planned: created,
      teams: teamIds.length,
      from: ymdOf(start),
      to: ymdOf(end),
    },
  })

  return { created }
}
