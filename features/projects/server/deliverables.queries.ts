import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { todayUtc } from "@/lib/dates"
import { getCachedSignedUrl } from "@/lib/storage"
import { suggestTypesForTeams, typeKey } from "../lib/deliverable-types"
import { sortProjectTeams } from "../lib/project-teams"
import {
  MADE_STATUSES,
  OPEN_STATUSES,
  STATUS_ORDER,
  isOpenStatus,
  periodOpen,
  splitTaskHours,
  type DeliverableStatus,
} from "../lib/deliverable-lifecycle"

// Deliverables ledger reads. Counts SUM `quantity` and group by lower-cased type (first casing
// shown). Headline tallies cover MADE work only; a task's hours are split across its deliverables
// by quantity over its WHOLE output. Portfolio scope mirrors canAccessProject.

export interface DeliverableFile {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  url: string
}

export interface DeliverableRow {
  id: string
  projectId: string
  project: { id: string; name: string; code: string; slug: string | null }
  team: { id: string; name: string } | null
  /** The maker. Null while the row is still owed by the team and unclaimed. */
  employee: { id: string; name: string; profilePhoto: string | null } | null
  loggedByName: string | null
  /** The client asked for this one through the portal, rather than the team planning it. */
  plannedByClient: boolean
  task: { id: string; title: string } | null
  goal: { id: string; title: string } | null
  type: string
  title: string
  quantity: number
  /** How many of `quantity` are made. Moves as work lands, without the status. */
  deliveredQuantity: number
  status: DeliverableStatus
  startedOn: string | null
  /** Null only while the row is owed. */
  completedOn: string | null
  dueOn: string | null
  /** The window this covers. Both set, or both null. */
  periodStart: string | null
  periodEnd: string | null
  revisionCount: number
  /** Stage two: the account manager's sign-off. */
  acceptedAt: string | null
  acceptedByName: string | null
  /** The client signed it off themselves, rather than staff recording their word. */
  acceptedByClient: boolean
  /** Stage one: the maker's manager checked it. Null if it went straight to the account manager. */
  verifiedByName: string | null
  verifiedAt: string | null
  /** Who last sent it back, and why - from the event log, since the row only holds current state. */
  sentBack: {
    by: string | null
    reason: string | null
    at: string
    /** Sent back by the client, not by a manager. Different thing to answer. */
    byClient: boolean
  } | null
  links: string[]
  notes: string | null
  files: DeliverableFile[]
  verified: boolean
  /** The period has closed: only a project manager may still change this row. */
  locked: boolean
  /** This row's share of its task's hours, or null when there is no task. */
  hours: number | null
  hoursPerUnit: number | null
  createdAt: string
}

export interface DeliverableEventRow {
  id: string
  type: "CREATED" | "EDITED" | "STATUS_CHANGED" | "VERIFIED" | "UNVERIFIED" | "LOCKED_EDIT"
  fromStatus: DeliverableStatus | null
  toStatus: DeliverableStatus | null
  changes: Record<string, [unknown, unknown]> | null
  reason: string | null
  actorName: string | null
  actorIsClient: boolean
  createdAt: string
}

export interface DeliverableFilters {
  projectId?: string
  employeeId?: string
  teamId?: string
  type?: string
  taskId?: string
  /** Narrows the rows AND the tallies. Omitted = made work only in the tallies. */
  status?: DeliverableStatus[]
  from?: string | null
  to?: string | null
}

export interface TypeCount {
  type: string
  count: number
  /** Average task hours per unit of this type, or null when no task was linked. */
  hoursPerUnit: number | null
}

export interface DeliverablesOverview {
  total: number
  entries: number
  byType: TypeCount[]
  byProject: {
    id: string
    name: string
    code: string
    slug: string | null
    count: number
    byType: TypeCount[]
  }[]
  byPerson: {
    id: string
    name: string
    profilePhoto: string | null
    teamName: string | null
    count: number
    byType: TypeCount[]
  }[]
  /** Per team, portfolio-wide; rows carry the project since "WEB" repeats across projects. */
  byTeam: {
    /** The team's id, or `__no_team__:<projectId>` for output logged team-less. */
    id: string
    name: string
    projectId: string
    projectName: string
    projectCode: string
    count: number
    byType: TypeCount[]
  }[]
  /** Monday-start weeks inside the range (or the last 8 when there is none). */
  byWeek: { weekStart: string; count: number }[]
  /** Every status in scope, whether or not it is in the tallies. */
  byStatus: { status: DeliverableStatus; entries: number; quantity: number }[]
  /** Owed work: promised, nothing made yet. `overdue` counts entries past due. */
  planned: { entries: number; quantity: number; overdue: number }
  /** Effort behind the output. `coverage` = share of counted units with a task to take hours from. */
  hours: { attributed: number; attributedUnits: number; perUnit: number | null; coverage: number }
  /** Every type in use across the scope, first-seen casing, for filters. */
  types: string[]
  /** Type-ahead for a form: the team's starter set plus what the project uses. */
  suggestedTypes: string[]
  rows: DeliverableRow[]
  truncated: boolean
}

const ymd = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null)

/** Rounded to a sane number of decimals - these are estimates, not invoices. */
const round2 = (n: number): number => Math.round(n * 100) / 100

export function scopeWhere(session: Session): Prisma.ProjectDeliverableWhereInput {
  if (
    hasPermission(session, PERMISSIONS.PROJECT_READ) ||
    hasPermission(session, PERMISSIONS.PROJECT_WRITE)
  ) {
    return {}
  }
  return {
    project: {
      OR: [
        { ownerId: session.user.id },
        { teams: { some: { members: { some: { employeeId: session.user.id } } } } },
      ],
    },
  }
}

export function filterWhere(f: DeliverableFilters): Prisma.ProjectDeliverableWhereInput {
  return {
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(f.employeeId ? { employeeId: f.employeeId } : {}),
    ...(f.teamId ? { teamId: f.teamId } : {}),
    ...(f.taskId ? { taskId: f.taskId } : {}),
    ...(f.status?.length ? { status: { in: f.status } } : {}),
    ...(f.type ? { type: { equals: f.type, mode: "insensitive" } } : {}),
    ...(f.from || f.to
      ? {
          completedOn: {
            ...(f.from ? { gte: new Date(`${f.from}T00:00:00.000Z`) } : {}),
            ...(f.to ? { lte: new Date(`${f.to}T00:00:00.000Z`) } : {}),
          },
        }
      : {}),
  }
}

const ROW_SELECT = {
  id: true,
  projectId: true,
  type: true,
  title: true,
  quantity: true,
  deliveredQuantity: true,
  status: true,
  startedOn: true,
  completedOn: true,
  dueOn: true,
  periodStart: true,
  periodEnd: true,
  revisionCount: true,
  acceptedAt: true,
  links: true,
  notes: true,
  verifiedAt: true,
  createdAt: true,
  taskId: true,
  project: { select: { id: true, name: true, code: true, slug: true } },
  team: { select: { id: true, name: true } },
  employee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
  loggedBy: { select: { firstName: true, lastName: true } },
  acceptedBy: { select: { firstName: true, lastName: true } },
  // Portal side of the same questions; exactly one of each pair is set.
  loggedByClient: { select: { name: true } },
  acceptedByClient: { select: { name: true } },
  verifiedBy: { select: { firstName: true, lastName: true } },
  // Only the latest bounce - full history per row would bloat a long list.
  events: {
    where: { toStatus: "REJECTED" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      reason: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true } },
      actorClient: { select: { name: true } },
    },
  },
  goal: { select: { id: true, title: true } },
  task: { select: { id: true, title: true, loggedHours: true } },
  files: {
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      objectKey: true,
      driveWebViewLink: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.ProjectDeliverableSelect

type RawRow = Prisma.ProjectDeliverableGetPayload<{ select: typeof ROW_SELECT }>

/** The last send-back, kept after the row moves on - it shows the item took two goes, and why. */
function bounce(
  events: readonly {
    reason: string | null
    createdAt: Date
    actor: { firstName: string; lastName: string } | null
    actorClient: { name: string } | null
  }[],
): { by: string | null; reason: string | null; at: string; byClient: boolean } | null {
  const last = events[0]
  if (!last) return null
  // A client bounce and a manager bounce read differently, so say which.
  const byClient = !last.actor && !!last.actorClient
  return {
    by: fullName(last.actor) ?? last.actorClient?.name ?? null,
    reason: last.reason,
    at: last.createdAt.toISOString(),
    byClient,
  }
}
const fullName = (p: { firstName: string; lastName: string | null } | null) =>
  p ? `${p.firstName} ${p.lastName ?? ""}`.trim() : null

/** Each task's total output, NOT date/person filtered, so a row's hour share is stable. */
export async function quantityByTask(taskIds: string[]): Promise<Map<string, number>> {
  if (taskIds.length === 0) return new Map()
  const grouped = await db.projectDeliverable.groupBy({
    by: ["taskId"],
    where: { taskId: { in: taskIds }, status: { in: [...MADE_STATUSES] } },
    _sum: { quantity: true },
  })
  const map = new Map<string, number>()
  for (const g of grouped) {
    if (g.taskId) map.set(g.taskId, g._sum.quantity ?? 0)
  }
  return map
}

function rowHours(
  r: { taskId: string | null; quantity: number; task: { loggedHours: number } | null },
  qtyByTask: Map<string, number>,
): number | null {
  if (!r.taskId || !r.task) return null
  return round2(
    splitTaskHours(r.task.loggedHours, r.quantity, qtyByTask.get(r.taskId) ?? r.quantity),
  )
}

async function toRow(
  r: RawRow,
  qtyByTask: Map<string, number>,
  today: Date,
): Promise<DeliverableRow> {
  const files = await Promise.all(
    r.files.map(async (f) => ({
      id: f.id,
      fileName: f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      // Signed URLs come from the cache (re-signing on every load wastes B2 calls). Drive videos use
      // their durable viewer link.
      url: f.objectKey
        ? await getCachedSignedUrl(f.objectKey, 3600).catch(() => "")
        : (f.driveWebViewLink ?? ""),
    })),
  )
  const hours = rowHours(r, qtyByTask)
  return {
    id: r.id,
    projectId: r.projectId,
    project: r.project,
    team: r.team,
    employee: r.employee
      ? {
          id: r.employee.id,
          name: fullName(r.employee) ?? "",
          profilePhoto: r.employee.profilePhoto,
        }
      : null,
    loggedByName: fullName(r.loggedBy) ?? r.loggedByClient?.name ?? null,
    // The board marks client-requested rows.
    plannedByClient: !r.loggedBy && !!r.loggedByClient,
    task: r.task ? { id: r.task.id, title: r.task.title } : null,
    goal: r.goal,
    type: r.type,
    title: r.title,
    quantity: r.quantity,
    deliveredQuantity: r.deliveredQuantity,
    status: r.status,
    startedOn: ymd(r.startedOn),
    completedOn: ymd(r.completedOn),
    dueOn: ymd(r.dueOn),
    periodStart: ymd(r.periodStart),
    periodEnd: ymd(r.periodEnd),
    revisionCount: r.revisionCount,
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    acceptedByName: fullName(r.acceptedBy) ?? r.acceptedByClient?.name ?? null,
    acceptedByClient: !r.acceptedBy && !!r.acceptedByClient,
    verifiedByName: fullName(r.verifiedBy),
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    sentBack: bounce(r.events),
    links: r.links,
    notes: r.notes,
    files,
    verified: r.verifiedAt !== null,
    locked: !periodOpen(r.completedOn, today),
    hours,
    hoursPerUnit: hours !== null && r.quantity > 0 ? round2(hours / r.quantity) : null,
    createdAt: r.createdAt.toISOString(),
  }
}

/** Sums quantity per lower-cased type (first casing kept) plus the hours attributed to it. */
class TypeTally {
  private counts = new Map<string, { type: string; count: number; hours: number; units: number }>()
  add(type: string, qty: number, hours: number | null) {
    const k = typeKey(type)
    const cur = this.counts.get(k) ?? { type, count: 0, hours: 0, units: 0 }
    cur.count += qty
    if (hours !== null) {
      cur.hours += hours
      cur.units += qty
    }
    this.counts.set(k, cur)
  }
  list(): TypeCount[] {
    return [...this.counts.values()]
      .map((c) => ({
        type: c.type,
        count: c.count,
        hoursPerUnit: c.units > 0 ? round2(c.hours / c.units) : null,
      }))
      .sort((a, b) => b.count - a.count)
  }
}

const MAX_ROWS = 300

/** Team-less output gets its own bar per project (synthetic id; clicking opens the project). */
const NO_TEAM = "__no_team__"

/** Everything about deliverables in a scope; tallies are built from the same rows as the list. */
export async function getDeliverablesOverview(
  session: Session,
  filters: DeliverableFilters,
): Promise<DeliverablesOverview> {
  const where: Prisma.ProjectDeliverableWhereInput = {
    AND: [scopeWhere(session), filterWhere(filters)],
  }
  const today = todayUtc()

  // Tallies use EVERY matching row (slim select); only the rendered list is capped.
  const [slim, raw] = await Promise.all([
    db.projectDeliverable.findMany({
      where,
      select: {
        type: true,
        quantity: true,
        status: true,
        completedOn: true,
        dueOn: true,
        projectId: true,
        employeeId: true,
        teamId: true,
        taskId: true,
        task: { select: { loggedHours: true } },
        project: { select: { name: true, code: true, slug: true } },
        employee: { select: { firstName: true, lastName: true, profilePhoto: true } },
        team: { select: { name: true } },
      },
    }),
    db.projectDeliverable.findMany({
      where,
      orderBy: [{ completedOn: "desc" }, { createdAt: "desc" }],
      take: MAX_ROWS,
      select: ROW_SELECT,
    }),
  ])

  const qtyByTask = await quantityByTask([
    ...new Set(slim.map((r) => r.taskId).filter((t): t is string => !!t)),
  ])

  // What the headline numbers cover: made work, or exactly what was asked for.
  const counted = new Set<DeliverableStatus>(
    filters.status?.length ? filters.status : [...MADE_STATUSES],
  )

  const byType = new TypeTally()
  const projects = new Map<
    string,
    { id: string; name: string; code: string; slug: string | null; count: number; tally: TypeTally }
  >()
  const people = new Map<
    string,
    {
      id: string
      name: string
      profilePhoto: string | null
      teamNames: Set<string>
      count: number
      tally: TypeTally
    }
  >()
  const teams = new Map<
    string,
    {
      id: string
      name: string
      projectId: string
      projectName: string
      projectCode: string
      count: number
      tally: TypeTally
    }
  >()
  const weeks = new Map<string, number>()
  const statuses = new Map<DeliverableStatus, { entries: number; quantity: number }>()
  const planned = { entries: 0, quantity: 0, overdue: 0 }
  let total = 0
  let entries = 0
  let attributed = 0
  let attributedUnits = 0

  for (const r of slim) {
    const bucket = statuses.get(r.status) ?? { entries: 0, quantity: 0 }
    bucket.entries += 1
    bucket.quantity += r.quantity
    statuses.set(r.status, bucket)

    if (isOpenStatus(r.status)) {
      planned.entries += 1
      planned.quantity += r.quantity
      if (r.dueOn && r.dueOn < today) planned.overdue += 1
    }

    if (!counted.has(r.status)) continue

    const hours = rowHours(r, qtyByTask)
    total += r.quantity
    entries += 1
    if (hours !== null) {
      attributed += hours
      attributedUnits += r.quantity
    }
    byType.add(r.type, r.quantity, hours)

    const p = projects.get(r.projectId) ?? {
      id: r.projectId,
      name: r.project.name,
      code: r.project.code,
      slug: r.project.slug,
      count: 0,
      tally: new TypeTally(),
    }
    p.count += r.quantity
    p.tally.add(r.type, r.quantity, hours)
    projects.set(r.projectId, p)

    if (!r.employeeId || !r.employee) continue
    const who = people.get(r.employeeId) ?? {
      id: r.employeeId,
      name: fullName(r.employee) ?? "",
      profilePhoto: r.employee.profilePhoto,
      teamNames: new Set<string>(),
      count: 0,
      tally: new TypeTally(),
    }
    if (r.team?.name) who.teamNames.add(r.team.name)
    who.count += r.quantity
    who.tally.add(r.type, r.quantity, hours)
    people.set(r.employeeId, who)

    // Keyed by team id with the project attached, so two clients' "WEB" teams stay two bars.
    const teamKey = r.teamId ?? `${NO_TEAM}:${r.projectId}`
    const t = teams.get(teamKey) ?? {
      id: teamKey,
      name: r.teamId ? (r.team?.name ?? "Team") : "No team",
      projectId: r.projectId,
      projectName: r.project.name,
      projectCode: r.project.code,
      count: 0,
      tally: new TypeTally(),
    }
    t.count += r.quantity
    t.tally.add(r.type, r.quantity, hours)
    teams.set(teamKey, t)

    // Monday-start week of completion, UTC. Owed rows have no week to sit in.
    if (r.completedOn) {
      const d = new Date(r.completedOn)
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      const wk = ymd(d)!
      weeks.set(wk, (weeks.get(wk) ?? 0) + r.quantity)
    }
  }

  // Starter set from the named person's teams, else the caller's (usually the maker).
  let suggested: string[] = []
  if (filters.projectId) {
    const who = filters.employeeId ?? session.user.id
    const teamNames = (
      await db.projectTeamMember.findMany({
        where: { projectId: filters.projectId, employeeId: who },
        select: { team: { select: { name: true } } },
      })
    ).map((m) => m.team.name)
    const used = byType.list().map((t) => t.type)
    const seen = new Set(used.map(typeKey))
    suggested = [
      ...used,
      ...suggestTypesForTeams(
        sortProjectTeams(teamNames.map((name) => ({ name }))).map((t) => t.name),
      ).filter((t) => !seen.has(typeKey(t))),
    ]
  }

  const rows = await Promise.all(raw.map((r) => toRow(r, qtyByTask, today)))

  return {
    total,
    entries,
    byType: byType.list(),
    byProject: [...projects.values()]
      .map(({ tally, ...p }) => ({ ...p, byType: tally.list() }))
      .sort((a, b) => b.count - a.count),
    byPerson: [...people.values()]
      .map(({ tally, teamNames, ...p }) => ({
        ...p,
        teamName:
          sortProjectTeams([...teamNames].map((name) => ({ name })))
            .map((t) => t.name)
            .join(", ") || null,
        byType: tally.list(),
      }))
      .sort((a, b) => b.count - a.count),
    byTeam: [...teams.values()]
      .map(({ tally, ...t }) => ({ ...t, byType: tally.list() }))
      .sort((a, b) => b.count - a.count),
    byWeek: [...weeks.entries()]
      .map(([weekStart, count]) => ({ weekStart, count }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    byStatus: STATUS_ORDER.filter((s) => statuses.has(s)).map((status) => ({
      status,
      entries: statuses.get(status)!.entries,
      quantity: statuses.get(status)!.quantity,
    })),
    planned,
    hours: {
      attributed: round2(attributed),
      attributedUnits,
      perUnit: attributedUnits > 0 ? round2(attributed / attributedUnits) : null,
      coverage: total > 0 ? round2(attributedUnits / total) : 0,
    },
    types: byType.list().map((t) => t.type),
    suggestedTypes: suggested,
    rows,
    truncated: slim.length > rows.length,
  }
}

/** One row shaped like the ledger's, so writes can patch the list in place. */
export async function getDeliverableRow(
  session: Session,
  projectId: string,
  id: string,
): Promise<DeliverableRow | null> {
  const raw = await db.projectDeliverable.findFirst({
    where: { AND: [{ id, projectId }, scopeWhere(session)] },
    select: ROW_SELECT,
  })
  if (!raw) return null
  const qtyByTask = await quantityByTask(raw.taskId ? [raw.taskId] : [])
  return toRow(raw, qtyByTask, todayUtc())
}

/** The row's append-only history, oldest first. */
export async function listDeliverableEvents(
  session: Session,
  projectId: string,
  id: string,
): Promise<DeliverableEventRow[]> {
  const owner = await db.projectDeliverable.findFirst({
    where: { AND: [{ id, projectId }, scopeWhere(session)] },
    select: { id: true },
  })
  if (!owner) return []
  const events = await db.projectDeliverableEvent.findMany({
    where: { deliverableId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      fromStatus: true,
      toStatus: true,
      changes: true,
      reason: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true } },
      actorClient: { select: { name: true } },
    },
  })
  return events.map((e) => ({
    id: e.id,
    type: e.type,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    changes: (e.changes as unknown as DeliverableEventRow["changes"]) ?? null,
    reason: e.reason,
    actorName: fullName(e.actor) ?? e.actorClient?.name ?? null,
    actorIsClient: !e.actor && !!e.actorClient,
    createdAt: e.createdAt.toISOString(),
  }))
}

/** Owed work for ONE person: their rows + unclaimed rows of their teams. Most urgent first. */
export async function getMyOwedDeliverables(
  session: Session,
  opts: { limit?: number } = {},
): Promise<{ rows: DeliverableRow[]; overdue: number; unclaimed: number }> {
  const me = session.user.id
  const today = todayUtc()

  const raw = await db.projectDeliverable.findMany({
    where: {
      status: { in: [...OPEN_STATUSES] },
      OR: [
        { employeeId: me },
        // Unclaimed, and owed by a team this person is actually on.
        {
          employeeId: null,
          team: { members: { some: { employeeId: me } } },
        },
      ],
    },
    select: ROW_SELECT,
    orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: opts.limit ?? 100,
  })

  const qtyByTask = await quantityByTask(
    raw.map((r) => r.taskId).filter((id): id is string => !!id),
  )
  const rows = await Promise.all(raw.map((r) => toRow(r, qtyByTask, today)))

  return {
    rows,
    overdue: rows.filter((r) => r.dueOn && r.dueOn < ymd(today)!).length,
    unclaimed: rows.filter((r) => !r.employee).length,
  }
}
