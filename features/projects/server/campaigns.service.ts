import "server-only"

import type { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors"
import { createNotifications } from "@/lib/notifications"
import { addDays, daysFromTo, indiaToday, toDateOnly } from "@/lib/dates"
import {
  campaignDatesProblem,
  campaignTiming,
  planProgress,
  reminderStage,
  type CampaignTiming,
  type ReminderStage,
} from "../lib/campaigns"
import { formatMonth } from "../lib/calendar-months"
import { projectHref } from "../lib/project-href"
import { normaliseServices, serviceInfo, serviceTeams } from "../lib/project-services"
import type { WorkbookTeamStatus } from "../lib/workbook-team-progress"
import type { CreateCampaignInput, UpdateCampaignInput } from "../schemas/campaign.schema"
import { createSheet, createWorkbook, renameWorkbook } from "./sheets.service"

const asDate = (d: string) => new Date(`${d}T00:00:00.000Z`)
const PERSON = { id: true, firstName: true, lastName: true, profilePhoto: true } as const

export interface CampaignRow {
  id: string
  name: string
  brief: string | null
  startDate: string
  deadline: string
  services: string[]
  owner: { id: string; firstName: string; lastName: string; profilePhoto: string | null } | null
  /** The campaign's own calendar. */
  workbookId: string | null
  timing: CampaignTiming
  progress: { total: number; done: number; stuck: number; overdue: number }
  teams: { name: string; status: WorkbookTeamStatus; dueOn: string | null; quantity: number }[]
}

const CAMPAIGN_SELECT = {
  id: true,
  name: true,
  brief: true,
  startDate: true,
  deadline: true,
  services: true,
  owner: { select: PERSON },
  workbook: {
    select: {
      id: true,
      teams: {
        select: { status: true, dueOn: true, quantity: true, team: { select: { name: true } } },
      },
    },
  },
} as const

type StoredCampaign = {
  id: string
  name: string
  brief: string | null
  startDate: Date
  deadline: Date
  services: string[]
  owner: CampaignRow["owner"]
  workbook: {
    id: string
    teams: {
      status: WorkbookTeamStatus
      dueOn: Date | null
      quantity: number
      team: { name: string }
    }[]
  } | null
}

function toRow(c: StoredCampaign, today: string): CampaignRow {
  const startDate = toDateOnly(c.startDate)
  const deadline = toDateOnly(c.deadline)
  const teams = (c.workbook?.teams ?? []).map((t) => ({
    name: t.team.name,
    status: t.status,
    dueOn: t.dueOn ? toDateOnly(t.dueOn) : null,
    quantity: t.quantity,
  }))
  return {
    id: c.id,
    name: c.name,
    brief: c.brief,
    startDate,
    deadline,
    services: c.services,
    owner: c.owner,
    workbookId: c.workbook?.id ?? null,
    timing: campaignTiming({ startDate, deadline }, today),
    progress: planProgress(teams, today),
    teams,
  }
}

const STATE_ORDER = { LIVE: 0, UPCOMING: 1, ENDED: 2 } as const

/** Live ones first (nearest deadline on top), then upcoming (soonest first), then past (latest first). */
function byTiming(a: CampaignRow, b: CampaignRow): number {
  const s = STATE_ORDER[a.timing.state] - STATE_ORDER[b.timing.state]
  if (s) return s
  if (a.timing.state === "LIVE") return a.deadline.localeCompare(b.deadline)
  if (a.timing.state === "UPCOMING") return a.startDate.localeCompare(b.startDate)
  return b.deadline.localeCompare(a.deadline)
}

export async function listCampaigns(projectId: string): Promise<CampaignRow[]> {
  const rows = await db.plannerCampaign.findMany({
    where: { projectId },
    select: CAMPAIGN_SELECT,
  })
  const today = indiaToday()
  return rows.map((r) => toRow(r, today)).sort(byTiming)
}

export async function getCampaign(projectId: string, campaignId: string) {
  return db.plannerCampaign.findFirst({
    where: { id: campaignId, projectId },
    select: { id: true, ownerId: true },
  })
}

/** Default owner: whoever owns Campaign Planning on the project, else its Account Manager. */
async function defaultOwner(projectId: string): Promise<string | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      serviceOwners: { where: { service: "CAMP" }, select: { employeeId: true } },
    },
  })
  return project?.serviceOwners[0]?.employeeId ?? project?.ownerId ?? null
}

/** One tab per service taking part, named after the service. */
const tabName = (code: string) => serviceInfo(code)?.name ?? code

/**
 * A campaign and its own calendar: one tab per service, and a team plan (due on the deadline) for
 * every team that usually makes those services - ready to staff, quantify and date.
 */
export async function createCampaign(
  projectId: string,
  actorId: string,
  input: CreateCampaignInput,
): Promise<CampaignRow> {
  const problem = campaignDatesProblem(input.startDate, input.deadline)
  if (problem) throw new ValidationError(problem)
  const services = normaliseServices(input.services)
  if (services.length === 0) throw new ValidationError("Pick at least one service")
  const name = input.name.trim()

  if (await db.plannerCampaign.findFirst({ where: { projectId, name }, select: { id: true } })) {
    throw new ConflictError(`There is already a campaign called "${name}" on this project`)
  }
  const ownerId = input.ownerId ?? (await defaultOwner(projectId))

  const campaign = await db.plannerCampaign.create({
    data: {
      projectId,
      name,
      brief: input.brief || null,
      startDate: asDate(input.startDate),
      deadline: asDate(input.deadline),
      ownerId,
      services,
      createdById: actorId,
    },
    select: { id: true },
  })

  try {
    const [first, ...rest] = services
    const book = await createWorkbook(projectId, actorId, { name, firstTab: tabName(first!) })
    for (const code of rest) {
      await createSheet(projectId, actorId, { workbookId: book.id, name: tabName(code) })
    }
    await db.projectWorkbook.update({
      where: { id: book.id },
      data: { campaignId: campaign.id, assignedToId: ownerId },
    })

    const usual = new Set(services.flatMap((code) => serviceTeams(code)))
    const teams = await db.projectTeam.findMany({
      where: { projectId, name: { in: [...usual] } },
      select: { id: true },
    })
    for (const t of teams) {
      await db.projectWorkbookTeam.create({
        data: {
          workbookId: book.id,
          teamId: t.id,
          dueOn: asDate(input.deadline),
          createdById: actorId,
        },
      })
    }
  } catch (err) {
    // No half-made campaign: its calendar goes with it (cascade).
    await db.plannerCampaign.delete({ where: { id: campaign.id } }).catch(() => undefined)
    if (err instanceof Error && !(err instanceof ValidationError)) {
      throw new ValidationError(err.message)
    }
    throw err
  }

  const row = await db.plannerCampaign.findUniqueOrThrow({
    where: { id: campaign.id },
    select: CAMPAIGN_SELECT,
  })
  return toRow(row, indiaToday())
}

/** Edits the campaign; a renamed campaign renames its calendar, new services get their tab. */
export async function updateCampaign(
  projectId: string,
  campaignId: string,
  input: UpdateCampaignInput,
): Promise<CampaignRow> {
  const before = await db.plannerCampaign.findFirst({
    where: { id: campaignId, projectId },
    select: {
      name: true,
      startDate: true,
      deadline: true,
      ownerId: true,
      services: true,
      startNotifiedAt: true,
      workbook: { select: { id: true, assignedToId: true } },
    },
  })
  if (!before) throw new NotFoundError("Campaign")

  const startDate = input.startDate ?? toDateOnly(before.startDate)
  const deadline = input.deadline ?? toDateOnly(before.deadline)
  const problem = campaignDatesProblem(startDate, deadline)
  if (problem) throw new ValidationError(problem)

  const name = input.name?.trim()
  if (name && name !== before.name) {
    const clash = await db.plannerCampaign.findFirst({
      where: { projectId, name, id: { not: campaignId } },
      select: { id: true },
    })
    if (clash)
      throw new ConflictError(`There is already a campaign called "${name}" on this project`)
    if (before.workbook) {
      try {
        await renameWorkbook(before.workbook.id, name)
      } catch (err) {
        throw new ValidationError(
          err instanceof Error ? err.message : "Could not rename its calendar",
        )
      }
    }
  }

  const services = input.services ? normaliseServices(input.services) : before.services
  if (services.length === 0) throw new ValidationError("Pick at least one service")
  // Tabs are never removed here: a dropped service's tab may already hold work.
  if (before.workbook) {
    for (const code of services.filter((c) => !before.services.includes(c))) {
      await createSheet(projectId, null, { workbookId: before.workbook.id, name: tabName(code) })
    }
  }

  const ownerId = input.ownerId === undefined ? before.ownerId : input.ownerId
  // The calendar follows a new owner unless someone else was put in charge of it.
  if (
    before.workbook &&
    ownerId !== before.ownerId &&
    (before.workbook.assignedToId === before.ownerId || !before.workbook.assignedToId)
  ) {
    await db.projectWorkbook.update({
      where: { id: before.workbook.id },
      data: { assignedToId: ownerId },
    })
  }

  // Team plans still due on the old deadline (as created) follow it; hand-set dates stay.
  if (before.workbook && deadline !== toDateOnly(before.deadline)) {
    await db.projectWorkbookTeam.updateMany({
      where: { workbookId: before.workbook.id, dueOn: before.deadline },
      data: {
        dueOn: asDate(deadline),
        soonRemindedAt: null,
        dueRemindedAt: null,
        overdueRemindedAt: null,
      },
    })
  }

  // A start moved into the future is announced again when it comes.
  const restart = !!input.startDate && input.startDate > indiaToday() && !!before.startNotifiedAt

  const row = await db.plannerCampaign.update({
    where: { id: campaignId },
    data: {
      ...(name ? { name } : {}),
      ...(input.brief !== undefined ? { brief: input.brief || null } : {}),
      startDate: asDate(startDate),
      deadline: asDate(deadline),
      ownerId,
      services,
      ...(restart ? { startNotifiedAt: null } : {}),
    },
    select: CAMPAIGN_SELECT,
  })
  return toRow(row, indiaToday())
}

/** Deletes the campaign and its calendar (tabs, rows, team plans). */
export async function deleteCampaign(projectId: string, campaignId: string): Promise<void> {
  const found = await db.plannerCampaign.findFirst({
    where: { id: campaignId, projectId },
    select: { id: true },
  })
  if (!found) throw new NotFoundError("Campaign")
  await db.plannerCampaign.delete({ where: { id: campaignId } })
}

const shortDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })

/** Overdue reminders only for work that fell due recently - not months-old history. */
const OVERDUE_LOOKBACK_DAYS = 7

const STAGE_TITLE: Record<ReminderStage, (n: number) => string> = {
  SOON: (n) => (n === 1 ? "Due tomorrow" : `Due in ${n} days`),
  DUE: () => "Due today",
  OVERDUE: () => "Overdue",
}

/**
 * Once a day: campaigns that start today are announced to everyone on them; open team plans (on
 * monthly and campaign calendars) remind their people 3 days before, on the day, and once late -
 * late ones also tell the calendar's owner and the campaign owner; and each live campaign's owner
 * hears which teams are behind.
 */
export async function runPlannerReminders(
  now = new Date(),
): Promise<{ sent: number; skipped: boolean }> {
  const today = indiaToday(now)
  const todayDate = asDate(today)
  try {
    await db.digestRun.create({ data: { kind: "planner-reminders", periodStart: todayDate } })
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return { sent: 0, skipped: true }
    throw err
  }

  type Note = Parameters<typeof createNotifications>[0][number]
  const notes: Note[] = []
  const LIVE_PROJECT: Prisma.ProjectWhereInput = { status: { notIn: ["COMPLETED", "CANCELLED"] } }

  // 1. Campaigns starting.
  const starting = await db.plannerCampaign.findMany({
    where: {
      startNotifiedAt: null,
      startDate: { lte: todayDate },
      deadline: { gte: todayDate },
      project: LIVE_PROJECT,
    },
    select: {
      id: true,
      name: true,
      deadline: true,
      ownerId: true,
      project: { select: { id: true, slug: true, name: true } },
      workbook: {
        select: {
          id: true,
          assignedToId: true,
          secondaryAssignedToId: true,
          teams: {
            select: {
              dueOn: true,
              team: { select: { name: true } },
              members: { select: { employeeId: true } },
            },
          },
        },
      },
    },
  })
  for (const c of starting) {
    const link = projectHref(c.project, "calendar", { calendar: c.workbook?.id })
    const parts = new Map<string, string[]>()
    for (const t of c.workbook?.teams ?? []) {
      const part = `${t.team.name}${t.dueOn ? ` (due ${shortDate(t.dueOn)})` : ""}`
      for (const m of t.members) parts.set(m.employeeId, [...(parts.get(m.employeeId) ?? []), part])
    }
    const leads = [c.ownerId, c.workbook?.assignedToId, c.workbook?.secondaryAssignedToId]
    for (const id of leads) if (id && !parts.has(id)) parts.set(id, [])
    for (const [employeeId, mine] of parts) {
      notes.push({
        employeeId,
        title: `${c.name} has started`,
        message: `${c.project.name}: runs till ${shortDate(c.deadline)}.${
          mine.length ? ` Your part: ${mine.join(", ")}.` : ""
        }`,
        type: "info",
        link,
      })
    }
  }
  if (starting.length) {
    await db.plannerCampaign.updateMany({
      where: { id: { in: starting.map((c) => c.id) } },
      data: { startNotifiedAt: new Date() },
    })
  }

  // 2. Team plan due dates.
  const plans = await db.projectWorkbookTeam.findMany({
    where: {
      status: { notIn: ["DONE", "DISCARDED"] },
      dueOn: {
        gte: asDate(toDateOnly(addDays(todayDate, -OVERDUE_LOOKBACK_DAYS))),
        lte: asDate(toDateOnly(addDays(todayDate, 3))),
      },
      workbook: { project: LIVE_PROJECT },
    },
    select: {
      id: true,
      status: true,
      dueOn: true,
      quantity: true,
      soonRemindedAt: true,
      dueRemindedAt: true,
      overdueRemindedAt: true,
      team: { select: { name: true } },
      members: { select: { employeeId: true } },
      workbook: {
        select: {
          id: true,
          name: true,
          periodMonth: true,
          assignedToId: true,
          campaign: { select: { name: true, ownerId: true } },
          project: { select: { id: true, slug: true, name: true } },
        },
      },
    },
  })
  const stamped: Record<ReminderStage, string[]> = { SOON: [], DUE: [], OVERDUE: [] }
  for (const p of plans) {
    const dueOn = toDateOnly(p.dueOn!)
    const stage = reminderStage({ status: p.status, dueOn }, today)
    if (!stage) continue
    const already =
      stage === "SOON" ? p.soonRemindedAt : stage === "DUE" ? p.dueRemindedAt : p.overdueRemindedAt
    if (already) continue
    stamped[stage].push(p.id)

    const w = p.workbook
    const where = w.campaign
      ? w.campaign.name
      : `${w.name}${w.periodMonth ? ` (${formatMonth(toDateOnly(w.periodMonth))})` : ""}`
    const people = new Set(p.members.map((m) => m.employeeId))
    if (stage === "OVERDUE") {
      if (w.assignedToId) people.add(w.assignedToId)
      if (w.campaign?.ownerId) people.add(w.campaign.ownerId)
    }
    const left = daysFromTo(today, dueOn)
    for (const employeeId of people) {
      notes.push({
        employeeId,
        title: `${STAGE_TITLE[stage](left)}: ${p.team.name}`,
        message: `${where} in ${w.project.name}: ${
          p.quantity > 0 ? `${p.quantity} to deliver` : "the team's plan"
        }, due ${shortDate(p.dueOn!)}.`,
        type: stage === "OVERDUE" ? "warning" : "info",
        link: projectHref(w.project, "calendar", { calendar: w.id }),
      })
    }
  }
  const stampNow = new Date()
  if (stamped.SOON.length) {
    await db.projectWorkbookTeam.updateMany({
      where: { id: { in: stamped.SOON } },
      data: { soonRemindedAt: stampNow },
    })
  }
  if (stamped.DUE.length) {
    await db.projectWorkbookTeam.updateMany({
      where: { id: { in: stamped.DUE } },
      data: { dueRemindedAt: stampNow },
    })
  }
  if (stamped.OVERDUE.length) {
    await db.projectWorkbookTeam.updateMany({
      where: { id: { in: stamped.OVERDUE } },
      data: { overdueRemindedAt: stampNow },
    })
  }

  // 3. Each live campaign's owner: who is behind.
  const live = await db.plannerCampaign.findMany({
    where: {
      ownerId: { not: null },
      startDate: { lte: todayDate },
      deadline: { gte: todayDate },
      project: LIVE_PROJECT,
    },
    select: {
      name: true,
      ownerId: true,
      deadline: true,
      project: { select: { id: true, slug: true, name: true } },
      workbook: {
        select: {
          id: true,
          teams: {
            where: { status: { notIn: ["DONE", "DISCARDED"] }, dueOn: { lt: todayDate } },
            select: { team: { select: { name: true } } },
          },
        },
      },
    },
  })
  for (const c of live) {
    const behind = (c.workbook?.teams ?? []).map((t) => t.team.name)
    if (!behind.length || !c.ownerId) continue
    notes.push({
      employeeId: c.ownerId,
      title: `${c.name}: ${behind.length} team${behind.length === 1 ? "" : "s"} behind`,
      message: `${c.project.name}: ${behind.join(", ")} past due. Deadline ${shortDate(c.deadline)}.`,
      type: "warning",
      link: projectHref(c.project, "calendar", { calendar: c.workbook?.id }),
    })
  }

  if (notes.length) await createNotifications(notes)
  return { sent: notes.length, skipped: false }
}
