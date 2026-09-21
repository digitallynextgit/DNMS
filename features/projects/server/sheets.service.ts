import "server-only"

import { db } from "@/server/db"
import type { Prisma } from "@prisma/client"
import {
  MAX_COL_W,
  MAX_ROW_H,
  MIN_COL_W,
  MIN_ROW_H,
  normalizeCell,
  type CellValue,
  type ProjectSheet,
  type SheetColumn,
  type SheetColumnType,
  type SheetEvent,
  type SheetEventType,
  type SheetWorkbook,
  type StaffWorkbook,
  type WorkbookIndexEntry,
  type WorkbookTeam,
} from "../lib/sheet-types"
import { ymd } from "../lib/delivery-period"
import { sortProjectTeams } from "../lib/project-teams"
import { statusProblem, teamProgress, type WorkbookTeamStatus } from "../lib/workbook-team-progress"

// =============================================================================
// Project sheets: a spreadsheet whose columns the team defines.
//
// ── WHO MAY DO WHAT ──────────────────────────────────────────────────────────
// Enforced at the route layer, and worth stating once here because the split is
// the point of the feature:
//
//   ANYONE ON THE PROJECT   create a sheet, add columns, add rows, edit cells
//   ACCOUNT MANAGER / ADMIN  everything above, plus DELETE
//
// Editing is safe to hand out because it is recorded and reversible by hand;
// deleting is neither. Deleting a COLUMN is the sharpest edge - it discards that
// column's value in every row at once - so it sits on the same side as deleting
// the sheet.
//
// ── HISTORY ──────────────────────────────────────────────────────────────────
// Every mutation appends a ProjectSheetEvent. That is what makes shared editing
// tolerable: with everyone able to change any cell, "who changed this and what
// was it before" is the only way back. Events are never updated or deleted.
// =============================================================================

/** Columns a new sheet starts with: A..Z. */
export const DEFAULT_COLUMNS = 26

/** 0 -> A, 25 -> Z, 26 -> AA. Mirrors the client's copy in project-sheet.tsx. */
function columnLetter(index: number): string {
  let n = index
  let out = ""
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

const name = (e?: { firstName: string; lastName: string } | null) =>
  e ? `${e.firstName} ${e.lastName}`.trim() : null

const asOptions = (raw: Prisma.JsonValue | null): string[] =>
  Array.isArray(raw) ? raw.filter((o): o is string => typeof o === "string") : []

/** Only positive integers survive: a corrupt map must not collapse the grid. */
const asHeights = (raw: Prisma.JsonValue | null): Record<string, number> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = Math.round(v)
  }
  return out
}

const asCells = (raw: Prisma.JsonValue): Record<string, CellValue> =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, CellValue>) : {}

/**
 * Append one history entry.
 *
 * Best-effort BY DESIGN: a sheet edit that succeeded must not be reported as
 * failed because the log write did. The edit is the user's work; the event is
 * our record of it, and losing the record is the lesser harm.
 */
async function record(
  sheetId: string,
  actorId: string | null,
  type: SheetEventType,
  extra: {
    rowId?: string
    columnId?: string
    label?: string
    before?: unknown
    after?: unknown
    /** Set instead of actorId when the edit came from the CLIENT PORTAL. */
    actorClientId?: string | null
  } = {},
): Promise<void> {
  try {
    await db.projectSheetEvent.create({
      data: {
        sheetId,
        actorId,
        actorClientId: extra.actorClientId ?? null,
        type,
        rowId: extra.rowId ?? null,
        columnId: extra.columnId ?? null,
        label: extra.label ?? null,
        before: (extra.before ?? null) as Prisma.InputJsonValue,
        after: (extra.after ?? null) as Prisma.InputJsonValue,
      },
    })
  } catch (e) {
    console.error("[SHEET_EVENT]", e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_INCLUDE = {
  createdBy: { select: { firstName: true, lastName: true } },
  columns: { orderBy: { position: "asc" } },
  rows: {
    orderBy: { position: "asc" },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  },
} as const

type SheetRecord = Prisma.ProjectSheetGetPayload<{ include: typeof SHEET_INCLUDE }>

function toSheet(s: SheetRecord): ProjectSheet {
  return {
    id: s.id,
    workbookId: s.workbookId,
    name: s.name,
    description: s.description,
    position: s.position,
    rowHeights: asHeights(s.rowHeights),
    createdByName: name(s.createdBy),
    updatedAt: s.updatedAt.toISOString(),
    columns: s.columns.map(
      (c): SheetColumn => ({
        id: c.id,
        name: c.name,
        type: c.type as SheetColumnType,
        position: c.position,
        width: c.width,
        options: asOptions(c.options),
      }),
    ),
    rows: s.rows.map((r) => ({
      id: r.id,
      position: r.position,
      cells: asCells(r.cells),
      createdByName: name(r.createdBy),
      updatedAt: r.updatedAt.toISOString(),
    })),
  }
}

export async function listSheets(projectId: string): Promise<ProjectSheet[]> {
  const sheets = await db.projectSheet.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: SHEET_INCLUDE,
  })
  return sheets.map(toSheet)
}

/**
 * What the history DIALOG shows.
 *
 * Everything is still recorded - "added a row", "created the sheet" and the
 * rest are all in the table. They are just not what anyone opens a history to
 * find. A log where nine entries in ten say a row was added is a log people
 * stop reading, and then the one entry that mattered is invisible.
 *
 * So the dialog is restricted to edits and deletions: what a value WAS, and
 * what happened to the things that are no longer there.
 */
const SHOWN_IN_HISTORY: SheetEventType[] = ["CELL_UPDATED", "ROW_DELETED", "COLUMN_DELETED"]

export async function getSheetHistory(sheetId: string, limit = 200): Promise<SheetEvent[]> {
  const events = await db.projectSheetEvent.findMany({
    where: { sheetId, type: { in: SHOWN_IN_HISTORY } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { firstName: true, lastName: true } },
      actorClient: { select: { name: true } },
    },
  })
  return events.map((e) => ({
    id: e.id,
    type: e.type as SheetEventType,
    label: e.label,
    before: e.before,
    after: e.after,
    // A client edit has no employee actor, so without the fallback every change
    // made from the portal would read as having no author - which is the one
    // question a history exists to answer. Marked as the client, because "who"
    // and "which side" are the same question here.
    actorName: name(e.actor) ?? (e.actorClient ? `${e.actorClient.name} (client)` : null),
    at: e.createdAt.toISOString(),
  }))
}

/** Confirms a sheet belongs to the project in the URL. Every write calls it. */
export async function sheetBelongsToProject(sheetId: string, projectId: string): Promise<boolean> {
  const s = await db.projectSheet.findUnique({
    where: { id: sheetId },
    select: { projectId: true },
  })
  return !!s && s.projectId === projectId
}

// ─────────────────────────────────────────────────────────────────────────────
// Workbooks - what the UI calls a "sheet": a named set of tabs
// ─────────────────────────────────────────────────────────────────────────────

const WORKBOOK_INCLUDE = {
  createdBy: { select: { firstName: true, lastName: true } },
  // So a client-started calendar says who started it instead of reading as
  // authorless on the team's Calendars tab.
  createdByClient: { select: { name: true } },
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, profilePhoto: true },
  },
  // A single-key orderBy on purpose: an `as const` array is a readonly tuple,
  // which Prisma's include type rejects. Positions are assigned in order anyway.
  sheets: { orderBy: { position: "asc" }, include: SHEET_INCLUDE },
} as const

type WorkbookRecord = Prisma.ProjectWorkbookGetPayload<{ include: typeof WORKBOOK_INCLUDE }>

function toWorkbook(w: WorkbookRecord): SheetWorkbook {
  return {
    id: w.id,
    name: w.name,
    // The portal gets this too, and needs it: once the month leaves the NAME,
    // a client looking at twelve identically-named calendars has nothing to
    // tell them apart by.
    periodMonth: w.periodMonth ? ymd(w.periodMonth) : null,
    position: w.position,
    // "(client)" for the same reason getSheetHistory says it: on the team's
    // Calendars tab an unqualified name reads as a colleague.
    createdByName:
      name(w.createdBy) ?? (w.createdByClient ? `${w.createdByClient.name} (client)` : null),
    createdByClientId: w.createdByClientId,
    assignedTo: w.assignedTo,
    isClientVisible: w.isClientVisible,
    updatedAt: w.updatedAt.toISOString(),
    sheets: w.sheets.map(toSheet),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The per-team plan.
//
// ── WHY THIS IS A SEPARATE INCLUDE AND A SEPARATE MAPPER ─────────────────────
// WORKBOOK_INCLUDE and toWorkbook above are shared with the CLIENT PORTAL:
// listClientWorkbooks maps through the same pair, and isClientVisible filters
// which WORKBOOKS are returned, not which FIELDS. So adding `teams` to that
// include would ship the internal plan - staff names, agreed quantities,
// internal deadlines, attached-file metadata - to every client with a shared
// calendar, with no code change in the portal at all.
//
// Keeping the plan in its own include and its own return type means the leak
// cannot happen by someone adding a line to the wrong object. It is the same
// argument listClientWorkbooks already makes for being a separate function.
// ─────────────────────────────────────────────────────────────────────────────

const WORKBOOK_TEAM_INCLUDE = {
  team: { select: { id: true, name: true, managerId: true } },
  members: {
    orderBy: { addedAt: "asc" },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePhoto: true,
          designation: { select: { title: true } },
        },
      },
    },
  },
  attachments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      driveFileId: true,
      createdAt: true,
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
  },
} as const

type WorkbookTeamRecord = Prisma.ProjectWorkbookTeamGetPayload<{
  include: typeof WORKBOOK_TEAM_INCLUDE
}>

function toWorkbookTeam(t: WorkbookTeamRecord): WorkbookTeam {
  return {
    id: t.id,
    teamId: t.teamId,
    // Denormalised into the payload on purpose. The panel renders from one
    // query; looking the name up against the separately-cached team list would
    // flash "Unknown team" whenever the two land out of order, and that list is
    // cached for 30s, so the window is real rather than theoretical.
    teamName: t.team.name,
    teamManagerId: t.team.managerId,
    quantity: t.quantity,
    status: t.status,
    dueOn: t.dueOn ? ymd(t.dueOn) : null,
    links: t.links,
    notes: t.notes,
    members: t.members.map((m) => ({
      employeeId: m.employee.id,
      firstName: m.employee.firstName,
      lastName: m.employee.lastName,
      profilePhoto: m.employee.profilePhoto,
      designation: m.employee.designation?.title ?? null,
    })),
    attachments: t.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      driveFileId: a.driveFileId,
      uploadedByName: name(a.uploadedBy),
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

/**
 * Every calendar on the project as the PICKER needs it: named, dated, and
 * nothing else.
 *
 * Tab NAMES but no columns and no rows. The picker lists every edition of every
 * calendar, and monthly editions mean that list grows by twelve a year per
 * calendar - sending each one's whole grid just to draw a dropdown would make
 * opening the tab cost more every month the project is running. The open
 * edition is fetched on its own by getWorkbook.
 */
export async function listWorkbookIndex(projectId: string): Promise<WorkbookIndexEntry[]> {
  const books = await db.projectWorkbook.findMany({
    where: { projectId },
    // Name first, then newest month, because that is the order the picker
    // groups them in - one row per name, months descending beneath it.
    orderBy: [{ name: "asc" }, { periodMonth: "desc" }, { position: "asc" }],
    select: {
      id: true,
      name: true,
      periodMonth: true,
      position: true,
      createdByClientId: true,
      isClientVisible: true,
      updatedAt: true,
      createdBy: { select: { firstName: true, lastName: true } },
      createdByClient: { select: { name: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
      sheets: { orderBy: { position: "asc" }, select: { id: true, name: true, position: true } },
    },
  })
  return books.map((w) => ({
    id: w.id,
    name: w.name,
    periodMonth: w.periodMonth ? ymd(w.periodMonth) : null,
    position: w.position,
    createdByName:
      name(w.createdBy) ?? (w.createdByClient ? `${w.createdByClient.name} (client)` : null),
    createdByClientId: w.createdByClientId,
    assignedTo: w.assignedTo,
    isClientVisible: w.isClientVisible,
    updatedAt: w.updatedAt.toISOString(),
    tabs: w.sheets,
  }))
}

/**
 * ONE calendar in full - the grid, plus the team plan. Staff only.
 *
 * What the month stepper fetches when it lands on a month. Returns null rather
 * than throwing when the id is not on this project, so the route can 404.
 */
export async function getWorkbook(
  projectId: string,
  workbookId: string,
): Promise<StaffWorkbook | null> {
  const book = await db.projectWorkbook.findFirst({
    where: { id: workbookId, projectId },
    include: WORKBOOK_INCLUDE,
  })
  if (!book) return null
  const teams = await db.projectWorkbookTeam.findMany({
    where: { workbookId },
    include: WORKBOOK_TEAM_INCLUDE,
  })
  // Catalogue order (WEB, DESIGN, MAP, VIDEO, AMG/SMO, ADMIN), so the plan
  // reads the same way on every calendar and muscle memory works.
  // sortProjectTeams keys off `name`, which here is the TEAM's name, so the
  // rows are sorted as teams and then unwrapped.
  const ordered = sortProjectTeams(
    teams.map((t) => ({ name: t.team.name, row: toWorkbookTeam(t) })),
  ).map((t) => t.row)

  return { ...toWorkbook(book), teams: ordered }
}

/** Every workbook on the project, each with its tabs (columns and rows included). */
export async function listWorkbooks(projectId: string): Promise<SheetWorkbook[]> {
  const books = await db.projectWorkbook.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: WORKBOOK_INCLUDE,
  })
  return books.map(toWorkbook)
}

/**
 * The calendars a CLIENT may see: the shared ones, and only from this project.
 *
 * A separate function rather than a flag on listWorkbooks, so the portal cannot
 * accidentally call the unfiltered one - the narrow query is the only thing the
 * portal service imports.
 */
export async function listClientWorkbooks(projectId: string): Promise<SheetWorkbook[]> {
  const books = await db.projectWorkbook.findMany({
    where: { projectId, isClientVisible: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: WORKBOOK_INCLUDE,
  })
  return books.map(toWorkbook)
}

/**
 * Is this sheet on a calendar THIS project has SHARED with its client?
 *
 * The portal's write guard. `sheetBelongsToProject` is not enough on its own -
 * it would happily accept a sheet from an internal calendar on the same
 * project, which is exactly the thing the share flag exists to prevent.
 */
export async function sheetIsClientVisible(
  sheetId: string,
  projectId: string,
  workbookId?: string,
): Promise<boolean> {
  const sheet = await db.projectSheet.findFirst({
    // workbookId is the calendar named in the portal's URL. Checking it makes
    // that path segment load-bearing rather than decorative: a sheet id can
    // then only be written through the calendar it actually belongs to.
    where: { id: sheetId, projectId, workbookId, workbook: { isClientVisible: true } },
    select: { id: true },
  })
  return sheet !== null
}

/** Publish a calendar to the client portal, or withdraw it. */
export async function setWorkbookClientVisible(
  workbookId: string,
  isClientVisible: boolean,
): Promise<void> {
  await db.projectWorkbook.update({ where: { id: workbookId }, data: { isClientVisible } })
}

export async function workbookBelongsToProject(
  workbookId: string,
  projectId: string,
): Promise<boolean> {
  const w = await db.projectWorkbook.findUnique({
    where: { id: workbookId },
    select: { projectId: true },
  })
  return !!w && w.projectId === projectId
}

/**
 * "2026-09-01" -> a UTC Date on the first of that month, or null.
 *
 * Forced to the 1st rather than trusted: the unique index treats September
 * stored as the 15th as a DIFFERENT September, so a stray day would let a
 * second September exist. A CHECK constraint backs this up in the database.
 */
export function parsePeriodMonth(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})/.exec(value)
  if (!m) throw new Error("A month must look like 2026-09")
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) throw new Error("A month must look like 2026-09")
  return new Date(Date.UTC(year, month - 1, 1))
}

/**
 * A name on a project is EITHER a series of months OR one undated calendar -
 * never both.
 *
 * Nothing in the database can express this: "for a given (project, name),
 * period_month is either all-NULL or all-NOT-NULL" needs an exclusion
 * constraint or a trigger. The two unique indexes each police their own half
 * and are blind to the other, so without this check a client creating an
 * undated "Q4 Plan" from the portal would quietly sit alongside the team's
 * monthly "Q4 Plan" editions under the same name - exactly the confusion the
 * old single index used to prevent.
 */
async function assertNameShape(
  projectId: string,
  title: string,
  periodMonth: Date | null,
  ignoreWorkbookId?: string,
): Promise<void> {
  const clash = await db.projectWorkbook.findFirst({
    where: {
      projectId,
      name: title,
      periodMonth: periodMonth ? null : { not: null },
      ...(ignoreWorkbookId ? { id: { not: ignoreWorkbookId } } : {}),
    },
    select: { id: true },
  })
  if (!clash) return
  throw new Error(
    periodMonth
      ? `"${title}" already exists on this project as a calendar with no month. Give that one a month first, or use a different name.`
      : // Reached both when creating an undated twin of a monthly calendar and
        // when trying to CLEAR the month of one edition while its siblings keep
        // theirs. Naming the second case matters: the button that does it sits
        // on a calendar that plainly has other months, so "use a different
        // name" on its own would read as nonsense.
        ignoreWorkbookId
        ? `"${title}" has other months. Take the month off every one of them, or delete this edition instead.`
        : `"${title}" is already a monthly calendar on this project. Pick a month for this one, or use a different name.`,
  )
}

/**
 * A workbook opens with one tab, so there is always somewhere to type: a
 * workbook with no tabs is a name and nothing else.
 */
/**
 * Create a calendar and its first tab.
 *
 * `actorId` is an EMPLOYEE id. A client creating their own calendar from the
 * portal passes null plus `actorClientId`, exactly as addRow and writeCellsAt
 * do, and also passes `isClientVisible` - a calendar somebody made for
 * themselves that they then could not see would be absurd, and the flag is the
 * only thing that puts it on their list.
 */
export async function createWorkbook(
  projectId: string,
  actorId: string | null,
  input: {
    name: string
    firstTab?: string | null
    isClientVisible?: boolean
    actorClientId?: string | null
    /** "2026-09" or "2026-09-01". Omitted / null = an undated calendar. */
    periodMonth?: string | null
    /**
     * Start this month from an existing edition instead of from nothing.
     *
     * What is copied and what is NOT is the whole design here - see
     * copyEditionInto below.
     */
    copyFrom?: {
      workbookId: string
      /** Tabs, their columns and the row heights. Default true. */
      structure?: boolean
      /** Teams, their people and their quantities. Default true. */
      teamPlan?: boolean
    } | null
  },
): Promise<SheetWorkbook> {
  const title = input.name.trim()
  if (!title) throw new Error("A sheet needs a name")
  const periodMonth = parsePeriodMonth(input.periodMonth)
  await assertNameShape(projectId, title, periodMonth)
  const last = await db.projectWorkbook.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  })
  // The source is read BEFORE the workbook is created, so a bad copyFrom fails
  // without leaving an empty calendar behind occupying the month's slot.
  const source = input.copyFrom
    ? await db.projectWorkbook.findFirst({
        where: { id: input.copyFrom.workbookId, projectId },
        include: {
          // Columns and layout, never rows - see below.
          sheets: {
            orderBy: { position: "asc" },
            include: { columns: { orderBy: { position: "asc" } } },
          },
          teams: { include: { members: { select: { employeeId: true } } } },
        },
      })
    : null
  if (input.copyFrom && !source) throw new Error("The calendar to copy from was not found")

  const book = await db.projectWorkbook.create({
    data: {
      projectId,
      name: title,
      periodMonth,
      position: (last?.position ?? -1) + 1,
      createdById: actorId,
      // Recorded on the workbook, not just in its first tab's history: this is
      // what the portal's delete rule reads, and a rule that has to walk the
      // event log to answer "is this yours" is a rule that will one day be
      // asked about a calendar whose events have been trimmed.
      createdByClientId: input.actorClientId ?? null,
      isClientVisible: input.isClientVisible ?? false,
      // The calendar manager carries forward. Handing September to somebody and
      // then finding October unassigned is the kind of small gap that turns a
      // monthly rhythm back into a chase.
      assignedToId: source?.assignedToId ?? null,
    },
  })

  const copyStructure = source && (input.copyFrom?.structure ?? true)
  if (copyStructure && source.sheets.length > 0) {
    for (const tab of source.sheets) {
      await db.projectSheet.create({
        data: {
          projectId,
          workbookId: book.id,
          name: tab.name,
          description: tab.description,
          position: tab.position,
          // Layout, not content. Losing the row heights makes October look
          // wrong for no reason anybody can act on.
          rowHeights: tab.rowHeights ?? undefined,
          createdById: actorId,
          columns: {
            create: tab.columns.map((c) => ({
              name: c.name,
              type: c.type,
              position: c.position,
              width: c.width,
              options: c.options ?? undefined,
            })),
          },
          // NO ROWS. An empty month is the point: last month's posts are last
          // month's, and copying them makes a fresh month look full - which is
          // how September's plan ends up shipped in October.
        },
      })
    }
  } else {
    await createSheet(projectId, actorId, {
      workbookId: book.id,
      name: input.firstTab?.trim() || "Tab 1",
      actorClientId: input.actorClientId,
    })
  }

  if (source && (input.copyFrom?.teamPlan ?? true) && source.teams.length > 0) {
    // Only people who are STILL on that team. Somebody who left Design in
    // September must not reappear on October's plan.
    const stillOnTeam = await db.projectTeamMember.findMany({
      where: { projectId, teamId: { in: source.teams.map((t) => t.teamId) } },
      select: { teamId: true, employeeId: true },
    })
    const rosters = new Map<string, Set<string>>()
    for (const m of stillOnTeam) {
      const set = rosters.get(m.teamId) ?? new Set<string>()
      set.add(m.employeeId)
      rosters.set(m.teamId, set)
    }

    for (const t of source.teams) {
      const roster = rosters.get(t.teamId) ?? new Set<string>()
      const keep = t.members.map((m) => m.employeeId).filter((id) => roster.has(id))
      await db.projectWorkbookTeam.create({
        data: {
          workbookId: book.id,
          teamId: t.teamId,
          quantity: t.quantity,
          notes: t.notes,
          createdById: actorId,
          // dueOn and links are deliberately NOT copied. Both name a specific
          // month's work: a due date carried forward is instantly overdue, and
          // September's task URL on October's plan is actively misleading.
          members: { create: keep.map((employeeId) => ({ workbookId: book.id, employeeId })) },
        },
      })
    }
  }

  const full = await db.projectWorkbook.findUniqueOrThrow({
    where: { id: book.id },
    include: WORKBOOK_INCLUDE,
  })
  return toWorkbook(full)
}

/**
 * Rename a calendar - every month of it.
 *
 * RENAMES THE WHOLE SERIES, not the one edition. The name is what ties the
 * months together: renaming September alone would leave it and October as two
 * unrelated calendars, and "pick the calendar, then step the months" would
 * quietly stop working for both. There is no UI for renaming one month, because
 * there is no such thing - a month is identified by its month.
 */
export async function renameWorkbook(workbookId: string, name: string): Promise<SheetWorkbook> {
  const title = name.trim()
  if (!title) throw new Error("A sheet needs a name")

  const current = await db.projectWorkbook.findUniqueOrThrow({
    where: { id: workbookId },
    select: { projectId: true, name: true, periodMonth: true },
  })
  if (current.name === title) {
    const unchanged = await db.projectWorkbook.findUniqueOrThrow({
      where: { id: workbookId },
      include: WORKBOOK_INCLUDE,
    })
    return toWorkbook(unchanged)
  }

  // The whole series has to be free under the new name, not just this edition:
  // a per-row check would pass on September and then fail halfway through
  // October, leaving the series split across two names.
  const taken = await db.projectWorkbook.findFirst({
    where: { projectId: current.projectId, name: title },
    select: { id: true },
  })
  if (taken) throw new Error("A calendar with that name already exists on this project")

  await db.projectWorkbook.updateMany({
    where: { projectId: current.projectId, name: current.name },
    data: { name: title },
  })

  const full = await db.projectWorkbook.findUniqueOrThrow({
    where: { id: workbookId },
    include: WORKBOOK_INCLUDE,
  })
  return toWorkbook(full)
}

/**
 * Give an edition a month, move it to another, or take its month away.
 *
 * The migration path off the "(H2S-Sept)" naming: a person who knows which
 * month a legacy calendar was sets it, one calendar at a time. Nothing guesses
 * it from the name - "(H2S-Sept)" could be September 2025 or September 2026,
 * and a calendar silently filed under the wrong month is one nobody thinks to
 * look for.
 */
export async function setWorkbookMonth(
  workbookId: string,
  periodMonth: string | null,
): Promise<SheetWorkbook> {
  const month = parsePeriodMonth(periodMonth)
  const current = await db.projectWorkbook.findUniqueOrThrow({
    where: { id: workbookId },
    select: { projectId: true, name: true },
  })
  await assertNameShape(current.projectId, current.name, month, workbookId)

  const clash = await db.projectWorkbook.findFirst({
    where: {
      projectId: current.projectId,
      name: current.name,
      periodMonth: month,
      id: { not: workbookId },
    },
    select: { id: true },
  })
  if (clash) throw new Error("That calendar already has an edition for that month")

  const full = await db.projectWorkbook.update({
    where: { id: workbookId },
    data: { periodMonth: month },
    include: WORKBOOK_INCLUDE,
  })
  return toWorkbook(full)
}

/**
 * Hand a workbook to someone, or to nobody (null). The caller decides WHO may
 * do this and that the employee is a real, active one - this only writes it.
 */
export async function assignWorkbook(
  workbookId: string,
  employeeId: string | null,
): Promise<SheetWorkbook> {
  const full = await db.projectWorkbook.update({
    where: { id: workbookId },
    data: { assignedToId: employeeId },
    include: WORKBOOK_INCLUDE,
  })
  return toWorkbook(full)
}

/** Manager-only. Cascades to every tab, their columns, rows and history. */
export async function deleteWorkbook(workbookId: string): Promise<void> {
  await db.projectWorkbook.delete({ where: { id: workbookId } })
}

/**
 * One SHARED workbook on one project, or null - the portal's lookup.
 *
 * Both filters matter and neither is redundant: `projectId` stops an id from
 * another project resolving, and `isClientVisible` stops an internal calendar
 * on the RIGHT project resolving. It returns just enough to decide what may be
 * done with it, so callers do not reach for the full record and then have to
 * remember not to send it.
 */
export async function getClientVisibleWorkbook(
  workbookId: string,
  projectId: string,
): Promise<{ id: string; name: string; createdByClientId: string | null } | null> {
  return db.projectWorkbook.findFirst({
    where: { id: workbookId, projectId, isClientVisible: true },
    select: { id: true, name: true, createdByClientId: true },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheets - one TAB of a workbook: a grid of columns and rows
// ─────────────────────────────────────────────────────────────────────────────

export async function createSheet(
  projectId: string,
  actorId: string | null,
  input: {
    workbookId: string
    name: string
    description?: string | null
    /** Set instead of actorId when a client created it from the portal. */
    actorClientId?: string | null
  },
): Promise<ProjectSheet> {
  const title = input.name.trim()
  if (!title) throw new Error("A tab needs a name")
  if (!(await workbookBelongsToProject(input.workbookId, projectId))) {
    throw new Error("Sheet not found")
  }

  const last = await db.projectSheet.findFirst({
    where: { workbookId: input.workbookId },
    orderBy: { position: "desc" },
    select: { position: true },
  })

  const sheet = await db.projectSheet.create({
    data: {
      projectId,
      workbookId: input.workbookId,
      name: title,
      description: input.description?.trim() || null,
      position: (last?.position ?? -1) + 1,
      createdById: actorId,
      // A..Z up front, like any spreadsheet. Cheap (26 rows) and it means the
      // sheet opens as a grid you can type anywhere in rather than a table with
      // one column and an "add column" button.
      columns: {
        create: Array.from({ length: DEFAULT_COLUMNS }, (_, i) => ({
          name: columnLetter(i),
          type: "TEXT" as const,
          position: i,
        })),
      },
      // NO rows. Rows are created the moment something is typed into one - see
      // writeCellsAt. Materialising a thousand empty rows per sheet would put
      // them all in every read of every sheet, for nothing.
    },
    include: SHEET_INCLUDE,
  })

  await record(sheet.id, actorId, "SHEET_CREATED", {
    label: sheet.name,
    actorClientId: input.actorClientId,
  })
  return toSheet(sheet)
}

export async function renameSheet(
  sheetId: string,
  actorId: string,
  input: { name?: string; description?: string | null },
): Promise<ProjectSheet> {
  const current = await db.projectSheet.findUniqueOrThrow({
    where: { id: sheetId },
    select: { name: true, description: true },
  })
  const title = input.name?.trim()
  if (input.name !== undefined && !title) throw new Error("A sheet needs a name")

  const sheet = await db.projectSheet.update({
    where: { id: sheetId },
    data: {
      ...(title ? { name: title } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
    },
    include: SHEET_INCLUDE,
  })

  await record(sheetId, actorId, "SHEET_RENAMED", {
    label: sheet.name,
    before: { name: current.name, description: current.description },
    after: { name: sheet.name, description: sheet.description },
  })
  return toSheet(sheet)
}

/**
 * Resize a row or a column.
 *
 * Layout, not content: NOTHING is written to the history. A drag produces
 * dozens of these, and a log where every third entry says a column got four
 * pixels wider is a log nobody can find a real edit in.
 *
 * Anyone on the project can do it, like any other edit. Both dimensions are
 * clamped server-side - a zero-width column would be unrecoverable through the
 * UI that made it.
 */
export async function resize(
  sheetId: string,
  input: {
    rowHeight?: { position: number; height: number }
    columnWidth?: { columnId: string; width: number }
  },
): Promise<void> {
  if (input.columnWidth) {
    const width = Math.min(MAX_COL_W, Math.max(MIN_COL_W, Math.round(input.columnWidth.width)))
    await db.projectSheetColumn.update({
      where: { id: input.columnWidth.columnId },
      data: { width },
    })
  }
  if (input.rowHeight) {
    const { position } = input.rowHeight
    const height = Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, Math.round(input.rowHeight.height)))
    const sheet = await db.projectSheet.findUniqueOrThrow({
      where: { id: sheetId },
      select: { rowHeights: true },
    })
    const heights = asHeights(sheet.rowHeights)
    heights[String(position)] = height
    await db.projectSheet.update({
      where: { id: sheetId },
      data: { rowHeights: heights as Prisma.InputJsonValue },
    })
  }
}

/** Manager-only. Cascades to columns, rows and the sheet's own history. */
export async function deleteSheet(sheetId: string): Promise<void> {
  await db.projectSheet.delete({ where: { id: sheetId } })
}

// ─────────────────────────────────────────────────────────────────────────────
// Columns
// ─────────────────────────────────────────────────────────────────────────────

export async function addColumn(
  sheetId: string,
  actorId: string,
  input: { name: string; type: SheetColumnType; options?: string[] },
): Promise<SheetColumn> {
  const title = input.name.trim()
  if (!title) throw new Error("A column needs a name")

  const last = await db.projectSheetColumn.findFirst({
    where: { sheetId },
    orderBy: { position: "desc" },
    select: { position: true },
  })
  const column = await db.projectSheetColumn.create({
    data: {
      sheetId,
      name: title,
      type: input.type,
      position: (last?.position ?? -1) + 1,
      options:
        input.type === "SELECT" ? ((input.options ?? []) as Prisma.InputJsonValue) : undefined,
    },
  })

  await record(sheetId, actorId, "COLUMN_ADDED", {
    columnId: column.id,
    label: column.name,
    after: { name: column.name, type: column.type },
  })
  return {
    id: column.id,
    name: column.name,
    type: column.type as SheetColumnType,
    position: column.position,
    width: column.width,
    options: asOptions(column.options),
  }
}

export async function updateColumn(
  columnId: string,
  actorId: string,
  input: { name?: string; type?: SheetColumnType; options?: string[]; width?: number | null },
): Promise<SheetColumn> {
  const current = await db.projectSheetColumn.findUniqueOrThrow({ where: { id: columnId } })
  const title = input.name?.trim()
  if (input.name !== undefined && !title) throw new Error("A column needs a name")

  const column = await db.projectSheetColumn.update({
    where: { id: columnId },
    data: {
      ...(title ? { name: title } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.options !== undefined ? { options: input.options as Prisma.InputJsonValue } : {}),
    },
  })

  // A width drag is not a change anyone wants in the history - it would bury
  // the edits that matter under a hundred resize entries.
  const meaningful = title !== undefined || input.type !== undefined || input.options !== undefined
  if (meaningful) {
    await record(current.sheetId, actorId, "COLUMN_UPDATED", {
      columnId,
      label: column.name,
      before: { name: current.name, type: current.type },
      after: { name: column.name, type: column.type },
    })
  }
  return {
    id: column.id,
    name: column.name,
    type: column.type as SheetColumnType,
    position: column.position,
    width: column.width,
    options: asOptions(column.options),
  }
}

/**
 * Manager-only, and the most destructive thing in here: it discards that
 * column's value in EVERY row.
 *
 * The values are copied into the history event before the column goes, so the
 * change is at least legible afterwards - which is the difference between a
 * recoverable mistake and a silent one.
 */
export async function deleteColumn(columnId: string, actorId: string): Promise<void> {
  const column = await db.projectSheetColumn.findUniqueOrThrow({ where: { id: columnId } })
  const rows = await db.projectSheetRow.findMany({
    where: { sheetId: column.sheetId },
    select: { id: true, cells: true },
  })
  const discarded = rows
    .map((r) => ({ rowId: r.id, value: asCells(r.cells)[columnId] ?? null }))
    .filter((v) => v.value !== null)

  await db.projectSheetColumn.delete({ where: { id: columnId } })

  // The cells stay in each row's JSON otherwise, invisible but taking space and
  // ready to reappear if a new column ever reused the id.
  await Promise.all(
    rows.map((r) => {
      const cells = asCells(r.cells)
      if (!(columnId in cells)) return null
      delete cells[columnId]
      return db.projectSheetRow.update({
        where: { id: r.id },
        data: { cells: cells as Prisma.InputJsonValue },
      })
    }),
  )

  await record(column.sheetId, actorId, "COLUMN_DELETED", {
    columnId,
    label: column.name,
    before: { name: column.name, type: column.type, values: discarded },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Rows and cells
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append a row.
 *
 * `actorId` is an EMPLOYEE id, and a portal client is not an employee - they
 * pass null here and their id as `actorClientId`, which is what the event
 * records. `row.createdById` is then left null: the history is where "who" is
 * answered, and a second actor pair on the row itself would add a column to
 * keep in step for nothing.
 */
export async function addRow(
  sheetId: string,
  actorId: string | null,
  actorClientId?: string | null,
): Promise<void> {
  const last = await db.projectSheetRow.findFirst({
    where: { sheetId },
    orderBy: { position: "desc" },
    select: { position: true },
  })
  const row = await db.projectSheetRow.create({
    data: { sheetId, position: (last?.position ?? -1) + 1, createdById: actorId },
  })
  await record(sheetId, actorId, "ROW_ADDED", { rowId: row.id, actorClientId })
}

/**
 * Write one or more cells on a row.
 *
 * Merged into the existing blob rather than replacing it, so two people editing
 * different columns of the same row do not overwrite each other. One event per
 * CHANGED cell, and unchanged values are dropped before anything is written -
 * clicking into a cell and out again is not an edit and must not read as one.
 */
export async function updateCells(
  rowId: string,
  actorId: string | null,
  updates: Record<string, unknown>,
  actorClientId?: string | null,
): Promise<void> {
  const row = await db.projectSheetRow.findUniqueOrThrow({ where: { id: rowId } })
  const columns = await db.projectSheetColumn.findMany({ where: { sheetId: row.sheetId } })
  const byId = new Map(columns.map((c) => [c.id, c]))

  const cells = asCells(row.cells)
  const changes: { columnId: string; label: string; before: CellValue; after: CellValue }[] = []

  for (const [columnId, raw] of Object.entries(updates)) {
    const column = byId.get(columnId)
    // Silently ignore a column that is not on this sheet: it means the client
    // is holding a stale layout, which a 422 would turn into a lost edit.
    if (!column) continue
    const next = normalizeCell(column.type as SheetColumnType, raw)
    const prev = cells[columnId] ?? null
    if (prev === next) continue
    cells[columnId] = next
    changes.push({ columnId, label: column.name, before: prev, after: next })
  }
  if (changes.length === 0) return

  await db.projectSheetRow.update({
    where: { id: rowId },
    data: { cells: cells as Prisma.InputJsonValue },
  })
  for (const c of changes) {
    await record(row.sheetId, actorId, "CELL_UPDATED", {
      rowId,
      columnId: c.columnId,
      label: c.label,
      before: c.before,
      after: c.after,
      actorClientId,
    })
  }
}

/**
 * Write cells at a row POSITION, creating the row if it is not there yet.
 *
 * This is what makes every row on screen live. The grid draws a thousand of
 * them; only the ones somebody has typed into become database rows, and they
 * are created at the position that was typed in - gaps are fine, because rows
 * are ordered by position and the number in the gutter IS the position.
 *
 * Without this, "make all the rows active" would mean inserting a thousand
 * empty rows per sheet and returning them in every read.
 */
export async function writeCellsAt(
  sheetId: string,
  position: number,
  actorId: string | null,
  cells: Record<string, unknown>,
  actorClientId?: string | null,
): Promise<void> {
  let row = await db.projectSheetRow.findFirst({ where: { sheetId, position } })
  if (!row) {
    // Nothing to write and no row to write it to: don't create an empty row
    // just because someone clicked a cell and pressed Escape.
    const meaningful = Object.values(cells).some((v) => v !== null && v !== "")
    if (!meaningful) return
    row = await db.projectSheetRow.create({ data: { sheetId, position, createdById: actorId } })
    await record(sheetId, actorId, "ROW_ADDED", { rowId: row.id, actorClientId })
  }
  await updateCells(row.id, actorId, cells, actorClientId)
}

/**
 * Append many rows at once - the file importer's path.
 *
 * Rows land after the last occupied position, and every value goes through
 * the same normaliser a typed edit does. Fully empty rows are dropped (a CSV
 * usually ends with a few). History gets one ROW_ADDED per row rather than a
 * CELL_UPDATED per cell: a 500-row import must not write 5,000 log entries
 * nobody will ever scroll.
 */
export async function importRows(
  sheetId: string,
  actorId: string,
  rows: Record<string, unknown>[],
): Promise<{ imported: number; firstPosition: number }> {
  const columns = await db.projectSheetColumn.findMany({
    where: { sheetId },
    select: { id: true, type: true },
  })
  const typeOf = new Map(columns.map((c) => [c.id, c.type as SheetColumnType]))
  const last = await db.projectSheetRow.findFirst({
    where: { sheetId },
    orderBy: { position: "desc" },
    select: { position: true },
  })
  const firstPosition = (last?.position ?? -1) + 1
  let position = firstPosition

  const data: Prisma.ProjectSheetRowCreateManyInput[] = []
  for (const raw of rows) {
    const cells: Record<string, CellValue> = {}
    for (const [columnId, value] of Object.entries(raw)) {
      const type = typeOf.get(columnId)
      if (!type) continue // stale column - same rule as updateCells
      const next = normalizeCell(type, value)
      if (next !== null) cells[columnId] = next
    }
    if (Object.keys(cells).length === 0) continue
    data.push({
      sheetId,
      position: position++,
      createdById: actorId,
      cells: cells as Prisma.InputJsonValue,
    })
  }
  if (data.length === 0) return { imported: 0, firstPosition }

  await db.projectSheetRow.createMany({ data })
  const created = await db.projectSheetRow.findMany({
    where: { sheetId, position: { gte: firstPosition } },
    select: { id: true },
  })
  for (const r of created)
    await record(sheetId, actorId, "ROW_ADDED", { rowId: r.id, label: "Imported" })
  return { imported: data.length, firstPosition }
}

/** Manager-only. The row's values go into the history before it goes. */
export async function deleteRow(rowId: string, actorId: string): Promise<void> {
  const row = await db.projectSheetRow.findUniqueOrThrow({ where: { id: rowId } })
  const columns = await db.projectSheetColumn.findMany({ where: { sheetId: row.sheetId } })
  const cells = asCells(row.cells)
  // Stored by column NAME, not id: a history entry has to stay readable after
  // the column it refers to has itself been deleted.
  const snapshot = Object.fromEntries(
    columns.filter((c) => cells[c.id] != null).map((c) => [c.name, cells[c.id] ?? null]),
  )

  await db.projectSheetRow.delete({ where: { id: rowId } })
  await record(row.sheetId, actorId, "ROW_DELETED", { rowId, before: snapshot })
}

// ─────────────────────────────────────────────────────────────────────────────
// The per-team plan: what each team owes on one month's calendar.
//
// Keyed on (workbookId, teamId) throughout rather than on the row's own id, and
// that is deliberate: the six teams are a fixed catalogue, so the pair IS the
// row's natural key. It means the API can be one PUT on
// /workbooks/<workbookId>/teams/<teamId> with nothing to create-then-fetch, and
// - the part that actually matters - it lets the route GUARD read the team out
// of the URL. A guard cannot read the body to find out which team is being
// edited without consuming the stream the handler then needs.
// ─────────────────────────────────────────────────────────────────────────────

/** One team's row, or null. The shape every write below returns. */
export async function getWorkbookTeam(
  workbookId: string,
  teamId: string,
): Promise<WorkbookTeam | null> {
  const row = await db.projectWorkbookTeam.findUnique({
    where: { workbookId_teamId: { workbookId, teamId } },
    include: WORKBOOK_TEAM_INCLUDE,
  })
  return row ? toWorkbookTeam(row) : null
}

/** Every team on this calendar's plan, in catalogue order. */
export async function listWorkbookTeams(workbookId: string): Promise<WorkbookTeam[]> {
  const rows = await db.projectWorkbookTeam.findMany({
    where: { workbookId },
    include: WORKBOOK_TEAM_INCLUDE,
  })
  return sortProjectTeams(rows.map((r) => ({ name: r.team.name, row: toWorkbookTeam(r) }))).map(
    (r) => r.row,
  )
}

/**
 * Put a team on the plan, or change what it owes. Idempotent by (calendar, team).
 *
 * One write for the whole row - quantity, due date, links, notes and the PEOPLE
 * - because that is how the form is filled in. Members are a SET: whatever is
 * passed replaces what was there. A multi-select is one control and deserves
 * one request, and "a team manager edits their own row" already covers
 * membership, so separate add/remove endpoints would be three guards for one
 * gesture.
 *
 * Every field is optional; an omitted one is left alone, so the same call
 * serves "add VIDEO" and "change VIDEO's due date".
 */
export async function upsertWorkbookTeam(
  workbookId: string,
  teamId: string,
  actorId: string | null,
  input: {
    quantity?: number | null
    /** "YYYY-MM-DD", or null to clear it. */
    dueOn?: string | null
    links?: string[]
    notes?: string | null
    /** Replaces the current set. Omit to leave the people alone. */
    employeeIds?: string[]
    status?: WorkbookTeamStatus
  },
): Promise<{ team: WorkbookTeam; created: boolean; addedEmployeeIds: string[] }> {
  const team = await db.projectTeam.findFirst({
    where: { id: teamId },
    select: { id: true, projectId: true, name: true },
  })
  if (!team) throw new Error("Team not found")

  const workbook = await db.projectWorkbook.findFirst({
    where: { id: workbookId, projectId: team.projectId },
    select: { id: true },
  })
  if (!workbook) throw new Error("That team is not on this project")

  // Whoever is named must actually be ON that team. Without this a manager
  // could drop a Design person onto the VIDEO row, and the Teams tab and the
  // calendar would then disagree about who is on Design. It is also what makes
  // "one team per calendar per person" hold, since ProjectTeamMember already
  // guarantees one team per project per person.
  let members: string[] | null = null
  if (input.employeeIds) {
    const wanted = [...new Set(input.employeeIds)]
    const onTeam = await db.projectTeamMember.findMany({
      where: { teamId, employeeId: { in: wanted }, employee: { isActive: true, status: "ACTIVE" } },
      select: { employeeId: true },
    })
    const allowed = new Set(onTeam.map((m) => m.employeeId))
    if (wanted.some((id) => !allowed.has(id))) {
      throw new Error(
        `Everyone on a team's row has to be on that team. Add them to ${team.name} on the Teams tab first.`,
      )
    }
    members = wanted
  }

  const dueOn =
    input.dueOn === undefined
      ? undefined
      : input.dueOn
        ? new Date(`${input.dueOn}T00:00:00Z`)
        : null
  if (dueOn instanceof Date && Number.isNaN(dueOn.getTime())) {
    throw new Error("That due date is not a date")
  }
  if (input.quantity != null && (!Number.isInteger(input.quantity) || input.quantity < 0)) {
    throw new Error("A quantity is a whole number, or nothing at all")
  }

  const existing = await db.projectWorkbookTeam.findUnique({
    where: { workbookId_teamId: { workbookId, teamId } },
    select: {
      id: true,
      quantity: true,
      links: true,
      members: { select: { employeeId: true } },
      _count: { select: { attachments: true } },
    },
  })
  const before = new Set(existing?.members.map((m) => m.employeeId) ?? [])

  // ── DONE has to be earned ──────────────────────────────────────────────────
  // A team that promised four items needs four things handed over - links and
  // files counted together - before its row may read DONE. Checked against
  // what the row will look like AFTER this write, not before it, so setting
  // the last link and the status in one request works.
  //
  // Enforced here rather than in a CHECK constraint because the count spans
  // this table's `links` array and a COUNT over project_resources, and no
  // row-level constraint can see both.
  if (input.status) {
    const problem = statusProblem(
      input.status,
      teamProgress({
        quantity: input.quantity ?? existing?.quantity ?? 0,
        links: input.links ?? existing?.links ?? [],
        attachments: new Array(existing?._count.attachments ?? 0),
      }),
    )
    if (problem) throw new Error(problem)
  }

  await db.projectWorkbookTeam.upsert({
    where: { workbookId_teamId: { workbookId, teamId } },
    create: {
      workbookId,
      teamId,
      quantity: input.quantity ?? 0,
      status: input.status ?? "TODO",
      dueOn: dueOn ?? null,
      links: input.links ?? [],
      notes: input.notes ?? null,
      createdById: actorId,
      ...(members
        ? { members: { create: members.map((employeeId) => ({ workbookId, employeeId })) } }
        : {}),
    },
    update: {
      ...(input.quantity === undefined ? {} : { quantity: input.quantity ?? 0 }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(dueOn === undefined ? {} : { dueOn }),
      ...(input.links === undefined ? {} : { links: input.links }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      ...(members
        ? {
            // Replace the set. deleteMany-then-create rather than a diff: the
            // row carries nothing but the pair, so there is nothing to preserve
            // and a diff would only be a slower way to reach the same state.
            members: {
              deleteMany: {},
              create: members.map((employeeId) => ({ workbookId, employeeId })),
            },
          }
        : {}),
    },
  })

  const saved = await getWorkbookTeam(workbookId, teamId)
  if (!saved) throw new Error("Could not save that team's plan")
  return {
    team: saved,
    created: !existing,
    // Only the people who are NEW to the row: they are the ones worth telling.
    addedEmployeeIds: (members ?? []).filter((id) => !before.has(id)),
  }
}

/**
 * Take a team off a month's plan.
 *
 * Its FILES are detached, not deleted - the foreign key is ON DELETE SET NULL,
 * so they fall back to being ordinary project files on the Files tab. Taking a
 * team off a plan is an editing decision; destroying work they already handed
 * over is not something a planning panel should be able to do. The count comes
 * back so the UI can say what happened.
 */
export async function removeWorkbookTeam(
  workbookId: string,
  teamId: string,
): Promise<{ detachedFiles: number }> {
  const row = await db.projectWorkbookTeam.findUnique({
    where: { workbookId_teamId: { workbookId, teamId } },
    select: { id: true, _count: { select: { attachments: true } } },
  })
  if (!row) return { detachedFiles: 0 }
  await db.projectWorkbookTeam.delete({ where: { id: row.id } })
  return { detachedFiles: row._count.attachments }
}

/**
 * The plan row a file is being attached to, checked against the project.
 *
 * The upload route needs the teamId to decide whether the uploader may attach
 * to this row, and needs to know the row is on THIS project before it writes
 * the id onto a resource. One query answers both.
 */
export async function workbookTeamForProject(
  workbookTeamId: string,
  projectId: string,
): Promise<{ id: string; workbookId: string; teamId: string } | null> {
  return db.projectWorkbookTeam.findFirst({
    where: { id: workbookTeamId, workbook: { projectId } },
    select: { id: true, workbookId: true, teamId: true },
  })
}
