import "server-only"

import { db } from "@/server/db"
import { NotFoundError, ValidationError } from "@/lib/errors"
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

// Project sheets. Anyone on the project may create and edit; only the account manager/admin may
// delete (sheets, columns, rows). Every mutation appends a ProjectSheetEvent (never edited).

export const DEFAULT_COLUMNS = 26

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

/** Append one history entry. Best-effort: a successful edit must not fail because the log did. */
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

// The history dialog shows edits and deletions only (everything is still recorded).
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
    // Portal edits have no employee actor; name the client instead.
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

// Workbooks: what the UI calls a "sheet" - a named set of tabs.

const WORKBOOK_INCLUDE = {
  createdBy: { select: { firstName: true, lastName: true } },
  createdByClient: { select: { name: true } },
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, profilePhoto: true },
  },
  // Single-key orderBy: Prisma's include type rejects an `as const` array.
  sheets: { orderBy: { position: "asc" }, include: SHEET_INCLUDE },
} as const

type WorkbookRecord = Prisma.ProjectWorkbookGetPayload<{ include: typeof WORKBOOK_INCLUDE }>

function toWorkbook(w: WorkbookRecord): SheetWorkbook {
  return {
    id: w.id,
    name: w.name,
    // The portal needs it too: same-named calendars differ only by month.
    periodMonth: w.periodMonth ? ymd(w.periodMonth) : null,
    position: w.position,
    // "(client)" so it doesn't read as a colleague.
    createdByName:
      name(w.createdBy) ?? (w.createdByClient ? `${w.createdByClient.name} (client)` : null),
    createdByClientId: w.createdByClientId,
    assignedTo: w.assignedTo,
    isClientVisible: w.isClientVisible,
    updatedAt: w.updatedAt.toISOString(),
    sheets: w.sheets.map(toSheet),
  }
}

// Team plan - STAFF ONLY. Kept out of WORKBOOK_INCLUDE/toWorkbook, which the client portal
// shares; adding `teams` there would leak the internal plan to clients.

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
    // Denormalised so the panel never flashes "Unknown team" while the cached team list loads.
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

/** Every calendar for the picker: names, months and tab names - no grids. */
export async function listWorkbookIndex(projectId: string): Promise<WorkbookIndexEntry[]> {
  const books = await db.projectWorkbook.findMany({
    where: { projectId },
    // The picker's grouping: one row per name, months descending.
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

/** One calendar in full (grid + team plan), staff only. Null if not on this project. */
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
  // Catalogue order (sortProjectTeams keys off `name`, so sort the teams, then unwrap).
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

/** Shared calendars only - a separate function so the portal can't reach the unfiltered one. */
export async function listClientWorkbooks(projectId: string): Promise<SheetWorkbook[]> {
  const books = await db.projectWorkbook.findMany({
    where: { projectId, isClientVisible: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: WORKBOOK_INCLUDE,
  })
  return books.map(toWorkbook)
}

/** Portal write guard: the sheet must be on a calendar this project has SHARED. */
export async function sheetIsClientVisible(
  sheetId: string,
  projectId: string,
  workbookId?: string,
): Promise<boolean> {
  const sheet = await db.projectSheet.findFirst({
    // Checking workbookId makes the URL's calendar segment load-bearing.
    where: { id: sheetId, projectId, workbookId, workbook: { isClientVisible: true } },
    select: { id: true },
  })
  return sheet !== null
}

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

/** "2026-09-01" -> UTC Date, forced to the 1st (else a stray day makes a second September). */
export function parsePeriodMonth(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})/.exec(value)
  if (!m) throw new Error("A month must look like 2026-09")
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) throw new Error("A month must look like 2026-09")
  return new Date(Date.UTC(year, month - 1, 1))
}

/** A name is EITHER monthly editions OR one undated calendar - the DB indexes can't enforce it. */
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
      : ignoreWorkbookId
        ? `"${title}" has other months. Take the month off every one of them, or delete this edition instead.`
        : `"${title}" is already a monthly calendar on this project. Pick a month for this one, or use a different name.`,
  )
}

/** Create a calendar with its first tab. Portal clients pass actorClientId + isClientVisible. */
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
    /** Start from an existing edition - see copyEditionInto for what is (not) copied. */
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
  // Read the source first, so a bad copyFrom leaves no empty calendar in the month's slot.
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
      // Stored on the workbook: the portal's delete rule reads it.
      createdByClientId: input.actorClientId ?? null,
      isClientVisible: input.isClientVisible ?? false,
      // The calendar manager carries forward to the next month.
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
          // NO ROWS: last month's content must not make a fresh month look full.
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
    // Only people still on the team.
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
          // dueOn and links are not copied: both belong to one month's work.
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

/** Rename the WHOLE series - the name is what ties the months together. */
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

  // The whole series must be free under the new name, or a half-rename splits it.
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

/** Give an edition a month, move it, or clear it. Set by hand - never guessed from the name. */
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

/** Assign a workbook (or null). The caller checks who may, and that the employee is active. */
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

/** One SHARED workbook on this project, or null - the portal's lookup (both filters matter). */
export async function getClientVisibleWorkbook(
  workbookId: string,
  projectId: string,
): Promise<{ id: string; name: string; createdByClientId: string | null } | null> {
  return db.projectWorkbook.findFirst({
    where: { id: workbookId, projectId, isClientVisible: true },
    select: { id: true, name: true, createdByClientId: true },
  })
}

// Sheets: one tab of a workbook.

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
      // A..Z up front, so the sheet opens as a grid you can type anywhere in.
      columns: {
        create: Array.from({ length: DEFAULT_COLUMNS }, (_, i) => ({
          name: columnLetter(i),
          type: "TEXT" as const,
          position: i,
        })),
      },
      // No rows: they're created when typed into (see writeCellsAt).
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

/** Resize a row or column. Not recorded in history (drags fire dozens); clamped server-side. */
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
  sheetId: string,
  columnId: string,
  actorId: string,
  input: { name?: string; type?: SheetColumnType; options?: string[]; width?: number | null },
): Promise<SheetColumn> {
  // Scoped to the verified sheet - a bare columnId would let any project edit any column (IDOR).
  const current = await db.projectSheetColumn.findFirst({ where: { id: columnId, sheetId } })
  if (!current) throw new NotFoundError("Column")
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

  // Width-only changes stay out of the history.
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

/** Manager-only: drops the column's value in EVERY row; values are copied into the history first. */
export async function deleteColumn(
  sheetId: string,
  columnId: string,
  actorId: string,
): Promise<void> {
  // Scoped for the same reason as updateColumn: the id alone is not authority.
  const column = await db.projectSheetColumn.findFirst({ where: { id: columnId, sheetId } })
  if (!column) throw new NotFoundError("Column")
  const rows = await db.projectSheetRow.findMany({
    where: { sheetId: column.sheetId },
    select: { id: true, cells: true },
  })
  const discarded = rows
    .map((r) => ({ rowId: r.id, value: asCells(r.cells)[columnId] ?? null }))
    .filter((v) => v.value !== null)

  await db.projectSheetColumn.delete({ where: { id: columnId } })

  // Remove the cells from each row's JSON, or they'd reappear if the id were reused.
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

/** Append a row. Portal clients pass null actorId + actorClientId; the event records who. */
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

/** Merge cells into the row (concurrent column edits don't clash); one event per CHANGED cell. */
export async function updateCells(
  sheetId: string,
  rowId: string,
  actorId: string | null,
  updates: Record<string, unknown>,
  actorClientId?: string | null,
): Promise<void> {
  // Scoped to the verified sheet - a bare rowId let one project write into another's sheet (IDOR).
  const row = await db.projectSheetRow.findFirst({ where: { id: rowId, sheetId } })
  if (!row) throw new NotFoundError("Row")
  const columns = await db.projectSheetColumn.findMany({ where: { sheetId: row.sheetId } })
  const byId = new Map(columns.map((c) => [c.id, c]))

  const cells = asCells(row.cells)
  const changes: { columnId: string; label: string; before: CellValue; after: CellValue }[] = []

  for (const [columnId, raw] of Object.entries(updates)) {
    const column = byId.get(columnId)
    // Skip unknown columns: the client has a stale layout, and a 422 would lose the edit.
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

/** Write cells at a row POSITION, creating the row on first write (only typed-in rows exist). */
export async function writeCellsAt(
  sheetId: string,
  position: number,
  actorId: string | null,
  cells: Record<string, unknown>,
  actorClientId?: string | null,
): Promise<void> {
  let row = await db.projectSheetRow.findFirst({ where: { sheetId, position } })
  if (!row) {
    // Don't create an empty row for a click-and-Escape.
    const meaningful = Object.values(cells).some((v) => v !== null && v !== "")
    if (!meaningful) return
    row = await db.projectSheetRow.create({ data: { sheetId, position, createdById: actorId } })
    await record(sheetId, actorId, "ROW_ADDED", { rowId: row.id, actorClientId })
  }
  await updateCells(sheetId, row.id, actorId, cells, actorClientId)
}

/**
 * Bulk append for the importer: rows go after the last one, values normalised like typed edits,
 * empty rows dropped, one ROW_ADDED event per row (not per cell).
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
export async function deleteRow(sheetId: string, rowId: string, actorId: string): Promise<void> {
  // Scoped for the same reason as updateCells: the id alone is not authority.
  const row = await db.projectSheetRow.findFirst({ where: { id: rowId, sheetId } })
  if (!row) throw new NotFoundError("Row")
  const columns = await db.projectSheetColumn.findMany({ where: { sheetId: row.sheetId } })
  const cells = asCells(row.cells)
  // Keyed by column NAME so the entry stays readable after the column is deleted.
  const snapshot = Object.fromEntries(
    columns.filter((c) => cells[c.id] != null).map((c) => [c.name, cells[c.id] ?? null]),
  )

  await db.projectSheetRow.delete({ where: { id: rowId } })
  await record(row.sheetId, actorId, "ROW_DELETED", { rowId, before: snapshot })
}

// Per-team plan, keyed on (workbookId, teamId): the teams are fixed, and the route guard can
// read the team from the URL without consuming the body.

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
 * Put a team on the plan or change what it owes - idempotent by (calendar, team). Members are a
 * SET (passed replaces stored); omitted fields are left alone.
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
  if (!team) throw new NotFoundError("Team")

  const workbook = await db.projectWorkbook.findFirst({
    where: { id: workbookId, projectId: team.projectId },
    select: { id: true },
  })
  if (!workbook) throw new ValidationError("That team is not on this project")

  // Named people must be ON that team, so the Teams tab and the calendar agree.
  let members: string[] | null = null
  if (input.employeeIds) {
    const wanted = [...new Set(input.employeeIds)]
    const onTeam = await db.projectTeamMember.findMany({
      where: { teamId, employeeId: { in: wanted }, employee: { isActive: true, status: "ACTIVE" } },
      select: { employeeId: true },
    })
    const allowed = new Set(onTeam.map((m) => m.employeeId))
    if (wanted.some((id) => !allowed.has(id))) {
      throw new ValidationError(
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
    throw new ValidationError("That due date is not a date")
  }
  if (input.quantity != null && (!Number.isInteger(input.quantity) || input.quantity < 0)) {
    throw new ValidationError("A quantity is a whole number, or nothing at all")
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

  // DONE needs links + files >= quantity, checked against the row AFTER this write. Not a CHECK
  // constraint: it spans `links` and a COUNT over project_resources.
  if (input.status) {
    const problem = statusProblem(
      input.status,
      teamProgress({
        quantity: input.quantity ?? existing?.quantity ?? 0,
        links: input.links ?? existing?.links ?? [],
        attachments: new Array(existing?._count.attachments ?? 0),
      }),
    )
    if (problem) throw new ValidationError(problem)
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
            // Replace the set: the rows hold only the pair, so a diff buys nothing.
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

/** Take a team off a plan; its files are detached (SET NULL), not deleted. Returns the count. */
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

/** The plan row a file is attached to, checked against the project in one query. */
export async function workbookTeamForProject(
  workbookTeamId: string,
  projectId: string,
): Promise<{ id: string; workbookId: string; teamId: string } | null> {
  return db.projectWorkbookTeam.findFirst({
    where: { id: workbookTeamId, workbook: { projectId } },
    select: { id: true, workbookId: true, teamId: true },
  })
}
