import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { createNotifications } from "@/lib/notifications"
import { daysFromTo, indiaToday, toDateOnly } from "@/lib/dates"
import { canAccessProject, canManageProject } from "@/features/projects/server/project-access"
import { projectHref } from "@/features/projects/lib/project-href"
import { duplicateKey, isOpenStage, type Stage } from "../lib/sales"
import type {
  CreateLeadInput,
  ImportLeadsInput,
  LeadActivityInput,
  UpdateLeadInput,
} from "../schemas/sales.schema"
import type { LeadActivityRow, LeadRow } from "../types"

const asDate = (d: string) => new Date(`${d}T00:00:00.000Z`)
const PERSON = { id: true, firstName: true, lastName: true, profilePhoto: true } as const

const LEAD_SELECT = {
  id: true,
  business: true,
  contactName: true,
  phone: true,
  email: true,
  website: true,
  category: true,
  area: true,
  city: true,
  address: true,
  mapsUrl: true,
  rating: true,
  reviewsCount: true,
  stage: true,
  lostReason: true,
  value: true,
  nextFollowUp: true,
  doNotContact: true,
  source: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: PERSON },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { kind: true, createdAt: true },
  },
} as const

type StoredLead = {
  id: string
  business: string
  contactName: string | null
  phone: string | null
  email: string | null
  website: string | null
  category: string | null
  area: string | null
  city: string | null
  address: string | null
  mapsUrl: string | null
  rating: number | null
  reviewsCount: number | null
  stage: string
  lostReason: string | null
  value: number | null
  nextFollowUp: Date | null
  doNotContact: boolean
  source: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  assignee: LeadRow["assignee"]
  activities: { kind: string; createdAt: Date }[]
}

function toRow(l: StoredLead): LeadRow {
  const last = l.activities[0]
  return {
    ...l,
    stage: l.stage as Stage,
    nextFollowUp: l.nextFollowUp ? toDateOnly(l.nextFollowUp) : null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    lastActivity: last ? { kind: last.kind, at: last.createdAt.toISOString() } : null,
  }
}

/**
 * Anyone on the project sees the leads. Adding, importing, assigning and deleting: its Account
 * Managers, project admins and whoever owns the BD / Sales service. A lead's assignee works it.
 */
export async function salesAccess(session: Session, projectId: string) {
  if (!(await canAccessProject(session, projectId))) return { canView: false, canManage: false }
  if (await canManageProject(session, projectId)) return { canView: true, canManage: true }
  const owner = await db.projectServiceOwner.findFirst({
    where: {
      projectId,
      service: "BD",
      OR: [{ employeeId: session.user.id }, { secondaryEmployeeId: session.user.id }],
    },
    select: { id: true },
  })
  return { canView: true, canManage: !!owner }
}

async function leadFor(projectId: string, leadId: string) {
  const lead = await db.salesLead.findFirst({
    where: { id: leadId, projectId },
    select: { id: true, stage: true, assigneeId: true, nextFollowUp: true },
  })
  if (!lead) throw new NotFoundError("Lead")
  return lead
}

/** Managers, or the lead's own assignee. */
async function assertCanWork(session: Session, projectId: string, assigneeId: string | null) {
  if (assigneeId && assigneeId === session.user.id) return
  if ((await salesAccess(session, projectId)).canManage) return
  throw new ForbiddenError("Only its assignee or the sales managers can change this lead")
}

/** Open leads first - soonest follow-up on top - then won and lost ones, latest first. */
function byFollowUp(a: LeadRow, b: LeadRow): number {
  const openA = isOpenStage(a.stage)
  const openB = isOpenStage(b.stage)
  if (openA !== openB) return openA ? -1 : 1
  if (openA && a.nextFollowUp !== b.nextFollowUp) {
    if (!a.nextFollowUp) return 1
    if (!b.nextFollowUp) return -1
    return a.nextFollowUp.localeCompare(b.nextFollowUp)
  }
  return b.updatedAt.localeCompare(a.updatedAt)
}

export async function listLeads(projectId: string): Promise<LeadRow[]> {
  const rows = await db.salesLead.findMany({ where: { projectId }, select: LEAD_SELECT })
  return rows.map(toRow).sort(byFollowUp)
}

async function findDuplicate(
  projectId: string,
  lead: { business: string; phone?: string | null; area?: string | null },
  ignoreId?: string,
) {
  const key = duplicateKey(lead)
  const others = await db.salesLead.findMany({
    where: { projectId, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
    select: { business: true, phone: true, area: true },
  })
  return others.find((o) => duplicateKey(o) === key) ?? null
}

const optional = <T>(v: T | null | undefined) => (v === undefined ? undefined : (v ?? null))

export async function createLead(
  projectId: string,
  actorId: string,
  input: CreateLeadInput,
): Promise<LeadRow> {
  const dupe = await findDuplicate(projectId, input)
  if (dupe) throw new ConflictError(`"${dupe.business}" is already a lead with these details`)
  const lead = await db.salesLead.create({
    data: {
      projectId,
      business: input.business,
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      category: input.category ?? null,
      area: input.area ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      mapsUrl: input.mapsUrl ?? null,
      rating: input.rating ?? null,
      reviewsCount: input.reviewsCount ?? null,
      stage: input.stage ?? "NEW",
      lostReason: input.lostReason ?? null,
      value: input.value ?? null,
      assigneeId: input.assigneeId ?? null,
      nextFollowUp: input.nextFollowUp ? asDate(input.nextFollowUp) : null,
      doNotContact: input.doNotContact ?? false,
      source: "Manual",
      notes: input.notes ?? null,
      createdById: actorId,
      activities: { create: { kind: "CREATED", actorId } },
    },
    select: LEAD_SELECT,
  })
  return toRow(lead)
}

export async function updateLead(
  session: Session,
  projectId: string,
  leadId: string,
  input: UpdateLeadInput,
): Promise<LeadRow> {
  const before = await leadFor(projectId, leadId)
  await assertCanWork(session, projectId, before.assigneeId)
  // Assigning someone else is a manager's call.
  if (input.assigneeId !== undefined && input.assigneeId !== before.assigneeId) {
    if (!(await salesAccess(session, projectId)).canManage) {
      throw new ForbiddenError("Only the sales managers can reassign a lead")
    }
  }
  if (input.business !== undefined || input.phone !== undefined || input.area !== undefined) {
    const current = await db.salesLead.findUniqueOrThrow({
      where: { id: leadId },
      select: { business: true, phone: true, area: true },
    })
    const dupe = await findDuplicate(
      projectId,
      {
        business: input.business ?? current.business,
        phone: input.phone === undefined ? current.phone : input.phone,
        area: input.area === undefined ? current.area : input.area,
      },
      leadId,
    )
    if (dupe) throw new ConflictError(`"${dupe.business}" is already a lead with these details`)
  }

  const followUpMoved =
    input.nextFollowUp !== undefined &&
    (input.nextFollowUp ?? null) !== (before.nextFollowUp ? toDateOnly(before.nextFollowUp) : null)
  const stageMoved = input.stage !== undefined && input.stage !== before.stage

  const lead = await db.salesLead.update({
    where: { id: leadId },
    data: {
      business: input.business,
      contactName: optional(input.contactName),
      phone: optional(input.phone),
      email: optional(input.email),
      website: optional(input.website),
      category: optional(input.category),
      area: optional(input.area),
      city: optional(input.city),
      address: optional(input.address),
      mapsUrl: optional(input.mapsUrl),
      rating: optional(input.rating),
      reviewsCount: optional(input.reviewsCount),
      stage: input.stage,
      lostReason: optional(input.lostReason),
      value: optional(input.value),
      assigneeId: optional(input.assigneeId),
      ...(input.nextFollowUp === undefined
        ? {}
        : { nextFollowUp: input.nextFollowUp ? asDate(input.nextFollowUp) : null }),
      ...(followUpMoved ? { followUpRemindedOn: null } : {}),
      doNotContact: input.doNotContact,
      notes: optional(input.notes),
      ...(stageMoved
        ? {
            activities: {
              create: {
                kind: "STAGE",
                actorId: session.user.id,
                fromStage: before.stage,
                toStage: input.stage,
              },
            },
          }
        : {}),
    },
    select: LEAD_SELECT,
  })

  // A lead handed to someone else tells them.
  if (
    input.assigneeId &&
    input.assigneeId !== before.assigneeId &&
    input.assigneeId !== session.user.id
  ) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, slug: true, name: true },
    })
    await createNotifications([
      {
        employeeId: input.assigneeId,
        title: `New lead for you: ${lead.business}`,
        message: `${project?.name ?? "A project"}${lead.area ? ` - ${lead.area}` : ""}.`,
        type: "info",
        link: project ? projectHref(project, "sales", { lead: lead.id }) : undefined,
      },
    ])
  }
  return toRow(lead)
}

export async function deleteLead(session: Session, projectId: string, leadId: string) {
  await leadFor(projectId, leadId)
  if (!(await salesAccess(session, projectId)).canManage) {
    throw new ForbiddenError("Only the sales managers can delete a lead")
  }
  await db.salesLead.delete({ where: { id: leadId } })
}

/** Adds the rows that aren't leads yet (same phone, or same business in the same area). */
export async function importLeads(
  projectId: string,
  actorId: string,
  input: ImportLeadsInput,
): Promise<{ added: number; duplicates: number }> {
  const existing = await db.salesLead.findMany({
    where: { projectId },
    select: { business: true, phone: true, area: true },
  })
  const seen = new Set(existing.map(duplicateKey))
  let added = 0
  let duplicates = 0
  for (const row of input.rows) {
    const key = duplicateKey(row)
    if (seen.has(key)) {
      duplicates++
      continue
    }
    seen.add(key)
    // One at a time: createMany trips the pg adapter here (see the roles route).
    await db.salesLead.create({
      data: {
        projectId,
        business: row.business,
        contactName: row.contactName ?? null,
        phone: row.phone ?? null,
        email: row.email ?? null,
        website: row.website ?? null,
        category: row.category ?? null,
        area: row.area ?? null,
        city: row.city ?? null,
        address: row.address ?? null,
        mapsUrl: row.mapsUrl ?? null,
        rating: row.rating ?? null,
        reviewsCount: row.reviewsCount ?? null,
        notes: row.notes ?? null,
        assigneeId: input.assigneeId ?? null,
        source: "Import",
        createdById: actorId,
      },
    })
    added++
  }
  return { added, duplicates }
}

export async function listActivities(
  projectId: string,
  leadId: string,
): Promise<LeadActivityRow[]> {
  await leadFor(projectId, leadId)
  const rows = await db.salesLeadActivity.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      kind: true,
      note: true,
      fromStage: true,
      toStage: true,
      createdAt: true,
      actor: { select: PERSON },
    },
  })
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

/** Logs a call, WhatsApp, visit or note - optionally moving the lead on and setting its next follow-up. */
export async function addActivity(
  session: Session,
  projectId: string,
  leadId: string,
  input: LeadActivityInput,
): Promise<LeadRow> {
  const before = await leadFor(projectId, leadId)
  await assertCanWork(session, projectId, before.assigneeId)
  const stageMoved = !!input.stage && input.stage !== before.stage
  const followUpMoved =
    input.nextFollowUp !== undefined &&
    (input.nextFollowUp ?? null) !== (before.nextFollowUp ? toDateOnly(before.nextFollowUp) : null)

  await db.$transaction([
    ...(stageMoved
      ? [
          db.salesLeadActivity.create({
            data: {
              leadId,
              actorId: session.user.id,
              kind: "STAGE",
              fromStage: before.stage,
              toStage: input.stage,
            },
          }),
        ]
      : []),
    // After the stage change, so the call (not the stage) is the lead's latest activity.
    db.salesLeadActivity.create({
      data: { leadId, actorId: session.user.id, kind: input.kind, note: input.note ?? null },
    }),
    db.salesLead.update({
      where: { id: leadId },
      data: {
        ...(stageMoved ? { stage: input.stage } : {}),
        ...(input.nextFollowUp === undefined
          ? {}
          : { nextFollowUp: input.nextFollowUp ? asDate(input.nextFollowUp) : null }),
        ...(followUpMoved ? { followUpRemindedOn: null } : {}),
      },
    }),
  ])
  const lead = await db.salesLead.findUniqueOrThrow({ where: { id: leadId }, select: LEAD_SELECT })
  return toRow(lead)
}

/**
 * Once a day: each open lead whose follow-up has come tells its assignee (or, unassigned, the
 * project's BD owner, else its Account Manager) - once per follow-up date.
 */
export async function runSalesFollowUps(
  now = new Date(),
): Promise<{ sent: number; skipped: boolean }> {
  const today = indiaToday(now)
  const todayDate = asDate(today)
  try {
    await db.digestRun.create({ data: { kind: "sales-follow-ups", periodStart: todayDate } })
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return { sent: 0, skipped: true }
    throw err
  }

  const due = await db.salesLead.findMany({
    where: {
      stage: { notIn: ["WON", "LOST"] },
      doNotContact: false,
      nextFollowUp: { lte: todayDate },
      project: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    },
    select: {
      id: true,
      business: true,
      area: true,
      nextFollowUp: true,
      followUpRemindedOn: true,
      assigneeId: true,
      project: {
        select: {
          id: true,
          slug: true,
          name: true,
          ownerId: true,
          serviceOwners: { where: { service: "BD" }, select: { employeeId: true } },
        },
      },
    },
  })
  const fresh = due.filter((l) => l.followUpRemindedOn?.getTime() !== l.nextFollowUp!.getTime())
  type Note = Parameters<typeof createNotifications>[0][number]
  const notes: Note[] = []
  for (const l of fresh) {
    const to = l.assigneeId ?? l.project.serviceOwners[0]?.employeeId ?? l.project.ownerId
    if (!to) continue
    const late = -daysFromTo(today, toDateOnly(l.nextFollowUp!))
    notes.push({
      employeeId: to,
      title: late > 0 ? `Follow-up overdue: ${l.business}` : `Follow up today: ${l.business}`,
      message: `${l.project.name}${l.area ? ` - ${l.area}` : ""}${
        late > 0 ? `. It was due ${late} day${late === 1 ? "" : "s"} ago.` : "."
      }`,
      type: late > 0 ? "warning" : "info",
      link: projectHref(l.project, "sales", { lead: l.id }),
    })
  }
  if (notes.length) await createNotifications(notes)
  for (const l of fresh) {
    await db.salesLead.update({
      where: { id: l.id },
      data: { followUpRemindedOn: l.nextFollowUp },
    })
  }
  return { sent: notes.length, skipped: false }
}
