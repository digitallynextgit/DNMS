// Votes: events admins and HR run, ballots every other employee casts - one each, and final.
// Admins and HR see who voted for whom; everyone else only ever gets counts.

import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { createAuditLog } from "@/lib/audit"
import { isAdmin_ } from "@/lib/permissions"
import { SYSTEM_ROLES } from "@/lib/constants"
import { deleteFile, getObjectKey, isB2Configured, uploadFile } from "@/lib/storage"
import { resizeImage } from "@/lib/image-resize"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import {
  ok,
  fail,
  runAction,
  serialize,
  ActionError,
  type ActionResult,
} from "@/server/action-result"
import {
  ballotSchema,
  voteEventSchema,
  voteEventUpdateSchema,
  voteOptionSchema,
  voteOptionUpdateSchema,
  type VoteOptionInput,
} from "../schemas/votes.schema"
import {
  employeeLabel,
  eventStatus,
  isVoteManagerRoles,
  isVoterRoles,
  tally,
} from "../lib/vote-rules"
import { OPTION_PHOTO_MAX_BYTES, OPTION_PHOTO_TYPES } from "../constants"
import type { VoteBallotVoter, VoteEventStatus, VoteEventView, VoteOptionView } from "../types"

const OPTION_SELECT = {
  id: true,
  label: true,
  description: true,
  photoKey: true,
  position: true,
  employee: { select: EMPLOYEE_SUMMARY_SELECT },
} satisfies Prisma.VoteOptionSelect

const EVENT_SELECT = {
  id: true,
  title: true,
  description: true,
  opensAt: true,
  closesAt: true,
  publishedAt: true,
  closedAt: true,
  createdAt: true,
  options: { select: OPTION_SELECT, orderBy: { position: "asc" } },
  // Voter names leave this module only in the admin/HR view (see toView).
  ballots: {
    select: {
      optionId: true,
      voterId: true,
      votedAt: true,
      voter: { select: EMPLOYEE_SUMMARY_SELECT },
    },
    orderBy: { votedAt: "asc" },
  },
} satisfies Prisma.VoteEventSelect

type EventRow = Prisma.VoteEventGetPayload<{ select: typeof EVENT_SELECT }>
type OptionRow = Prisma.VoteOptionGetPayload<{ select: typeof OPTION_SELECT }>
type Person = Prisma.EmployeeGetPayload<{ select: typeof EMPLOYEE_SUMMARY_SELECT }>

/** Staff who vote and can be voted for - the database twin of isVoterRoles. */
const VOTER_WHERE = {
  isActive: true,
  AND: [
    { employeeRoles: { none: { role: { name: SYSTEM_ROLES.ADMIN_ } } } },
    {
      OR: [
        { employeeRoles: { none: { role: { name: SYSTEM_ROLES.ADMIN } } } },
        { employeeRoles: { some: { role: { name: SYSTEM_ROLES.EMPLOYEE } } } },
      ],
    },
  ],
} satisfies Prisma.EmployeeWhereInput

/** Who can be voted for: the same people who vote, so admins are never on the ballot. */
const eligibleEmployees = () =>
  db.employee.findMany({
    where: VOTER_WHERE,
    select: EMPLOYEE_SUMMARY_SELECT,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  })

type Viewer = { id: string; roles: string[] }

export function isVoteManager(session: Session): boolean {
  return isAdmin_(session) || isVoteManagerRoles(session.user.roles)
}

function requireManager(session: Session): void {
  if (!isVoteManager(session)) {
    throw new ActionError("Only admins and the HR team can manage votes", 403)
  }
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null)

function optionView(
  o: OptionRow,
  votes: number | null,
  viewerId?: string,
  voters: VoteBallotVoter[] | null = null,
): VoteOptionView {
  return {
    id: o.id,
    label: o.label,
    description: o.description,
    position: o.position,
    employee: o.employee,
    hasPhoto: Boolean(o.photoKey),
    photoUrl: o.photoKey ? `/api/votes/options/${o.id}/photo` : (o.employee?.profilePhoto ?? null),
    votes,
    isMe: Boolean(viewerId && o.employee?.id === viewerId),
    voters,
  }
}

function toView(
  row: EventRow,
  viewer: Viewer,
  manage: boolean,
  eligible: Person[],
  now = new Date(),
): VoteEventView {
  const status = eventStatus(row, now)
  const voter = isVoterRoles(viewer.roles)
  // Everyone sees the live standings once voting opens; only admins and HR see names.
  const showResults = manage || status === "OPEN" || status === "CLOSED"
  const t = tally(
    row.options.map((o) => o.id),
    row.ballots,
  )
  const myOptionId = row.ballots.find((b) => b.voterId === viewer.id)?.optionId ?? null
  // Admins and HR see who voted for whom, and who still has to vote.
  const votersOf = (optionId: string): VoteBallotVoter[] | null =>
    manage
      ? row.ballots
          .filter((b) => b.optionId === optionId)
          .map((b) => ({ ...b.voter, votedAt: b.votedAt.toISOString() }))
      : null
  const voted = new Set(row.ballots.map((b) => b.voterId))
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    opensAt: iso(row.opensAt),
    closesAt: row.closesAt.toISOString(),
    publishedAt: iso(row.publishedAt),
    closedAt: iso(row.closedAt),
    status,
    options: row.options.map((o) =>
      optionView(o, showResults ? (t.counts[o.id] ?? 0) : null, viewer.id, votersOf(o.id)),
    ),
    myOptionId,
    // One vote each, and it is final.
    canVote: status === "OPEN" && voter && myOptionId === null,
    isVoter: voter,
    totalVotes: showResults ? t.total : null,
    eligibleVoters: showResults ? eligible.length : null,
    notVoted: manage ? eligible.filter((p) => !voted.has(p.id)) : null,
    winnerOptionIds: showResults ? t.winners : [],
    canReopen:
      manage &&
      status === "CLOSED" &&
      row.closedAt !== null &&
      row.closesAt.getTime() > now.getTime(),
    createdAt: row.createdAt.toISOString(),
  }
}

const STATUS_ORDER: Record<VoteEventStatus, number> = { OPEN: 0, UPCOMING: 1, DRAFT: 2, CLOSED: 3 }

const loadEvent = (id: string) => db.voteEvent.findUnique({ where: { id }, select: EVENT_SELECT })

export async function listEvents(
  session: Session,
  manage: boolean,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    if (manage) requireManager(session)
    const [rows, eligible] = await Promise.all([
      db.voteEvent.findMany({
        where: manage ? {} : { publishedAt: { not: null } },
        select: EVENT_SELECT,
        orderBy: { closesAt: "desc" },
      }),
      eligibleEmployees(),
    ])
    const views = rows.map((r) => toView(r, session.user, manage, eligible))
    // Open first (closing soonest on top), then upcoming, drafts, and closed (latest first).
    views.sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.status === "CLOSED"
          ? b.closesAt.localeCompare(a.closesAt)
          : a.closesAt.localeCompare(b.closesAt)),
    )
    return ok(serialize({ data: views }))
  })
}

export async function getEvent(id: string, session: Session): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const manage = isVoteManager(session)
    const row = await loadEvent(id)
    if (!row || (!manage && !row.publishedAt)) return fail("Vote not found", undefined, 404)
    return ok(serialize({ data: toView(row, session.user, manage, await eligibleEmployees()) }))
  })
}

/** Option inputs to rows: an employee option takes the employee's name unless a label is given. */
async function resolveOptions(
  inputs: VoteOptionInput[],
  startAt: number,
): Promise<Prisma.VoteOptionCreateManyEventInput[]> {
  const employeeIds = [
    ...new Set(inputs.map((o) => o.employeeId).filter((id): id is string => Boolean(id))),
  ]
  const employees = employeeIds.length
    ? await db.employee.findMany({
        where: { id: { in: employeeIds }, ...VOTER_WHERE },
        select: { id: true, firstName: true, lastName: true },
      })
    : []
  const byId = new Map(employees.map((e) => [e.id, e]))

  const rows: Prisma.VoteOptionCreateManyEventInput[] = []
  const seen = new Set<string>()
  for (const o of inputs) {
    if (o.employeeId) {
      const e = byId.get(o.employeeId)
      if (!e) {
        throw new ActionError("Admins and inactive employees cannot be voted for", 422)
      }
      if (seen.has(e.id)) continue
      seen.add(e.id)
      rows.push({
        employeeId: e.id,
        label: o.label || employeeLabel(e.firstName, e.lastName),
        description: o.description || null,
        position: startAt + rows.length,
      })
    } else if (o.label) {
      rows.push({
        employeeId: null,
        label: o.label,
        description: o.description || null,
        position: startAt + rows.length,
      })
    }
  }
  return rows
}

async function notifyVoters(row: EventRow, actorId: string): Promise<void> {
  const recipients = await db.employee.findMany({
    where: { ...VOTER_WHERE, id: { not: actorId } },
    select: { id: true },
  })
  if (recipients.length === 0) return

  const when = (d: Date) =>
    d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })
  const message =
    eventStatus(row) === "UPCOMING" && row.opensAt
      ? `Voting opens ${when(row.opensAt)} and closes ${when(row.closesAt)}.`
      : `Voting is open until ${when(row.closesAt)}. Cast your vote.`

  const { createNotifications } = await import("@/lib/notifications")
  // force: addressed to everyone, so it goes out even when the silent admin_ account publishes.
  await createNotifications(
    recipients.map((r) => ({
      employeeId: r.id,
      title: `New vote: ${row.title}`,
      message,
      type: "info" as const,
      link: "/votes",
    })),
    { force: true },
  )
}

export async function createEvent(body: unknown, session: Session): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    requireManager(session)
    const input = voteEventSchema.parse(body)
    // "Every employee" puts the whole staff on the ballot, admins left out, sorted by name.
    const inputs: VoteOptionInput[] = input.allEmployees
      ? [...(await eligibleEmployees()).map((e) => ({ employeeId: e.id })), ...input.options]
      : input.options
    const options = await resolveOptions(inputs, 0)
    const row = await db.voteEvent.create({
      data: {
        title: input.title,
        description: input.description || null,
        opensAt: input.opensAt ? new Date(input.opensAt) : null,
        closesAt: new Date(input.closesAt),
        createdById: session.user.id,
        options: options.length ? { createMany: { data: options } } : undefined,
      },
      select: EVENT_SELECT,
    })
    await createAuditLog(session, {
      action: "vote_event:create",
      module: "company",
      entityType: "VoteEvent",
      entityId: row.id,
      changes: { title: input.title, closesAt: input.closesAt, options: options.length },
    })
    return ok(serialize({ data: toView(row, session.user, true, await eligibleEmployees()) }))
  })
}

export async function updateEvent(
  id: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    requireManager(session)
    const input = voteEventUpdateSchema.parse(body)
    const existing = await loadEvent(id)
    if (!existing) return fail("Vote not found", undefined, 404)

    const now = new Date()
    const data: Prisma.VoteEventUncheckedUpdateInput = {}
    if (input.title !== undefined) data.title = input.title
    if (input.description !== undefined) data.description = input.description || null
    if (input.opensAt !== undefined) data.opensAt = input.opensAt ? new Date(input.opensAt) : null
    if (input.closesAt !== undefined) data.closesAt = new Date(input.closesAt)

    const opensAt =
      input.opensAt !== undefined
        ? input.opensAt
          ? new Date(input.opensAt)
          : null
        : existing.opensAt
    const closesAt = input.closesAt !== undefined ? new Date(input.closesAt) : existing.closesAt
    if (opensAt && opensAt >= closesAt) {
      return fail("Voting must close after it opens", undefined, 422)
    }

    let published = false
    if (input.publish === true && !existing.publishedAt) {
      if (existing.options.length < 2) {
        return fail("Add at least two options before publishing", undefined, 422)
      }
      if (closesAt <= now) return fail("The closing time has already passed", undefined, 422)
      data.publishedAt = now
      data.closedAt = null
      published = true
    }
    if (input.publish === false && existing.publishedAt) {
      if (existing.ballots.length > 0) {
        return fail("People have already voted; close the vote instead", undefined, 409)
      }
      data.publishedAt = null
    }
    if (input.close === true) {
      if (!existing.publishedAt) return fail("Publish the vote before closing it", undefined, 422)
      data.closedAt = now
    }
    if (input.close === false) {
      if (closesAt <= now) {
        return fail("Move the closing time ahead to reopen voting", undefined, 422)
      }
      data.closedAt = null
    }

    const row = await db.voteEvent.update({ where: { id }, data, select: EVENT_SELECT })
    const action = published
      ? "vote_event:publish"
      : input.close === true
        ? "vote_event:close"
        : input.close === false
          ? "vote_event:reopen"
          : "vote_event:update"
    await createAuditLog(session, {
      action,
      module: "company",
      entityType: "VoteEvent",
      entityId: id,
      changes: { ...input },
    })
    if (published) await notifyVoters(row, session.user.id)
    return ok(serialize({ data: toView(row, session.user, true, await eligibleEmployees(), now) }))
  })
}

export async function deleteEvent(id: string, session: Session): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    requireManager(session)
    const existing = await db.voteEvent.findUnique({
      where: { id },
      select: { id: true, title: true, options: { select: { photoKey: true } } },
    })
    if (!existing) return fail("Vote not found", undefined, 404)
    await db.voteEvent.delete({ where: { id } })
    for (const o of existing.options) {
      if (o.photoKey) await removePhoto(o.photoKey)
    }
    await createAuditLog(session, {
      action: "vote_event:delete",
      module: "company",
      entityType: "VoteEvent",
      entityId: id,
      changes: { title: existing.title },
    })
    return ok({ data: { id } })
  })
}

async function removePhoto(key: string): Promise<void> {
  await deleteFile(key).catch((e) => console.error("[votes] could not delete", key, e))
}

export async function addOption(
  eventId: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    requireManager(session)
    const input = voteOptionSchema.parse(body)
    const event = await db.voteEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        publishedAt: true,
        opensAt: true,
        closesAt: true,
        closedAt: true,
        _count: { select: { options: true } },
      },
    })
    if (!event) return fail("Vote not found", undefined, 404)
    if (eventStatus(event) === "CLOSED") {
      return fail("Voting has closed; the options can no longer change", undefined, 409)
    }
    const [row] = await resolveOptions([input], event._count.options)
    if (!row) return fail("Pick an employee or type a name", undefined, 422)
    if (row.employeeId) {
      const dup = await db.voteOption.findFirst({
        where: { eventId, employeeId: row.employeeId },
        select: { id: true },
      })
      if (dup) return fail("That employee is already an option in this vote", undefined, 409)
    }
    const option = await db.voteOption.create({ data: { eventId, ...row }, select: OPTION_SELECT })
    return ok(serialize({ data: optionView(option, 0) }))
  })
}

/** Puts every eligible employee not yet on the ballot onto it, after the existing options. */
export async function addAllEmployees(
  eventId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    requireManager(session)
    const event = await db.voteEvent.findUnique({
      where: { id: eventId },
      select: {
        publishedAt: true,
        opensAt: true,
        closesAt: true,
        closedAt: true,
        options: { select: { employeeId: true } },
      },
    })
    if (!event) return fail("Vote not found", undefined, 404)
    if (eventStatus(event) === "CLOSED") {
      return fail("Voting has closed; the options can no longer change", undefined, 409)
    }
    const listed = new Set(event.options.map((o) => o.employeeId).filter(Boolean))
    const missing = (await eligibleEmployees()).filter((e) => !listed.has(e.id))
    const rows = await resolveOptions(
      missing.map((e) => ({ employeeId: e.id })),
      event.options.length,
    )
    if (rows.length) {
      await db.voteOption.createMany({
        data: rows.map((r) => ({ ...r, eventId })),
        skipDuplicates: true,
      })
    }
    return ok({ data: { added: rows.length } })
  })
}

/** The people an option can be: active employees, admins left out. */
export async function listCandidates(session: Session): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    requireManager(session)
    return ok(serialize({ data: await eligibleEmployees() }))
  })
}

export async function updateOption(
  optionId: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    requireManager(session)
    const input = voteOptionUpdateSchema.parse(body)
    const existing = await db.voteOption.findUnique({
      where: { id: optionId },
      select: { id: true },
    })
    if (!existing) return fail("Option not found", undefined, 404)
    const option = await db.voteOption.update({
      where: { id: optionId },
      data: { label: input.label, description: input.description || null },
      select: OPTION_SELECT,
    })
    return ok(serialize({ data: optionView(option, null) }))
  })
}

export async function deleteOption(
  optionId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    requireManager(session)
    const existing = await db.voteOption.findUnique({
      where: { id: optionId },
      select: {
        id: true,
        photoKey: true,
        event: { select: { publishedAt: true, opensAt: true, closesAt: true, closedAt: true } },
      },
    })
    if (!existing) return fail("Option not found", undefined, 404)
    if (eventStatus(existing.event) === "CLOSED") {
      return fail("Voting has closed; the options can no longer change", undefined, 409)
    }
    await db.voteOption.delete({ where: { id: optionId } })
    if (existing.photoKey) await removePhoto(existing.photoKey)
    return ok({ data: { id: optionId } })
  })
}

export async function setOptionPhoto(
  optionId: string,
  file: File,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    requireManager(session)
    if (!(OPTION_PHOTO_TYPES as readonly string[]).includes(file.type)) {
      return fail("Use a JPG, PNG or WEBP image", undefined, 422)
    }
    if (file.size > OPTION_PHOTO_MAX_BYTES)
      return fail("Keep the photo under 10 MB", undefined, 422)
    if (!(await isB2Configured())) return fail("File storage is not configured", undefined, 500)

    const existing = await db.voteOption.findUnique({
      where: { id: optionId },
      select: { id: true, eventId: true, photoKey: true },
    })
    if (!existing) return fail("Option not found", undefined, 404)

    // Shown as a card thumbnail, so email-sized is plenty.
    const stored = await resizeImage(Buffer.from(await file.arrayBuffer()), file.type, {
      maxDim: 1200,
      quality: 82,
    })
    const objectKey = getObjectKey(
      `votes/${existing.eventId}`,
      `photo.${stored.ext}`,
      crypto.randomUUID(),
    )
    await uploadFile(objectKey, stored.bytes, stored.contentType)
    const option = await db.voteOption.update({
      where: { id: optionId },
      data: { photoKey: objectKey },
      select: OPTION_SELECT,
    })
    if (existing.photoKey) await removePhoto(existing.photoKey)
    return ok(serialize({ data: optionView(option, null) }))
  })
}

/** For the photo route: the stored key, or null when nothing was uploaded. */
export async function optionPhotoKey(optionId: string): Promise<string | null> {
  const option = await db.voteOption.findUnique({
    where: { id: optionId },
    select: { photoKey: true },
  })
  return option?.photoKey ?? null
}

export async function castBallot(
  eventId: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    if (!isVoterRoles(session.user.roles)) {
      return fail("Admins run the votes and do not cast a ballot", undefined, 403)
    }
    const { optionId } = ballotSchema.parse(body)
    const event = await db.voteEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        publishedAt: true,
        opensAt: true,
        closesAt: true,
        closedAt: true,
        options: { select: { id: true } },
      },
    })
    if (!event || !event.publishedAt) return fail("Vote not found", undefined, 404)
    const status = eventStatus(event)
    if (status === "UPCOMING") return fail("Voting has not opened yet", undefined, 409)
    if (status !== "OPEN") return fail("Voting has closed", undefined, 409)

    // Voting for yourself is allowed.
    if (!event.options.some((o) => o.id === optionId)) {
      return fail("That option is not part of this vote", undefined, 422)
    }

    const voterId = session.user.id
    const already = () => fail("You have already voted in this event", undefined, 409)
    const mine = await db.voteBallot.findFirst({
      where: { eventId, voterId },
      select: { id: true },
    })
    // One vote each, and it is final.
    if (mine) return already()
    try {
      await db.voteBallot.create({ data: { eventId, optionId, voterId } })
    } catch (e) {
      // A double-click can race the first insert; the unique (event, voter) index catches it.
      if ((e as { code?: string }).code === "P2002") return already()
      throw e
    }
    return ok({ data: { optionId } })
  })
}
