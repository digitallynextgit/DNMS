import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { todayUtc } from "@/lib/dates"
import { getCachedSignedUrl } from "@/lib/storage"
import { suggestTypes, typeKey } from "../lib/deliverable-types"
import {
  MADE_STATUSES,
  OPEN_STATUSES,
  STATUS_ORDER,
  isOpenStatus,
  periodOpen,
  splitTaskHours,
  type DeliverableStatus,
} from "../lib/deliverable-lifecycle"

// =============================================================================
// Reading what was produced - one project's ledger, or the whole portfolio.
//
// Every count here SUMS `quantity` and GROUPS BY THE LOWER-CASED TYPE, so "10
// product pages" logged as one row counts as ten, and "reel"/"Reel" are one row
// in every breakdown. The first-seen casing is what gets displayed.
//
// ── WHICH ROWS COUNT ─────────────────────────────────────────────────────────
// The headline tallies cover what the team MADE (delivered, accepted, or sent
// back), not what it was asked for: an owed row is a promise and counting it as
// output would flatter every number on the page. Owed work gets its own tile
// (`planned`) and the full status split (`byStatus`) sits alongside, so "we made
// 40 and owe 6, two of them late" is one response. A caller that asks for
// specific statuses gets the tallies over exactly those.
//
// ── HOURS AGAINST OUTPUT ─────────────────────────────────────────────────────
// Hours live on the TASK and output lives here, so effort per thing is a join:
// a task's hours are split across its deliverables by quantity. The denominator
// is the task's WHOLE output, fetched independently of the date filter, so
// looking at one reel from a four-reel task still reads 2h and not 8h.
//
// Scope for the portfolio mirrors canAccessProject across the whole table:
// global readers see everything, everyone else the projects they own or sit on
// a team for. Kept in step with project-access.ts deliberately.
// =============================================================================

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
  task: { id: string; title: string } | null
  goal: { id: string; title: string } | null
  type: string
  title: string
  quantity: number
  status: DeliverableStatus
  startedOn: string | null
  /** Null only while the row is owed - there is nothing to date yet. */
  completedOn: string | null
  dueOn: string | null
  revisionCount: number
  acceptedAt: string | null
  acceptedByName: string | null
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
  /** Sum of quantity across every matching entry. */
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
  /**
   * Team output, portfolio-wide as well as inside one project. A team name is
   * only unique WITHIN its project - half the accounts have a "WEB" - so every
   * row carries the project it belongs to and the UI labels them "WEB · Acme".
   */
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
  /**
   * Effort behind the output. `coverage` is the share of counted units that had
   * a task to take hours from - a per-unit figure over 20% coverage is a
   * measurement, under it a rumour.
   */
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
  status: true,
  startedOn: true,
  completedOn: true,
  dueOn: true,
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
  goal: { select: { id: true, title: true } },
  task: { select: { id: true, title: true, loggedHours: true } },
  files: {
    select: { id: true, fileName: true, fileSize: true, mimeType: true, objectKey: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.ProjectDeliverableSelect

type RawRow = Prisma.ProjectDeliverableGetPayload<{ select: typeof ROW_SELECT }>

const fullName = (p: { firstName: string; lastName: string | null } | null) =>
  p ? `${p.firstName} ${p.lastName ?? ""}`.trim() : null

/**
 * How much of each task's output exists in total, so one row's share of its
 * task's hours does not change when the view is filtered. Deliberately NOT
 * constrained by the caller's date range or person filter.
 */
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

/** A row's share of its task's hours, or null when there is nothing to split. */
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
      // Inline-viewable for an hour, served from the signed-URL cache: a ledger
      // page lists many files and re-signing each on every load is wasted
      // round-trips to B2.
      url: await getCachedSignedUrl(f.objectKey, 3600).catch(() => ""),
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
    loggedByName: fullName(r.loggedBy),
    task: r.task ? { id: r.task.id, title: r.task.title } : null,
    goal: r.goal,
    type: r.type,
    title: r.title,
    quantity: r.quantity,
    status: r.status,
    startedOn: ymd(r.startedOn),
    completedOn: ymd(r.completedOn),
    dueOn: ymd(r.dueOn),
    revisionCount: r.revisionCount,
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    acceptedByName: fullName(r.acceptedBy),
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

/**
 * Tally helper: sums quantity per lower-cased type, remembers first casing, and
 * carries the hours attributed to that type so the UI can show "≈ 2.5h a reel".
 */
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

/**
 * Output logged without a team is still output, so it gets a bar of its own
 * rather than quietly dropping out of the team split - team bars that do not
 * add up to the project's total are a bug report. Same sentinel the task-side
 * byTeam uses (app/api/projects/performance/route.ts), suffixed with the
 * project because these rows span clients: two projects' teamless work is two
 * bars, not one merged one. It is a synthetic id, so a click on it opens the
 * PROJECT - there is no "team is null" filter to hand the drill-down.
 */
const NO_TEAM = "__no_team__"

/**
 * Everything about deliverables in a scope, in one response: the numbers the
 * charts need and the rows the lists need. One query for the rows; the tallies
 * are built from them in memory, so the by-type / by-person / by-team counts can
 * never disagree with the list they sit above.
 */
export async function getDeliverablesOverview(
  session: Session,
  filters: DeliverableFilters,
): Promise<DeliverablesOverview> {
  const where: Prisma.ProjectDeliverableWhereInput = {
    AND: [scopeWhere(session), filterWhere(filters)],
  }
  const today = todayUtc()

  // Tallies come from EVERY matching row (slim select); the rendered list is
  // capped. So a person with 400 entries still counts 400 in the donut.
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
      teamName: string | null
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

    // Unassigned rows are owed, never made, so they cannot reach here through
    // `counted` - but a per-PERSON tally has no bucket for "nobody" either way.
    if (!r.employeeId || !r.employee) continue
    const who = people.get(r.employeeId) ?? {
      id: r.employeeId,
      name: fullName(r.employee) ?? "",
      profilePhoto: r.employee.profilePhoto,
      teamName: r.team?.name ?? null,
      count: 0,
      tally: new TypeTally(),
    }
    who.count += r.quantity
    who.tally.add(r.type, r.quantity, hours)
    people.set(r.employeeId, who)

    // Team output is built for EVERY scope, not just one project: an admin
    // asking "how much did each team make" is the whole point of the split.
    // Keyed by team id (unique across the estate - teams belong to a project)
    // and carrying the project, so "WEB" from two clients stays two bars.
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

  // Type-ahead: the project's own vocabulary plus the team's starter set. The
  // team is the named person's, or failing that the CALLER's - the person
  // opening the form is nearly always the one who made the thing, and the
  // Deliverables tab asks without naming anyone.
  let suggested: string[] = []
  if (filters.projectId) {
    const who = filters.employeeId ?? session.user.id
    const teamName = (
      await db.projectTeamMember.findUnique({
        where: { projectId_employeeId: { projectId: filters.projectId, employeeId: who } },
        select: { team: { select: { name: true } } },
      })
    )?.team.name
    const used = byType.list().map((t) => t.type)
    const seen = new Set(used.map(typeKey))
    suggested = [...used, ...suggestTypes(teamName).filter((t) => !seen.has(typeKey(t)))]
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
      .map(({ tally, ...p }) => ({ ...p, byType: tally.list() }))
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

/**
 * One row, shaped exactly like a row in the ledger - what the write endpoints
 * hand back so a status change or a verify can patch the list in place instead
 * of forcing a refetch of the whole overview.
 */
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

/**
 * The row's history, oldest first - who moved it, when, and what changed.
 * Append-only by construction, so this is the whole answer to "why does this
 * number look different to the one I sent last month".
 */
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
    },
  })
  return events.map((e) => ({
    id: e.id,
    type: e.type,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    changes: (e.changes as unknown as DeliverableEventRow["changes"]) ?? null,
    reason: e.reason,
    actorName: fullName(e.actor),
    createdAt: e.createdAt.toISOString(),
  }))
}

// ─── What one person owes ─────────────────────────────────────────────────────

/**
 * The owed work in front of ONE person, across every project.
 *
 * Two kinds, because the handoff has two stages: rows with their name on them,
 * and rows their team owes that nobody has picked up yet. Without the second
 * kind the account manager's commitment to a team would sit where only a
 * manager ever looks, and "the video team owes four reels" would reach the
 * people who make reels by word of mouth.
 *
 * Ordered by urgency: overdue first, then soonest due, then undated.
 */
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
    // Undated work sorts last: a due date is the only thing that makes one
    // owed row more urgent than another.
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
