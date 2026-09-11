import PptxGenJS from "pptxgenjs"
import ExcelJS from "exceljs"
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
} from "docx"
import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import { aiComplete, isAiConfigured } from "@/lib/ai"
import { todayUtc } from "@/lib/dates"
import { formatPeriod } from "../lib/delivery-period"
import {
  DELIVERABLE_STATUS_LABELS,
  STATUS_ORDER,
  type DeliverableStatus,
} from "../lib/deliverable-lifecycle"
import type {
  DeliverablesProgress,
  ProgressGroup,
  ProgressItem,
  ProgressTotals,
} from "../lib/deliverables-progress"

// =============================================================================
// Deliverables slide deck
//
// The "present it on Monday" report: who was on the job, what they owed, what
// landed, what did not and why. Built as a .pptx so the person can open it in
// PowerPoint / Google Slides and talk over it, rather than screenshotting the
// ledger.
//
// The deck is shaped by WHO is generating it, because the ledger is scoped by
// role everywhere else and a report must not widen that:
//   - admin (project:write): anything in the company
//   - account manager (owns the project): every team and person on it
//   - team manager (runs a ProjectTeam, or has line reports): those teams and people
//   - member: only their own rows - the deck becomes "my deliverables"
// =============================================================================

export type ReportRole = "admin" | "account_manager" | "team_manager" | "member"

export interface ReportScope {
  role: ReportRole
  employeeId: string
  /** What the caller may report on. `null` means unrestricted (admin). */
  projectIds: string[] | null
  teamIds: string[] | null
  employeeIds: string[] | null
}

/** What the caller asked for. Empty arrays mean "everything I can see". */
export interface ReportPick {
  projectIds: string[]
  teamIds: string[]
  employeeIds: string[]
}

export const ROLE_LABEL: Record<ReportRole, string> = {
  admin: "Administrator",
  account_manager: "Account manager",
  team_manager: "Team manager",
  member: "Team member",
}

const uniq = (ids: string[]): string[] => Array.from(new Set(ids))

// A person you can report on is a CURRENT one. Someone who has left keeps their
// history as an actor on the rows, but is not offered as a team member or in
// the pickers. The silent admin_ watch account is treated the same way - it
// signs things off but is not a person on any team. Same rule as the
// assignable-employees and tasks routes.
const VISIBLE_PERSON: Prisma.EmployeeWhereInput = { isActive: true, ...VISIBLE_EMPLOYEE_FILTER }

export async function resolveReportScope(session: Session): Promise<ReportScope> {
  const me = session.user.id
  // project:write only. Every employee holds project:read (it is in the base
  // "employee" role so people can open the projects they are on), so treating
  // it as an admin signal handed a team manager the whole company. Same gate
  // as the page's own "Progress" vs "My Progress" split.
  if (hasPermission(session, PERMISSIONS.PROJECT_WRITE)) {
    return { role: "admin", employeeId: me, projectIds: null, teamIds: null, employeeIds: null }
  }

  const [owned, managed, memberOf, reports] = await Promise.all([
    db.project.findMany({ where: { ownerId: me }, select: { id: true } }),
    db.projectTeam.findMany({ where: { managerId: me }, select: { id: true, projectId: true } }),
    db.projectTeamMember.findMany({
      where: { employeeId: me },
      select: { teamId: true, projectId: true },
    }),
    // Line reports, solid and dotted. The maker's manager is the first sign-off
    // on a deliverable, so they can report on what their people owe.
    db.employee.findMany({
      where: { isActive: true, OR: [{ managerId: me }, { dottedManagerId: me }] },
      select: { id: true },
    }),
  ])
  const ownedIds = owned.map((p) => p.id)

  // The account manager runs every team on the projects they own; the team
  // manager runs the teams pointed at them. Both can report on the people in
  // those teams. A plain member gets nobody but themselves.
  const teamsInOwned = ownedIds.length
    ? await db.projectTeam.findMany({
        where: { projectId: { in: ownedIds } },
        select: { id: true },
      })
    : []
  const teamIds = uniq([...teamsInOwned.map((t) => t.id), ...managed.map((t) => t.id)])
  const people = teamIds.length
    ? await db.projectTeamMember.findMany({
        where: { teamId: { in: teamIds }, employee: VISIBLE_PERSON },
        select: { employeeId: true },
        distinct: ["employeeId"],
      })
    : []

  const role: ReportRole = ownedIds.length
    ? "account_manager"
    : managed.length || reports.length
      ? "team_manager"
      : "member"

  return {
    role,
    employeeId: me,
    projectIds: uniq([
      ...ownedIds,
      ...managed.map((t) => t.projectId),
      ...memberOf.map((m) => m.projectId),
    ]),
    teamIds,
    employeeIds: uniq([me, ...people.map((p) => p.employeeId), ...reports.map((r) => r.id)]),
  }
}

/** Snap a request to the caller's scope. `null` = they asked for something outside it. */
export function narrowPick(scope: ReportScope, req: ReportPick): ReportPick | null {
  const inside = (allowed: string[] | null, ids: string[]) =>
    allowed === null || ids.every((id) => allowed.includes(id))
  if (
    !inside(scope.projectIds, req.projectIds) ||
    !inside(scope.teamIds, req.teamIds) ||
    !inside(scope.employeeIds, req.employeeIds)
  ) {
    return null
  }
  // A member reports on themselves whatever the query string says.
  if (scope.role === "member") return { ...req, teamIds: [], employeeIds: [scope.employeeId] }
  return req
}

// ─── Picker lists ─────────────────────────────────────────────────────────────

export interface ReportScopeData {
  role: ReportRole
  projects: { id: string; name: string; code: string | null }[]
  teams: { id: string; name: string; projectId: string; projectName: string; memberCount: number }[]
  people: { id: string; name: string; designation: string | null; teamIds: string[] }[]
}

const fullName = (e: { firstName: string; lastName: string }) =>
  `${e.firstName} ${e.lastName}`.trim()

export async function describeReportScope(scope: ReportScope): Promise<ReportScopeData> {
  const projects = await db.project.findMany({
    where: scope.projectIds === null ? {} : { id: { in: scope.projectIds } },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })

  const teams =
    scope.teamIds !== null && scope.teamIds.length === 0
      ? []
      : await db.projectTeam.findMany({
          where: scope.teamIds === null ? {} : { id: { in: scope.teamIds } },
          select: {
            id: true,
            name: true,
            projectId: true,
            project: { select: { name: true } },
            _count: { select: { members: { where: { employee: VISIBLE_PERSON } } } },
          },
          orderBy: [{ project: { name: "asc" } }, { name: "asc" }],
        })

  const people = await db.employee.findMany({
    where: {
      ...(scope.employeeIds === null
        ? { isActive: true, projectTeamMemberships: { some: {} } }
        : { id: { in: scope.employeeIds } }),
      ...VISIBLE_PERSON,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: { select: { title: true } },
      projectTeamMemberships: { select: { teamId: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  })

  return {
    role: scope.role,
    projects,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      projectId: t.projectId,
      projectName: t.project.name,
      memberCount: t._count.members,
    })),
    people: people.map((e) => ({
      id: e.id,
      name: fullName(e),
      designation: e.designation?.title ?? null,
      teamIds: e.projectTeamMemberships.map((m) => m.teamId),
    })),
  }
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ROW_SELECT = {
  id: true,
  projectId: true,
  teamId: true,
  employeeId: true,
  project: { select: { id: true, name: true, code: true, client: { select: { name: true } } } },
  team: { select: { id: true, name: true } },
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: { select: { title: true } },
    },
  },
  type: true,
  title: true,
  quantity: true,
  deliveredQuantity: true,
  status: true,
  dueOn: true,
  periodStart: true,
  periodEnd: true,
  completedOn: true,
  revisionCount: true,
  notes: true,
  // The latest send-back is the "why" for a REJECTED row. The row itself only
  // holds the current state, so the reason lives in the event log.
  events: {
    where: { type: "STATUS_CHANGED", toStatus: "REJECTED" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      reason: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ProjectDeliverableSelect

type Row = Prisma.ProjectDeliverableGetPayload<{ select: typeof ROW_SELECT }>

const ROW_CAP = 1500

function scopeWhereFor(scope: ReportScope): Prisma.ProjectDeliverableWhereInput {
  if (scope.role === "admin") return {}
  const me = scope.employeeId
  return {
    OR: [
      { project: { ownerId: me } },
      { team: { managerId: me } },
      // Owed-by-nobody-in-particular rows carry no team; still the manager's if
      // the maker sits on a team they run.
      {
        teamId: null,
        employee: { projectTeamMemberships: { some: { team: { managerId: me } } } },
      },
      // Their line reports' work, wherever it sits.
      { employee: { OR: [{ managerId: me }, { dottedManagerId: me }] } },
      { employeeId: me },
    ],
  }
}

interface RosterTeam {
  id: string
  name: string
  projectId: string
  project: { name: string; code: string }
  manager: { id: string; firstName: string; lastName: string } | null
  members: {
    employee: {
      id: string
      firstName: string
      lastName: string
      designation: { title: string } | null
    }
  }[]
}

async function loadRoster(scope: ReportScope, pick: ReportPick): Promise<RosterTeam[]> {
  if (scope.role === "member") return []
  if (scope.teamIds !== null && scope.teamIds.length === 0) return []
  const where: Prisma.ProjectTeamWhereInput = pick.teamIds.length
    ? { id: { in: pick.teamIds } }
    : pick.projectIds.length
      ? {
          projectId: { in: pick.projectIds },
          ...(scope.teamIds === null ? {} : { id: { in: scope.teamIds } }),
        }
      : scope.teamIds === null
        ? {}
        : { id: { in: scope.teamIds } }
  const teams = await db.projectTeam.findMany({
    where,
    select: {
      id: true,
      name: true,
      projectId: true,
      project: { select: { name: true, code: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      members: {
        where: { employee: VISIBLE_PERSON },
        select: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              designation: { select: { title: true } },
            },
          },
        },
      },
    },
    orderBy: [{ project: { name: "asc" } }, { name: "asc" }],
    take: 60,
  })
  if (!pick.employeeIds.length) return teams
  const keep = new Set(pick.employeeIds)
  return teams
    .map((t) => ({ ...t, members: t.members.filter((m) => keep.has(m.employee.id)) }))
    .filter((t) => t.members.length > 0 || (t.manager && keep.has(t.manager.id)))
}

/**
 * What "in the window" means for a status report. The ledger's own filter is
 * `completedOn` inside the range, which is right for "what did we ship" and
 * wrong for a deck whose whole point is also the rows that did NOT ship: an
 * open row has no completedOn and would vanish. So a row is in the window when
 * it was completed in it, is due in it, is scheduled (period) across it, or is
 * open work carried in - overdue from before the window, or undated.
 */
function windowWhere(from: string, to: string): Prisma.ProjectDeliverableWhereInput {
  const start = new Date(`${from}T00:00:00.000Z`)
  const end = new Date(`${to}T23:59:59.999Z`)
  const notDone = { status: { in: ["PLANNED", "IN_PROGRESS", "REJECTED"] as DeliverableStatus[] } }
  return {
    OR: [
      { completedOn: { gte: start, lte: end } },
      { dueOn: { gte: start, lte: end } },
      { periodStart: { lte: end }, periodEnd: { gte: start } },
      { ...notDone, dueOn: { lt: start } },
      { ...notDone, dueOn: null, periodStart: null, createdAt: { lte: end } },
    ],
  }
}

async function loadRows(
  scope: ReportScope,
  pick: ReportPick,
  roster: RosterTeam[],
  from: string,
  to: string,
): Promise<{ rows: Row[]; truncated: boolean }> {
  const and: Prisma.ProjectDeliverableWhereInput[] = [scopeWhereFor(scope), windowWhere(from, to)]
  if (pick.projectIds.length) and.push({ projectId: { in: pick.projectIds } })
  if (pick.teamIds.length) {
    const teamProjects = uniq(roster.map((t) => t.projectId))
    and.push({
      OR: [
        { teamId: { in: pick.teamIds } },
        {
          teamId: null,
          projectId: { in: teamProjects },
          employee: { projectTeamMemberships: { some: { teamId: { in: pick.teamIds } } } },
        },
      ],
    })
  }
  if (pick.employeeIds.length) and.push({ employeeId: { in: pick.employeeIds } })

  const rows = await db.projectDeliverable.findMany({
    where: { AND: and },
    select: ROW_SELECT,
    orderBy: [{ project: { name: "asc" } }, { dueOn: "asc" }, { createdAt: "asc" }],
    take: ROW_CAP + 1,
  })
  return { rows: rows.slice(0, ROW_CAP), truncated: rows.length > ROW_CAP }
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

const DONE: ReadonlySet<DeliverableStatus> = new Set(["DELIVERED", "ACCEPTED"])

interface Bucket {
  key: string
  label: string
  sub: string
  total: number
  done: number
  open: number
  overdue: number
  sentBack: number
  late: number
  qty: number
  made: number
}

const isDone = (r: Row) => DONE.has(r.status)
const isOverdue = (r: Row, today: Date) => !isDone(r) && !!r.dueOn && r.dueOn < today
const isLate = (r: Row) => !!r.completedOn && !!r.dueOn && r.completedOn > r.dueOn
const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100))

function bucketize(
  rows: Row[],
  today: Date,
  keyOf: (r: Row) => { key: string; label: string; sub?: string } | null,
): Bucket[] {
  const map = new Map<string, Bucket>()
  for (const r of rows) {
    const k = keyOf(r)
    if (!k) continue
    let b = map.get(k.key)
    if (!b) {
      b = {
        key: k.key,
        label: k.label,
        sub: k.sub ?? "",
        total: 0,
        done: 0,
        open: 0,
        overdue: 0,
        sentBack: 0,
        late: 0,
        qty: 0,
        made: 0,
      }
      map.set(k.key, b)
    }
    b.total += 1
    b.qty += r.quantity
    b.made += Math.min(r.deliveredQuantity, r.quantity)
    if (isDone(r)) b.done += 1
    else b.open += 1
    if (r.status === "REJECTED") b.sentBack += 1
    if (isOverdue(r, today)) b.overdue += 1
    if (isLate(r)) b.late += 1
  }
  return Array.from(map.values())
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const dmy = (d: Date | null | undefined): string =>
  d ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "-"
const day = (s: string): Date => new Date(`${s}T00:00:00.000Z`)
const trunc = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function periodOf(r: Row): string {
  if (r.periodStart && r.periodEnd) return formatPeriod(r.periodStart, r.periodEnd)
  return r.dueOn ? `due ${dmy(r.dueOn)}` : "-"
}

function whyNotDone(r: Row, today: Date): string {
  const due = r.dueOn
  const dueBit = due
    ? due < today
      ? `overdue since ${dmy(due)}`
      : `due ${dmy(due)}`
    : "no due date"
  let why: string
  if (r.status === "REJECTED") {
    const ev = r.events[0]
    const by = ev?.actor ? ` by ${fullName(ev.actor)}` : ""
    why = ev?.reason ? `Sent back${by}: ${ev.reason}` : `Sent back${by}, awaiting rework`
  } else if (!r.employee) {
    why = `Nobody has picked this up yet · ${dueBit}`
  } else if (r.status === "IN_PROGRESS") {
    why = `${r.deliveredQuantity}/${r.quantity} made so far · ${dueBit}`
  } else {
    why = `Not started · ${dueBit}`
  }
  if (r.notes && r.status !== "REJECTED") why += ` - ${trunc(r.notes, 60)}`
  return trunc(why, 140)
}

// ─── AI takeaways ─────────────────────────────────────────────────────────────

async function takeaways(block: string): Promise<string[] | null> {
  if (!isAiConfigured()) return null
  try {
    const text = await aiComplete<string>({
      system: `You are a delivery analyst preparing speaker notes for a manager presenting a deliverables report. You are given real numbers; invent nothing.
Return 4 to 6 lines, each starting with "- ", at most 22 words each. Lead with the completion picture, then what is late or sent back and who is carrying the most. Name projects and people exactly as given. No preamble, no headings, no sign-off.`,
      user: block,
      model: "fast",
      maxTokens: 400,
      timeoutMs: 20_000,
    })
    const lines = text
      .split("\n")
      .map((l) => l.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 6)
    return lines.length ? lines : null
  } catch {
    // Advisory slide only - a model outage must not cost the download.
    return null
  }
}

// ─── Slides ───────────────────────────────────────────────────────────────────

const C = {
  navy: "1F2A44",
  blue: "2563EB",
  ink: "111827",
  muted: "6B7280",
  line: "E5E7EB",
  light: "F3F4F6",
  green: "16A34A",
  amber: "D97706",
  red: "DC2626",
  grey: "9CA3AF",
  white: "FFFFFF",
}
const STATUS_COLOR: Record<DeliverableStatus, string> = {
  PLANNED: C.grey,
  IN_PROGRESS: C.blue,
  DELIVERED: C.amber,
  ACCEPTED: C.green,
  REJECTED: C.red,
}
const FONT = "Calibri"
const W = 10
const M = 0.45
const BODY_W = W - M * 2
const ROWS_PER_SLIDE = 12

type Slide = ReturnType<PptxGenJS["addSlide"]>

interface CellOpts {
  bold?: boolean
  color?: string
  fill?: { color: string }
  align?: "left" | "center" | "right"
  fontSize?: number
  italic?: boolean
}
interface Cell {
  text: string
  options?: CellOpts
}

const cell = (text: string, options?: CellOpts): Cell => ({ text, options })
const head = (text: string, align: CellOpts["align"] = "left"): Cell =>
  cell(text, { bold: true, color: C.ink, fill: { color: C.light }, align })
const num = (n: number): Cell => cell(String(n), { align: "right" })
const pctCell = (n: number): Cell =>
  cell(`${n}%`, {
    align: "right",
    bold: true,
    color: n >= 80 ? C.green : n >= 50 ? C.amber : C.red,
  })

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

class Deck {
  readonly pptx = new PptxGenJS()
  private n = 0

  constructor(title: string, author: string) {
    this.pptx.layout = "LAYOUT_16x9"
    this.pptx.title = title
    this.pptx.author = author
    this.pptx.company = "DNMS"
  }

  /** A content slide with the standard header band. Returns the y where content starts. */
  slide(title: string, subtitle?: string): { s: Slide; y: number } {
    const s = this.pptx.addSlide()
    this.n += 1
    s.background = { color: C.white }
    s.addShape(this.pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: W,
      h: 0.85,
      fill: { color: C.navy },
      line: { color: C.navy },
    })
    s.addText(title, {
      x: M,
      y: 0.12,
      w: BODY_W - 1,
      h: 0.42,
      fontFace: FONT,
      fontSize: 20,
      bold: true,
      color: C.white,
      valign: "middle",
    })
    if (subtitle) {
      s.addText(subtitle, {
        x: M,
        y: 0.5,
        w: BODY_W - 1,
        h: 0.3,
        fontFace: FONT,
        fontSize: 10.5,
        color: "C7D2FE",
        valign: "middle",
      })
    }
    s.addText(String(this.n), {
      x: W - M - 0.6,
      y: 0.25,
      w: 0.6,
      h: 0.35,
      fontFace: FONT,
      fontSize: 10,
      color: "C7D2FE",
      align: "right",
    })
    return { s, y: 1.1 }
  }

  table(s: Slide, y: number, header: Cell[], rows: Cell[][], colW: number[], fontSize = 10): void {
    s.addTable([header, ...rows], {
      x: M,
      y,
      w: BODY_W,
      colW,
      fontFace: FONT,
      fontSize,
      color: C.ink,
      valign: "middle",
      border: { type: "solid", pt: 0.5, color: C.line },
      rowH: 0.28,
      margin: 0.04,
      autoPage: false,
    })
  }

  /** Paged tables: the same header on every page, "(continued)" in the title. */
  pagedTable(
    title: string,
    subtitle: string | undefined,
    header: Cell[],
    rows: Cell[][],
    colW: number[],
    opts: { perSlide?: number; maxSlides?: number; fontSize?: number } = {},
  ): void {
    const per = opts.perSlide ?? ROWS_PER_SLIDE
    const pages = chunk(rows, per)
    const shown = opts.maxSlides ? pages.slice(0, opts.maxSlides) : pages
    shown.forEach((page, i) => {
      const { s, y } = this.slide(i === 0 ? title : `${title} (continued)`, subtitle)
      this.table(s, y, header, page, colW, opts.fontSize)
      const hidden = i === shown.length - 1 ? rows.length - (i + 1) * per : 0
      if (hidden > 0) {
        this.note(s, `+ ${hidden} more not shown - export the ledger as CSV for the full list.`)
      }
    })
  }

  note(s: Slide, text: string): void {
    s.addText(text, {
      x: M,
      y: 5.15,
      w: BODY_W,
      h: 0.3,
      fontFace: FONT,
      fontSize: 9,
      italic: true,
      color: C.muted,
    })
  }

  kpi(
    s: Slide,
    x: number,
    y: number,
    w: number,
    label: string,
    value: string,
    color: string,
  ): void {
    s.addShape(this.pptx.ShapeType.rect, {
      x,
      y,
      w,
      h: 1.05,
      fill: { color: C.light },
      line: { color: C.line, width: 0.5 },
    })
    s.addText(value, {
      x: x + 0.1,
      y: y + 0.08,
      w: w - 0.2,
      h: 0.55,
      fontFace: FONT,
      fontSize: 24,
      bold: true,
      color,
    })
    s.addText(label, {
      x: x + 0.1,
      y: y + 0.62,
      w: w - 0.2,
      h: 0.35,
      fontFace: FONT,
      fontSize: 10,
      color: C.muted,
    })
  }

  bullets(s: Slide, y: number, lines: string[], fontSize = 14): void {
    s.addText(
      lines.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
      {
        x: M,
        y,
        w: BODY_W,
        h: 5.2 - y,
        fontFace: FONT,
        fontSize,
        color: C.ink,
        valign: "top",
        paraSpaceAfter: 6,
      },
    )
  }

  /** A fresh ArrayBuffer-backed copy: Node's Buffer is typed over ArrayBufferLike, which BodyInit rejects. */
  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    const out = (await this.pptx.write({ outputType: "nodebuffer" })) as Uint8Array
    const copy = new Uint8Array(new ArrayBuffer(out.byteLength))
    copy.set(out)
    return copy
  }
}

// ─── The deck ─────────────────────────────────────────────────────────────────

export interface DeckInput {
  session: Session
  scope: ReportScope
  pick: ReportPick
  from: string
  to: string
  ai: boolean
}

export type ReportFormat = 'pptx' | 'xlsx' | 'docx'

export interface BuiltReport {
  bytes: Uint8Array<ArrayBuffer>
  filename: string
  contentType: string
}

export interface BuiltDeck {
  bytes: Uint8Array<ArrayBuffer>
  filename: string
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "report"

export interface ReportData {
  rows: Row[]
  today: Date
  me: any
  roster: RosterTeam[]
  scopeLine: string
  windowLine: string
  author: string
  isSelf: boolean
  isSinglePerson: boolean
  total: number
  done: number
  notDone: Row[]
  overdue: number
  sentBack: number
  late: number
  qty: number
  made: number
  byStatus: Map<DeliverableStatus, number>
  byProject: Bucket[]
  byMember: Bucket[]
  truncated: boolean
  pickedProjects: { name: string }[]
  pickedPeople: { firstName: string; lastName: string }[]
}

export async function loadReportData(input: DeckInput): Promise<ReportData> {
  const { scope, pick, from, to } = input
  const today = todayUtc()
  const isSelf = scope.role === "member"
  const isSinglePerson = isSelf || pick.employeeIds.length === 1

  const [me, roster, pickedProjects, pickedPeople, singlePersonRecord] = await Promise.all([
    db.employee.findUnique({
      where: { id: scope.employeeId },
      select: { firstName: true, lastName: true, designation: { select: { title: true } } },
    }),
    loadRoster(scope, pick),
    pick.projectIds.length
      ? db.project.findMany({
          where: { id: { in: pick.projectIds } },
          select: { name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    pick.employeeIds.length && scope.role !== "member"
      ? db.employee.findMany({
          where: { id: { in: pick.employeeIds } },
          select: { firstName: true, lastName: true },
          orderBy: { firstName: "asc" },
        })
      : Promise.resolve([]),
    !isSelf && pick.employeeIds.length === 1
      ? db.employee.findUnique({
          where: { id: pick.employeeIds[0] },
          select: { firstName: true, lastName: true, designation: { select: { title: true } } },
        })
      : Promise.resolve(null),
  ])
  const { rows, truncated } = await loadRows(scope, pick, roster, from, to)

  // ── What this report is about, in words ──────────────────────────────────────
  let scopeLine: string
  if (isSelf) {
    scopeLine = pickedProjects.length === 1 ? pickedProjects[0]!.name : "Your deliverables"
  } else if (singlePersonRecord) {
    const pName = fullName(singlePersonRecord)
    scopeLine = pickedProjects.length === 1 ? `${pName} · ${pickedProjects[0]!.name}` : pName
  } else {
    const scopeParts: string[] = []
    if (pickedProjects.length) scopeParts.push(pickedProjects.map((p) => p.name).join(", "))
    if (pick.teamIds.length) {
      scopeParts.push(roster.map((t) => `${t.name} (${t.project.name})`).join(", "))
    }
    if (pickedPeople.length) scopeParts.push(pickedPeople.map(fullName).join(", "))
    scopeLine =
      scopeParts.join(" · ") ||
      {
        admin: "All projects",
        account_manager: "The projects you own",
        team_manager: "The teams you manage",
        member: "Your deliverables",
      }[scope.role]
  }

  const isAllTime = from <= "2001-01-01" && to >= "2090-01-01"
  const windowLine = isAllTime ? "All time" : formatPeriod(day(from), day(to))
  const author = me ? fullName(me) : "DNMS"

  // ── Numbers ────────────────────────────────────────────────────────────────
  const total = rows.length
  const done = rows.filter(isDone).length
  const notDone = rows.filter((r) => !isDone(r))
  const overdue = rows.filter((r) => isOverdue(r, today)).length
  const sentBack = rows.filter((r) => r.status === "REJECTED").length
  const late = rows.filter(isLate).length
  const qty = rows.reduce((n, r) => n + r.quantity, 0)
  const made = rows.reduce((n, r) => n + Math.min(r.deliveredQuantity, r.quantity), 0)
  const byStatus = new Map<DeliverableStatus, number>()
  for (const s of STATUS_ORDER) byStatus.set(s, 0)
  for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)

  const byProject = bucketize(rows, today, (r) => ({
    key: r.projectId,
    label: r.project.name,
    sub: r.project.client?.name ?? "",
  })).sort((a, b) => b.total - a.total)

  const byMember = bucketize(rows, today, (r) =>
    r.employee
      ? { key: r.employee.id, label: fullName(r.employee), sub: r.team?.name ?? "" }
      : { key: "__unclaimed__", label: "Not yet picked up", sub: r.team?.name ?? "" },
  )

  // Only pad with roster members if viewing multiple people, NOT when filtered to a single person!
  if (!isSinglePerson && pick.employeeIds.length === 0) {
    for (const t of roster) {
      for (const m of t.members) {
        if (!byMember.some((b) => b.key === m.employee.id)) {
          byMember.push({
            key: m.employee.id,
            label: fullName(m.employee),
            sub: t.name,
            total: 0,
            done: 0,
            open: 0,
            overdue: 0,
            sentBack: 0,
            late: 0,
            qty: 0,
            made: 0,
          })
        }
      }
    }
  }
  byMember.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))

  return {
    rows,
    today,
    me,
    roster,
    scopeLine,
    windowLine,
    author,
    isSelf,
    isSinglePerson,
    total,
    done,
    notDone,
    overdue,
    sentBack,
    late,
    qty,
    made,
    byStatus,
    byProject,
    byMember,
    truncated,
    pickedProjects,
    pickedPeople,
  }
}

export async function buildDeliverablesDeck(input: DeckInput): Promise<BuiltDeck> {
  const { scope, pick, from, to } = input
  const data = await loadReportData(input)
  const {
    rows,
    today,
    me,
    roster,
    scopeLine,
    windowLine,
    author,
    isSelf,
    isSinglePerson,
    total,
    done,
    notDone,
    overdue,
    sentBack,
    late,
    qty,
    made,
    byStatus,
    byProject,
    byMember,
    truncated,
    pickedProjects,
    pickedPeople,
  } = data

  const deck = new Deck(`Deliverables · ${scopeLine} · ${windowLine}`, author)

  // 1. Cover
  {
    const s = deck.pptx.addSlide()
    s.background = { color: C.navy }
    s.addText("Deliverables report", {
      x: M,
      y: 1.35,
      w: BODY_W,
      h: 0.8,
      fontFace: FONT,
      fontSize: 32,
      bold: true,
      color: C.white,
    })
    s.addText(scopeLine, {
      x: M,
      y: 2.3,
      w: BODY_W,
      h: 0.6,
      fontFace: FONT,
      fontSize: 18,
      color: "C7D2FE",
    })
    s.addText(windowLine, {
      x: M,
      y: 2.95,
      w: BODY_W,
      h: 0.45,
      fontFace: FONT,
      fontSize: 14,
      color: C.white,
    })
    s.addText(
      `Prepared by ${author}${me?.designation ? ` · ${me.designation.title}` : ""} · ${ROLE_LABEL[scope.role]} · ${dmy(today)}`,
      {
        x: M,
        y: 4.7,
        w: BODY_W,
        h: 0.4,
        fontFace: FONT,
        fontSize: 11,
        color: "C7D2FE",
      },
    )
  }

  // 2. Who is in this report
  if (!isSinglePerson && roster.length) {
    const rosterRows: Cell[][] = []
    const seenCount = new Map<string, number>()
    for (const r of rows) {
      if (r.employee) seenCount.set(r.employee.id, (seenCount.get(r.employee.id) ?? 0) + 1)
    }
    for (const t of roster) {
      if (t.manager) {
        rosterRows.push([
          cell(fullName(t.manager), { bold: true }),
          cell("Team manager", { color: C.blue, bold: true }),
          cell("-"),
          cell(t.name),
          cell(t.project.name),
          num(seenCount.get(t.manager.id) ?? 0),
        ])
      }
      for (const m of t.members) {
        if (t.manager && m.employee.id === t.manager.id) continue
        rosterRows.push([
          cell(fullName(m.employee)),
          cell("Member"),
          cell(m.employee.designation?.title ?? "-"),
          cell(t.name),
          cell(t.project.name),
          num(seenCount.get(m.employee.id) ?? 0),
        ])
      }
    }
    deck.pagedTable(
      "Who is in this report",
      `${roster.length} team${roster.length === 1 ? "" : "s"} · deliverables counted for ${windowLine}`,
      [
        head("Name"),
        head("Role"),
        head("Designation"),
        head("Team"),
        head("Project"),
        head("Deliverables", "right"),
      ],
      rosterRows,
      [2.2, 1.2, 1.9, 1.6, 1.4, 0.8],
      { perSlide: 14 },
    )
  }

  // 3. At a glance
  {
    const { s, y } = deck.slide(
      "At a glance",
      `${scopeLine} · completed, due or scheduled ${windowLine}, plus open work carried in`,
    )
    const kw = (BODY_W - 0.15 * 3) / 4
    deck.kpi(s, M, y, kw, "Deliverables in the window", String(total), C.navy)
    deck.kpi(s, M + (kw + 0.15), y, kw, "Completed", `${pct(done, total)}%`, C.green)
    deck.kpi(
      s,
      M + (kw + 0.15) * 2,
      y,
      kw,
      "Not completed",
      String(total - done),
      total - done ? C.amber : C.green,
    )
    deck.kpi(
      s,
      M + (kw + 0.15) * 3,
      y,
      kw,
      "Overdue right now",
      String(overdue),
      overdue ? C.red : C.green,
    )

    const y2 = y + 1.25
    if (total > 0) {
      const labels = (Object.keys(DELIVERABLE_STATUS_LABELS) as DeliverableStatus[]).filter((k) =>
        byStatus.has(k),
      )
      s.addChart(
        deck.pptx.ChartType.doughnut,
        [
          {
            name: "Status",
            labels: labels.map((k) => DELIVERABLE_STATUS_LABELS[k]),
            values: labels.map((k) => byStatus.get(k) ?? 0),
          },
        ],
        {
          x: M,
          y: y2,
          w: 4.4,
          h: 2.7,
          holeSize: 55,
          chartColors: labels.map((k) => STATUS_COLOR[k]),
          showLegend: true,
          legendPos: "r",
          legendFontSize: 10,
          showPercent: true,
          dataLabelColor: C.white,
          dataLabelFontSize: 9,
        },
      )
    }
    const facts = [
      `${done} of ${total} deliverables completed (delivered or accepted).`,
      `${made} of ${qty} units made across everything in the window.`,
      `${sentBack} sent back for rework · ${late} completed after their due date.`,
      `${byProject.length} project${byProject.length === 1 ? "" : "s"} · ${byMember.filter((b) => b.key !== "__unclaimed__").length} people.`,
    ]
    const unclaimed = byMember.find((b) => b.key === "__unclaimed__")
    if (unclaimed)
      facts.push(`${unclaimed.total} to do for a team but not yet picked up by anyone.`)
    s.addText(
      facts.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
      {
        x: M + 4.6,
        y: y2,
        w: BODY_W - 4.6,
        h: 2.7,
        fontFace: FONT,
        fontSize: 12,
        color: C.ink,
        valign: "top",
        paraSpaceAfter: 6,
      },
    )
    if (truncated)
      deck.note(s, `Capped at ${ROW_CAP} rows - narrow the window or scope for the full picture.`)
    if (total === 0) deck.note(s, "Nothing recorded in this window for this scope.")
  }

  // 4. By project
  if (byProject.length > 1 || (byProject.length === 1 && !pick.projectIds.length)) {
    const { s, y } = deck.slide("By project", `${byProject.length} projects · ${windowLine}`)
    const showChart = byProject.length >= 2 && byProject.length <= 12
    const tableW = showChart ? 5.6 : BODY_W
    s.addTable(
      [
        [
          head("Project"),
          head("Total", "right"),
          head("Completed", "right"),
          head("Open", "right"),
          head("Overdue", "right"),
          head("%", "right"),
        ],
        ...byProject
          .slice(0, 12)
          .map((b) => [
            cell(b.sub ? `${b.label} · ${b.sub}` : b.label),
            num(b.total),
            num(b.done),
            num(b.open),
            cell(String(b.overdue), { align: "right", color: b.overdue ? C.red : C.ink }),
            pctCell(pct(b.done, b.total)),
          ]),
      ],
      {
        x: M,
        y,
        w: tableW,
        colW: showChart ? [2.35, 0.65, 0.65, 0.65, 0.65, 0.65] : [4.7, 0.9, 0.9, 0.9, 0.9, 0.8],
        fontFace: FONT,
        fontSize: 10,
        color: C.ink,
        valign: "middle",
        border: { type: "solid", pt: 0.5, color: C.line },
        rowH: 0.28,
        margin: 0.04,
        autoPage: false,
      },
    )
    if (showChart) {
      s.addChart(
        deck.pptx.ChartType.bar,
        [
          {
            name: "Completed %",
            labels: byProject.map((b) => b.label),
            values: byProject.map((b) => pct(b.done, b.total)),
          },
        ],
        {
          x: M + tableW + 0.2,
          y,
          w: BODY_W - tableW - 0.2,
          h: 3.9,
          barDir: "bar",
          chartColors: [C.blue],
          valAxisMinVal: 0,
          valAxisMaxVal: 100,
          catAxisLabelFontSize: 9,
          valAxisLabelFontSize: 9,
          showValue: true,
          dataLabelFormatCode: '0"%"',
          dataLabelFontSize: 9,
          showLegend: false,
        },
      )
    }
    if (byProject.length > 12) deck.note(s, `Top 12 by volume shown of ${byProject.length}.`)
  }

  // 5. Every deliverable, project by project
  const detailHeader = [
    head("Type"),
    head("Deliverable"),
    head("Period"),
    head("Qty", "right"),
    head("Status"),
    head(isSelf ? "Team" : "Owner"),
    head("Completed on"),
  ]
  const detailW = [1.05, 2.85, 1.45, 0.65, 1.0, 1.35, 0.75]
  const detailRow = (r: Row): Cell[] => [
    cell(r.type),
    cell(trunc(r.title, 60)),
    cell(periodOf(r)),
    cell(`${Math.min(r.deliveredQuantity, r.quantity)}/${r.quantity}`, { align: "right" }),
    cell(DELIVERABLE_STATUS_LABELS[r.status], { color: STATUS_COLOR[r.status], bold: true }),
    cell(isSelf ? (r.team?.name ?? "-") : r.employee ? fullName(r.employee) : "-", {
      italic: !isSelf && !r.employee,
      color: !isSelf && !r.employee ? C.muted : C.ink,
    }),
    cell(dmy(r.completedOn)),
  ]
  const projectsInOrder = byProject.map((b) => b.key)
  for (const projectId of projectsInOrder) {
    const b = byProject.find((x) => x.key === projectId)!
    const list = rows.filter((r) => r.projectId === projectId)
    deck.pagedTable(
      `Deliverables · ${b.label}`,
      `${b.sub ? `${b.sub} · ` : ""}${b.done} of ${b.total} completed · ${windowLine}`,
      detailHeader,
      list.map(detailRow),
      detailW,
      { maxSlides: 3, fontSize: 9.5 },
    )
  }

  // 6. Not completed, and why
  if (notDone.length) {
    const byUrgency = [...notDone].sort((a, b) => {
      const ao = isOverdue(a, today) ? 0 : 1
      const bo = isOverdue(b, today) ? 0 : 1
      if (ao !== bo) return ao - bo
      return (a.dueOn?.getTime() ?? Infinity) - (b.dueOn?.getTime() ?? Infinity)
    })
    deck.pagedTable(
      "Not completed, and why",
      `${notDone.length} outstanding · ${overdue} overdue · ${sentBack} sent back`,
      [
        head("Project"),
        head("Deliverable"),
        head(isSelf ? "Team" : "Owner"),
        head("Status"),
        head("Why"),
      ],
      byUrgency.map((r) => [
        cell(trunc(r.project.name, 28)),
        cell(trunc(r.title, 44)),
        cell(isSelf ? (r.team?.name ?? "-") : r.employee ? fullName(r.employee) : "-"),
        cell(DELIVERABLE_STATUS_LABELS[r.status], { color: STATUS_COLOR[r.status], bold: true }),
        cell(whyNotDone(r, today), { fontSize: 8.5 }),
      ]),
      [1.5, 2.3, 1.4, 0.95, 2.95],
      { perSlide: 11, maxSlides: 4, fontSize: 9.5 },
    )
  }

  // 7. By team member
  if (!isSinglePerson && byMember.length > 1) {
    deck.pagedTable(
      "By team member",
      `Who carried what · ${windowLine}`,
      [
        head("Member"),
        head("Team"),
        head("Assigned", "right"),
        head("Completed", "right"),
        head("Open", "right"),
        head("Overdue", "right"),
        head("Sent back", "right"),
        head("%", "right"),
      ],
      byMember.map((b) => [
        cell(b.label, {
          bold: true,
          italic: b.key === "__unclaimed__",
          color: b.key === "__unclaimed__" ? C.muted : C.ink,
        }),
        cell(b.sub || "-"),
        num(b.total),
        num(b.done),
        num(b.open),
        cell(String(b.overdue), { align: "right", color: b.overdue ? C.red : C.ink }),
        num(b.sentBack),
        b.total ? pctCell(pct(b.done, b.total)) : cell("-", { align: "right", color: C.muted }),
      ]),
      [2.2, 1.6, 0.9, 0.8, 0.8, 0.9, 0.95, 0.95],
      { perSlide: 13 },
    )

    // One slide per person only when the deck is about a team or a few people -
    // a portfolio-wide deck with forty people would double in size for nothing.
    const focused =
      pick.teamIds.length > 0 || pick.employeeIds.length > 0 || scope.role === "team_manager"
    const people = byMember.filter((b) => b.key !== "__unclaimed__" && b.total > 0)
    if (focused && people.length <= 12) {
      for (const b of people) {
        const list = rows.filter((r) => r.employee?.id === b.key)
        deck.pagedTable(
          b.label,
          `${b.sub ? `${b.sub} · ` : ""}${b.done} of ${b.total} completed · ${b.overdue} overdue · ${b.sentBack} sent back`,
          [
            head("Project"),
            head("Type"),
            head("Deliverable"),
            head("Period"),
            head("Qty", "right"),
            head("Status"),
            head("Completed on"),
          ],
          list.map((r) => [
            cell(trunc(r.project.name, 24)),
            cell(r.type),
            cell(trunc(r.title, 48)),
            cell(periodOf(r)),
            cell(`${Math.min(r.deliveredQuantity, r.quantity)}/${r.quantity}`, { align: "right" }),
            cell(DELIVERABLE_STATUS_LABELS[r.status], {
              color: STATUS_COLOR[r.status],
              bold: true,
            }),
            cell(dmy(r.completedOn)),
          ]),
          [1.4, 1.0, 2.6, 1.4, 0.6, 1.0, 1.1],
          { maxSlides: 2, fontSize: 9.5 },
        )
      }
    }
  }

  // 8. Takeaways (AI, optional)
  if (input.ai && total > 0) {
    const block = [
      `SCOPE: ${scopeLine}. WINDOW: ${windowLine}. GENERATED FOR: ${ROLE_LABEL[scope.role]}.`,
      `TOTAL ${total} deliverables; ${done} completed (${pct(done, total)}%); ${total - done} not completed; ${overdue} overdue; ${sentBack} sent back; ${late} finished late; units ${made}/${qty}.`,
      "BY PROJECT:",
      ...byProject
        .slice(0, 15)
        .map(
          (b) =>
            `- ${b.label}: ${b.total} total, ${b.done} done (${pct(b.done, b.total)}%), ${b.open} open, ${b.overdue} overdue, ${b.sentBack} sent back`,
        ),
      ...(isSelf
        ? []
        : [
            "BY PERSON:",
            ...byMember
              .slice(0, 20)
              .map(
                (b) =>
                  `- ${b.label}: ${b.total} assigned, ${b.done} done, ${b.open} open, ${b.overdue} overdue, ${b.sentBack} sent back`,
              ),
          ]),
      "NOT COMPLETED (title - why):",
      ...notDone
        .slice(0, 25)
        .map(
          (r) =>
            `- ${r.title} (${r.project.name}${r.employee ? `, ${fullName(r.employee)}` : ""}) - ${whyNotDone(r, today)}`,
        ),
    ].join("\n")
    const lines = await takeaways(block)
    if (lines) {
      const { s, y } = deck.slide(
        "Takeaways",
        "Speaker notes drafted from the numbers above - check before you say them out loud",
      )
      deck.bullets(s, y, lines, 15)
    }
  }

  const base =
    pickedProjects.length === 1
      ? pickedProjects[0]!.name
      : pick.teamIds.length === 1 && roster[0]
        ? roster[0].name
        : pickedPeople.length === 1
          ? fullName(pickedPeople[0]!)
          : isSelf
            ? "my"
            : "all"
  const isAllTime = from <= "2001-01-01" && to >= "2090-01-01"
  const dateSuffix = isAllTime ? "all-time" : `${from}-${to}`
  return {
    bytes: await deck.bytes(),
    filename: `deliverables-${slug(base)}-${dateSuffix}.pptx`,
  }
}

export async function buildDeliverablesXlsx(input: DeckInput): Promise<BuiltReport> {
  const data = await loadReportData(input)
  const { from, to, pick } = input
  const {
    rows,
    today,
    total,
    done,
    overdue,
    sentBack,
    byProject,
    byMember,
    pickedProjects,
    pickedPeople,
    roster,
    isSelf,
    isSinglePerson,
    scopeLine,
    windowLine,
    byStatus,
  } = data

  const wb = new ExcelJS.Workbook()
  wb.creator = data.author
  wb.created = new Date()

  // ── Sheet 1: Overview ──────────────────────────────────────
  const wsOverview = wb.addWorksheet("Progress Overview", {
    views: [{ showGridLines: true }],
  })
  wsOverview.columns = [
    { width: 32 }, // Col A: Status / Project / Metric label
    { width: 14 }, // Col B: Completed / Qty
    { width: 14 }, // Col C: Open / Share %
    { width: 14 }, // Col D: Overdue
    { width: 14 }, // Col E: Sent Back
    { width: 14 }, // Col F: Total / All
    { width: 16 }, // Col G: Progress %
  ]

  // Header Banner
  const titleRow = wsOverview.addRow(["Deliverables Progress Report"])
  titleRow.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FF0F172A" } }
  wsOverview.mergeCells("A1:G1")

  const metaRow = wsOverview.addRow([`${scopeLine} · ${windowLine}`])
  metaRow.font = { name: "Segoe UI", size: 11, color: { argb: "FF475569" } }
  wsOverview.mergeCells("A2:G2")

  const genRow = wsOverview.addRow([`Generated on ${dmy(new Date())} by ${data.author}`])
  genRow.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF94A3B8" } }
  wsOverview.mergeCells("A3:G3")

  wsOverview.addRow([]) // Spacer row 4

  // 1. Key Metrics Cards (Matching Web UI)
  const kpiSecRow = wsOverview.addRow(["KEY METRICS"])
  kpiSecRow.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF475569" } }

  const kpiHeaderRow = wsOverview.addRow([
    "To Do",
    "Completed",
    "Overdue Now",
    "Sent Back",
    "Total Deliverables",
    "Completion Rate",
  ])
  kpiHeaderRow.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF64748B" } }
  kpiHeaderRow.alignment = { horizontal: "center", vertical: "middle" }

  const kpiValRow = wsOverview.addRow([
    total - done,
    done,
    overdue,
    sentBack,
    total,
    total > 0 ? `${pct(done, total)}%` : "0%",
  ])
  kpiValRow.height = 30
  kpiValRow.font = { name: "Segoe UI", size: 18, bold: true, color: { argb: "FF0F172A" } }
  kpiValRow.alignment = { horizontal: "center", vertical: "middle" }
  kpiValRow.getCell(2).font = { name: "Segoe UI", size: 18, bold: true, color: { argb: "FF10B981" } }
  if (overdue > 0)
    kpiValRow.getCell(3).font = { name: "Segoe UI", size: 18, bold: true, color: { argb: "FFEF4444" } }
  if (sentBack > 0)
    kpiValRow.getCell(4).font = { name: "Segoe UI", size: 18, bold: true, color: { argb: "FFF59E0B" } }

  const kpiSubRow = wsOverview.addRow([
    overdue ? `${overdue} overdue` : "nothing overdue",
    total > 0 ? `${pct(done, total)}% of ${total}` : "0 items",
    overdue ? "past due & open" : "on track",
    sentBack ? "awaiting rework" : "none rejected",
    "in window",
    "overall progress",
  ])
  kpiSubRow.font = { name: "Segoe UI", size: 8, color: { argb: "FF94A3B8" } }
  kpiSubRow.alignment = { horizontal: "center", vertical: "middle" }

  for (let c = 1; c <= 6; c++) {
    const headCell = kpiHeaderRow.getCell(c)
    const valCell = kpiValRow.getCell(c)
    const subCell = kpiSubRow.getCell(c)

    headCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
    valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } }
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    }
    headCell.border = thinBorder
    valCell.border = thinBorder
    subCell.border = thinBorder
  }

  wsOverview.addRow([]) // Spacer

  // 2. Where the work stands (Status Breakdown, Matching Web UI)
  const wsStatusSec = wsOverview.addRow(["WHERE THE WORK STANDS (STATUS BREAKDOWN)"])
  wsStatusSec.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF475569" } }

  const statusHeadRow = wsOverview.addRow(["Status", "Deliverables", "Share (%)"])
  statusHeadRow.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } }
  for (let c = 1; c <= 3; c++) {
    statusHeadRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } }
    statusHeadRow.getCell(c).alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" }
  }

  const statusRows = [
    { label: "To do", key: "PLANNED" as DeliverableStatus, color: "FF64748B" },
    { label: "In progress", key: "IN_PROGRESS" as DeliverableStatus, color: "FF3B82F6" },
    { label: "Delivered", key: "DELIVERED" as DeliverableStatus, color: "FF10B981" },
    { label: "Accepted", key: "ACCEPTED" as DeliverableStatus, color: "FF059669" },
    { label: "Sent back", key: "REJECTED" as DeliverableStatus, color: "FFEF4444" },
  ]
  for (const sr of statusRows) {
    const cnt = byStatus.get(sr.key) ?? 0
    const row = wsOverview.addRow([sr.label, cnt, `${pct(cnt, total)}%`])
    row.font = { name: "Segoe UI", size: 10, color: { argb: "FF334155" } }
    row.getCell(1).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: sr.color } }
    row.getCell(2).alignment = { horizontal: "right" }
    row.getCell(3).alignment = { horizontal: "right" }
    for (let c = 1; c <= 3; c++) {
      row.getCell(c).border = { bottom: { style: "thin", color: { argb: "FFF1F5F9" } } }
    }
  }

  wsOverview.addRow([]) // Spacer

  // 3. By Project Table (Matching Web UI)
  const projSecRow = wsOverview.addRow(["BY PROJECT"])
  projSecRow.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF475569" } }

  const projHeadRow = wsOverview.addRow([
    "Project",
    "Completed",
    "Open",
    "Overdue",
    "Sent Back",
    "All",
    "Progress",
  ])
  projHeadRow.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } }
  for (let c = 1; c <= 7; c++) {
    projHeadRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } }
    projHeadRow.getCell(c).alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" }
  }

  for (let idx = 0; idx < byProject.length; idx++) {
    const p = byProject[idx]
    const row = wsOverview.addRow([
      p.label,
      p.done,
      p.open,
      p.overdue,
      p.sentBack,
      p.total,
      `${pct(p.done, p.total)}%`,
    ])
    row.font = { name: "Segoe UI", size: 10, color: { argb: "FF1E293B" } }
    row.getCell(1).font = { name: "Segoe UI", size: 10, bold: true }
    row.getCell(2).font = { name: "Segoe UI", size: 10, color: { argb: "FF10B981" } }
    if (p.overdue > 0)
      row.getCell(4).font = { name: "Segoe UI", size: 10, color: { argb: "FFEF4444" } }
    if (p.sentBack > 0)
      row.getCell(5).font = { name: "Segoe UI", size: 10, color: { argb: "FFF59E0B" } }

    const bg = idx % 2 === 1 ? "FFF8FAFC" : "FFFFFFFF"
    for (let c = 1; c <= 7; c++) {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      row.getCell(c).alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" }
      row.getCell(c).border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } }
    }
  }

  // 4. By Team Member Table (ONLY if !isSinglePerson && byMember.length > 1)
  if (!isSinglePerson && byMember.length > 1) {
    wsOverview.addRow([]) // Spacer
    const memSecRow = wsOverview.addRow(["BY TEAM MEMBER"])
    memSecRow.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF475569" } }

    const memHeadRow = wsOverview.addRow([
      "Person",
      "Completed",
      "Open",
      "Overdue",
      "Sent Back",
      "All",
      "Progress",
    ])
    memHeadRow.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } }
    for (let c = 1; c <= 7; c++) {
      memHeadRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } }
      memHeadRow.getCell(c).alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" }
    }

    for (let idx = 0; idx < byMember.length; idx++) {
      const m = byMember[idx]
      const row = wsOverview.addRow([
        m.label,
        m.done,
        m.open,
        m.overdue,
        m.sentBack,
        m.total,
        m.total ? `${pct(m.done, m.total)}%` : "-",
      ])
      row.font = { name: "Segoe UI", size: 10, color: { argb: "FF1E293B" } }
      row.getCell(1).font = { name: "Segoe UI", size: 10, bold: true }
      row.getCell(2).font = { name: "Segoe UI", size: 10, color: { argb: "FF10B981" } }
      if (m.overdue > 0)
        row.getCell(4).font = { name: "Segoe UI", size: 10, color: { argb: "FFEF4444" } }
      if (m.sentBack > 0)
        row.getCell(5).font = { name: "Segoe UI", size: 10, color: { argb: "FFF59E0B" } }

      const bg = idx % 2 === 1 ? "FFF8FAFC" : "FFFFFFFF"
      for (let c = 1; c <= 7; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
        row.getCell(c).alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" }
        row.getCell(c).border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } }
      }
    }
  }

  // ── Sheet 2: Deliverables (Full Ledger) ────────────────────
  const wsDeliverables = wb.addWorksheet("Deliverables", {
    views: [{ showGridLines: true }],
  })
  wsDeliverables.columns = [
    { width: 38 }, // Col A: Deliverable
    { width: 22 }, // Col B: Project
    { width: 20 }, // Col C: Owned By
    { width: 18 }, // Col D: Period
    { width: 15 }, // Col E: Status
    { width: 36 }, // Col F: Why / Completed On
  ]

  const dTitleRow = wsDeliverables.addRow(["Deliverables Ledger"])
  dTitleRow.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FF0F172A" } }
  wsDeliverables.mergeCells("A1:F1")

  const dMetaRow = wsDeliverables.addRow([
    `${scopeLine} · ${windowLine} · ${rows.length} ${rows.length === 1 ? "deliverable" : "deliverables"}`,
  ])
  dMetaRow.font = { name: "Segoe UI", size: 10, color: { argb: "FF64748B" } }
  wsDeliverables.mergeCells("A2:F2")

  wsDeliverables.addRow([]) // Spacer

  const dHeadRow = wsDeliverables.addRow([
    "Deliverable",
    "Project",
    "Owned By",
    "Period",
    "Status",
    "Why / Completed On",
  ])
  dHeadRow.height = 24
  dHeadRow.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } }
  for (let c = 1; c <= 6; c++) {
    dHeadRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } }
    dHeadRow.getCell(c).alignment = { horizontal: "left", vertical: "middle" }
  }

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx]
    const doneRow = isDone(r)
    const whyOrDone = doneRow
      ? r.completedOn
        ? dmy(r.completedOn)
        : "Completed"
      : whyNotDone(r, today)

    const row = wsDeliverables.addRow([
      `${r.type} · ${r.title}${r.quantity > 1 ? ` ×${r.quantity}` : ""}`,
      r.project.name,
      r.employee ? fullName(r.employee) : "-",
      periodOf(r),
      DELIVERABLE_STATUS_LABELS[r.status],
      whyOrDone,
    ])
    row.font = { name: "Segoe UI", size: 9.5, color: { argb: "FF1E293B" } }
    row.getCell(5).font = {
      name: "Segoe UI",
      size: 9.5,
      bold: true,
      color: {
        argb:
          r.status === "REJECTED"
            ? "FFDC2626"
            : r.status === "DELIVERED" || r.status === "ACCEPTED"
              ? "FF16A34A"
              : r.status === "IN_PROGRESS"
                ? "FF2563EB"
                : "FF6B7280",
      },
    }
    if (!doneRow && isOverdue(r, today)) {
      row.getCell(4).font = { name: "Segoe UI", size: 9.5, color: { argb: "FFDC2626" } }
    }

    const bg = idx % 2 === 1 ? "FFF8FAFC" : "FFFFFFFF"
    for (let c = 1; c <= 6; c++) {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      row.getCell(c).alignment = { vertical: "top", horizontal: "left" }
      row.getCell(c).border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const bytes = new Uint8Array(buffer)
  const base =
    pickedProjects.length === 1
      ? pickedProjects[0]!.name
      : pick.teamIds.length === 1 && roster[0]
        ? roster[0].name
        : pickedPeople.length === 1
          ? fullName(pickedPeople[0]!)
          : isSelf
            ? "my"
            : "all"

  const isAllTime = from <= "2001-01-01" && to >= "2090-01-01"
  const dateSuffix = isAllTime ? "all-time" : `${from}-${to}`
  return {
    bytes,
    filename: `deliverables-${slug(base)}-${dateSuffix}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }
}

export async function buildDeliverablesDocx(input: DeckInput): Promise<BuiltReport> {
  const data = await loadReportData(input)
  const { from, to, pick, ai } = input
  const {
    rows,
    today,
    total,
    done,
    notDone,
    overdue,
    sentBack,
    late,
    byProject,
    byMember,
    pickedProjects,
    pickedPeople,
    roster,
    isSelf,
    isSinglePerson,
    scopeLine,
    windowLine,
    byStatus,
    qty,
    made,
  } = data

  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  }

  type AlignmentTypeValue = (typeof AlignmentType)[keyof typeof AlignmentType]

  const hCell = (text: string, widthPct: number, align: AlignmentTypeValue = AlignmentType.LEFT) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: "1E293B" },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      borders: cellBorder,
      children: [
        new Paragraph({
          alignment: align,
          children: [
            new TextRun({ text, bold: true, color: "FFFFFF", size: 18, font: "Segoe UI" }),
          ],
        }),
      ],
    })

  const dCell = (
    text: string,
    widthPct: number,
    opts?: { bold?: boolean; color?: string; align?: AlignmentTypeValue; bg?: string; italic?: boolean },
  ) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: opts?.bg ? { type: ShadingType.CLEAR, fill: opts.bg } : undefined,
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      borders: cellBorder,
      children: [
        new Paragraph({
          alignment: opts?.align ?? AlignmentType.LEFT,
          children: [
            new TextRun({
              text,
              bold: opts?.bold,
              italics: opts?.italic,
              color: opts?.color ?? "1E293B",
              size: 18,
              font: "Segoe UI",
            }),
          ],
        }),
      ],
    })

  const docChildren: (Paragraph | Table)[] = [
    new Paragraph({
      text: "Deliverables Progress Report",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: `${scopeLine} · ${windowLine}`,
          bold: true,
          color: "475569",
          size: 22,
          font: "Segoe UI",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: `Generated on ${dmy(new Date())} by ${data.author} · DNMS`,
          italics: true,
          color: "94A3B8",
          size: 16,
          font: "Segoe UI",
        }),
      ],
    }),
    new Paragraph({ text: "" }),

    // 1. Key Metrics Cards
    new Paragraph({
      text: "Key Metrics",
      heading: HeadingLevel.HEADING_2,
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
              borders: cellBorder,
              margins: { top: 140, bottom: 140, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "TO DO",
                      size: 16,
                      bold: true,
                      color: "64748B",
                      font: "Segoe UI",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(total - done),
                      size: 36,
                      bold: true,
                      color: "0F172A",
                      font: "Segoe UI",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: overdue ? `${overdue} overdue` : "nothing overdue",
                      size: 16,
                      color: overdue ? "EF4444" : "94A3B8",
                      font: "Segoe UI",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
              borders: cellBorder,
              margins: { top: 140, bottom: 140, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "COMPLETED",
                      size: 16,
                      bold: true,
                      color: "64748B",
                      font: "Segoe UI",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(done),
                      size: 36,
                      bold: true,
                      color: "10B981",
                      font: "Segoe UI",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: total > 0 ? `${pct(done, total)}% of ${total}` : "0 items",
                      size: 16,
                      color: "94A3B8",
                      font: "Segoe UI",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
              borders: cellBorder,
              margins: { top: 140, bottom: 140, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "OVERDUE NOW",
                      size: 16,
                      bold: true,
                      color: "64748B",
                      font: "Segoe UI",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(overdue),
                      size: 36,
                      bold: true,
                      color: overdue ? "EF4444" : "0F172A",
                      font: "Segoe UI",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: overdue ? "past due & open" : "on track",
                      size: 16,
                      color: "94A3B8",
                      font: "Segoe UI",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
              borders: cellBorder,
              margins: { top: 140, bottom: 140, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "SENT BACK",
                      size: 16,
                      bold: true,
                      color: "64748B",
                      font: "Segoe UI",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(sentBack),
                      size: 36,
                      bold: true,
                      color: sentBack ? "F59E0B" : "0F172A",
                      font: "Segoe UI",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: sentBack ? "awaiting rework" : "none rejected",
                      size: 16,
                      color: "94A3B8",
                      font: "Segoe UI",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ text: "" }),

    // 2. Where the work stands (Status Breakdown)
    new Paragraph({
      text: "Where the work stands",
      heading: HeadingLevel.HEADING_2,
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            hCell("Status", 50),
            hCell("Deliverables", 25, AlignmentType.RIGHT),
            hCell("Share (%)", 25, AlignmentType.RIGHT),
          ],
        }),
        ...[
          { label: "To do", key: "PLANNED" as DeliverableStatus, color: "64748B" },
          { label: "In progress", key: "IN_PROGRESS" as DeliverableStatus, color: "3B82F6" },
          { label: "Delivered", key: "DELIVERED" as DeliverableStatus, color: "10B981" },
          { label: "Accepted", key: "ACCEPTED" as DeliverableStatus, color: "059669" },
          { label: "Sent back", key: "REJECTED" as DeliverableStatus, color: "EF4444" },
        ].map(
          (sr, idx) =>
            new TableRow({
              children: [
                dCell(sr.label, 50, {
                  bold: true,
                  color: sr.color,
                  bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                }),
                dCell(String(byStatus.get(sr.key) ?? 0), 25, {
                  align: AlignmentType.RIGHT,
                  bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                }),
                dCell(`${pct(byStatus.get(sr.key) ?? 0, total)}%`, 25, {
                  align: AlignmentType.RIGHT,
                  bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                }),
              ],
            }),
        ),
      ],
    }),
    new Paragraph({ text: "" }),

    // 3. By Project Table
    new Paragraph({
      text: "By Project",
      heading: HeadingLevel.HEADING_2,
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            hCell("Project", 34),
            hCell("Completed", 11, AlignmentType.RIGHT),
            hCell("Open", 11, AlignmentType.RIGHT),
            hCell("Overdue", 11, AlignmentType.RIGHT),
            hCell("Sent Back", 11, AlignmentType.RIGHT),
            hCell("All", 11, AlignmentType.RIGHT),
            hCell("Progress", 11, AlignmentType.RIGHT),
          ],
        }),
        ...byProject.map(
          (b, idx) =>
            new TableRow({
              children: [
                dCell(b.label, 34, { bold: true, bg: idx % 2 === 1 ? "F8FAFC" : undefined }),
                dCell(String(b.done), 11, {
                  align: AlignmentType.RIGHT,
                  color: "10B981",
                  bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                }),
                dCell(String(b.open), 11, {
                  align: AlignmentType.RIGHT,
                  bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                }),
                dCell(String(b.overdue), 11, {
                  align: AlignmentType.RIGHT,
                  color: b.overdue > 0 ? "EF4444" : undefined,
                  bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                }),
                dCell(String(b.sentBack), 11, {
                  align: AlignmentType.RIGHT,
                  color: b.sentBack > 0 ? "F59E0B" : undefined,
                  bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                }),
                dCell(String(b.total), 11, {
                  align: AlignmentType.RIGHT,
                  bold: true,
                  bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                }),
                dCell(`${pct(b.done, b.total)}%`, 11, {
                  align: AlignmentType.RIGHT,
                  bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                }),
              ],
            }),
        ),
      ],
    }),
  ]

  // 4. By Team Member Table (only if !isSinglePerson && byMember.length > 1)
  if (!isSinglePerson && byMember.length > 1) {
    docChildren.push(new Paragraph({ text: "" }))
    docChildren.push(
      new Paragraph({
        text: "By Team Member",
        heading: HeadingLevel.HEADING_2,
      }),
    )
    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              hCell("Person", 34),
              hCell("Completed", 11, AlignmentType.RIGHT),
              hCell("Open", 11, AlignmentType.RIGHT),
              hCell("Overdue", 11, AlignmentType.RIGHT),
              hCell("Sent Back", 11, AlignmentType.RIGHT),
              hCell("All", 11, AlignmentType.RIGHT),
              hCell("Progress", 11, AlignmentType.RIGHT),
            ],
          }),
          ...byMember.map(
            (m, idx) =>
              new TableRow({
                children: [
                  dCell(m.label, 34, { bold: true, bg: idx % 2 === 1 ? "F8FAFC" : undefined }),
                  dCell(String(m.done), 11, {
                    align: AlignmentType.RIGHT,
                    color: "10B981",
                    bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                  }),
                  dCell(String(m.open), 11, {
                    align: AlignmentType.RIGHT,
                    bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                  }),
                  dCell(String(m.overdue), 11, {
                    align: AlignmentType.RIGHT,
                    color: m.overdue > 0 ? "EF4444" : undefined,
                    bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                  }),
                  dCell(String(m.sentBack), 11, {
                    align: AlignmentType.RIGHT,
                    color: m.sentBack > 0 ? "F59E0B" : undefined,
                    bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                  }),
                  dCell(String(m.total), 11, {
                    align: AlignmentType.RIGHT,
                    bold: true,
                    bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                  }),
                  dCell(m.total ? `${pct(m.done, m.total)}%` : "-", 11, {
                    align: AlignmentType.RIGHT,
                    bg: idx % 2 === 1 ? "F8FAFC" : undefined,
                  }),
                ],
              }),
          ),
        ],
      }),
    )
  }

  // 5. Deliverables Ledger Table (All Columns matching Web Flat Table)
  docChildren.push(new Paragraph({ text: "" }))
  docChildren.push(
    new Paragraph({
      text: "Deliverables Ledger",
      heading: HeadingLevel.HEADING_2,
    }),
  )
  docChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            hCell("Deliverable", 28),
            hCell("Project", 18),
            hCell("Owned By", 15),
            hCell("Period", 13),
            hCell("Status", 12),
            hCell("Why / Completed On", 14),
          ],
        }),
        ...rows.map((r, idx) => {
          const doneRow = isDone(r)
          const whyOrDone = doneRow
            ? r.completedOn
              ? dmy(r.completedOn)
              : "Completed"
            : whyNotDone(r, today)
          const statusColor =
            r.status === "REJECTED"
              ? "DC2626"
              : r.status === "DELIVERED" || r.status === "ACCEPTED"
                ? "16A34A"
                : r.status === "IN_PROGRESS"
                  ? "2563EB"
                  : "6B7280"

          return new TableRow({
            children: [
              dCell(`${r.type} · ${r.title}${r.quantity > 1 ? ` ×${r.quantity}` : ""}`, 28, {
                bg: idx % 2 === 1 ? "F8FAFC" : undefined,
              }),
              dCell(r.project.name, 18, { bg: idx % 2 === 1 ? "F8FAFC" : undefined }),
              dCell(r.employee ? fullName(r.employee) : "-", 15, {
                bg: idx % 2 === 1 ? "F8FAFC" : undefined,
              }),
              dCell(periodOf(r), 13, {
                color: !doneRow && isOverdue(r, today) ? "DC2626" : undefined,
                bg: idx % 2 === 1 ? "F8FAFC" : undefined,
              }),
              dCell(DELIVERABLE_STATUS_LABELS[r.status], 12, {
                bold: true,
                color: statusColor,
                bg: idx % 2 === 1 ? "F8FAFC" : undefined,
              }),
              dCell(whyOrDone, 14, { color: "64748B", bg: idx % 2 === 1 ? "F8FAFC" : undefined }),
            ],
          })
        }),
      ],
    }),
  )

  // 6. AI Takeaways
  if (ai && total > 0) {
    const block = [
      `SCOPE: ${scopeLine}. WINDOW: ${windowLine}. GENERATED FOR: ${ROLE_LABEL[input.scope.role]}.`,
      `TOTAL ${total} deliverables; ${done} completed (${pct(done, total)}%); ${total - done} not completed; ${overdue} overdue; ${sentBack} sent back; ${late} finished late; units ${made}/${qty}.`,
      "BY PROJECT:",
      ...byProject
        .slice(0, 15)
        .map(
          (b) =>
            `- ${b.label}: ${b.total} total, ${b.done} done (${pct(b.done, b.total)}%), ${b.open} open, ${b.overdue} overdue, ${b.sentBack} sent back`,
        ),
      ...(isSinglePerson
        ? []
        : [
            "BY PERSON:",
            ...byMember
              .slice(0, 20)
              .map(
                (b) =>
                  `- ${b.label}: ${b.total} assigned, ${b.done} done, ${b.open} open, ${b.overdue} overdue, ${b.sentBack} sent back`,
              ),
          ]),
      "NOT COMPLETED (title - why):",
      ...notDone
        .slice(0, 25)
        .map(
          (r) =>
            `- ${r.title} (${r.project.name}${r.employee ? `, ${fullName(r.employee)}` : ""}) - ${whyNotDone(r, today)}`,
        ),
    ].join("\n")

    const lines = await takeaways(block)
    if (lines) {
      docChildren.push(new Paragraph({ text: "" }))
      docChildren.push(
        new Paragraph({
          text: "AI Takeaways & Notes",
          heading: HeadingLevel.HEADING_2,
        }),
      )
      for (const line of lines) {
        docChildren.push(
          new Paragraph({
            text: line,
            bullet: { level: 0 },
          }),
        )
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000,
            },
          },
        },
        children: docChildren,
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  const bytes = new Uint8Array(buffer)

  const base =
    pickedProjects.length === 1
      ? pickedProjects[0]!.name
      : pick.teamIds.length === 1 && roster[0]
        ? roster[0].name
        : pickedPeople.length === 1
          ? fullName(pickedPeople[0]!)
          : isSelf
            ? "my"
            : "all"

  const isAllTime = from <= "2001-01-01" && to >= "2090-01-01"
  const dateSuffix = isAllTime ? "all-time" : `${from}-${to}`
  return {
    bytes,
    filename: `deliverables-${slug(base)}-${dateSuffix}.docx`,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }
}

export async function buildDeliverablesReport(input: DeckInput, format: ReportFormat): Promise<BuiltReport> {
  if (format === 'xlsx') return buildDeliverablesXlsx(input)
  if (format === 'docx') return buildDeliverablesDocx(input)
  
  const deck = await buildDeliverablesDeck(input)
  return {
    bytes: deck.bytes,
    filename: deck.filename,
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }
}

// ─── Progress page ──────────────────────────────
//
// The same rows and the same arithmetic as the deck, handed back as JSON for
// the "My Progress" page - so what a person sees on screen is exactly what
// their slides would say.

const isoDay = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null

function toGroup(b: Bucket): ProgressGroup {
  return {
    id: b.key,
    label: b.label,
    sub: b.sub,
    total: b.total,
    done: b.done,
    open: b.open,
    overdue: b.overdue,
    sentBack: b.sentBack,
    late: b.late,
    pct: pct(b.done, b.total),
    qty: b.qty,
    made: b.made,
  }
}

function toItem(r: Row, today: Date): ProgressItem {
  const done = isDone(r)
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    status: r.status,
    projectId: r.projectId,
    project: r.project.name,
    employeeId: r.employee?.id ?? null,
    employee: r.employee ? fullName(r.employee) : null,
    period: periodOf(r),
    dueOn: isoDay(r.dueOn),
    completedOn: isoDay(r.completedOn),
    quantity: r.quantity,
    deliveredQuantity: r.deliveredQuantity,
    late: isLate(r),
    overdue: isOverdue(r, today),
    why: done ? "" : whyNotDone(r, today),
  }
}

const biggestFirst = (a: ProgressGroup, b: ProgressGroup) =>
  b.total - a.total || a.label.localeCompare(b.label)

/** Soonest due first; rows with no date at all sink to the bottom. */
const dueKey = (r: Row): number =>
  r.dueOn?.getTime() ?? r.periodEnd?.getTime() ?? Number.MAX_SAFE_INTEGER

export interface ProgressInput {
  scope: ReportScope
  pick: ReportPick
  from: string
  to: string
}

export async function loadDeliverablesProgress(
  input: ProgressInput,
): Promise<DeliverablesProgress> {
  const { scope, pick, from, to } = input
  const today = todayUtc()
  const roster = await loadRoster(scope, pick)
  const { rows, truncated } = await loadRows(scope, pick, roster, from, to)

  const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    DeliverableStatus,
    number
  >
  const totals: ProgressTotals = {
    total: rows.length,
    done: 0,
    open: 0,
    overdue: 0,
    sentBack: 0,
    late: 0,
    onTime: 0,
    pct: 0,
    qty: 0,
    made: 0,
    byStatus,
  }
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    totals.qty += r.quantity
    totals.made += Math.min(r.deliveredQuantity, r.quantity)
    if (isDone(r)) {
      totals.done += 1
      if (isLate(r)) totals.late += 1
      else if (r.dueOn && r.completedOn) totals.onTime += 1
    } else {
      totals.open += 1
      if (r.status === "REJECTED") totals.sentBack += 1
      if (isOverdue(r, today)) totals.overdue += 1
    }
  }
  totals.pct = pct(totals.done, totals.total)

  const byProject = bucketize(rows, today, (r) => ({
    key: r.projectId,
    label: r.project.name,
    sub: r.project.client?.name ?? "",
  }))
    .map(toGroup)
    .sort(biggestFirst)

  const byPerson = bucketize(rows, today, (r) =>
    r.employee
      ? {
          key: r.employee.id,
          label: fullName(r.employee),
          sub: r.employee.designation?.title ?? "",
        }
      : { key: "unassigned", label: "Not picked up yet", sub: "" },
  )
    .map(toGroup)
    .sort(biggestFirst)

  const notDone = rows
    .filter((r) => !isDone(r))
    .sort((a, b) => dueKey(a) - dueKey(b))
    .map((r) => toItem(r, today))
  const delivered = rows
    .filter(isDone)
    .sort((a, b) => (b.completedOn?.getTime() ?? 0) - (a.completedOn?.getTime() ?? 0))
    .map((r) => toItem(r, today))

  return {
    from,
    to,
    me: scope.employeeId,
    truncated,
    totals,
    byProject,
    byPerson,
    notDone,
    delivered,
  }
}
