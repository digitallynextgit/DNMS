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
} from "../lib/sheet-types"

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
  } = {},
): Promise<void> {
  try {
    await db.projectSheetEvent.create({
      data: {
        sheetId,
        actorId,
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
    include: { actor: { select: { firstName: true, lastName: true } } },
  })
  return events.map((e) => ({
    id: e.id,
    type: e.type as SheetEventType,
    label: e.label,
    before: e.before,
    after: e.after,
    actorName: name(e.actor),
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
// Sheets
// ─────────────────────────────────────────────────────────────────────────────

export async function createSheet(
  projectId: string,
  actorId: string,
  input: { name: string; description?: string | null },
): Promise<ProjectSheet> {
  const title = input.name.trim()
  if (!title) throw new Error("A sheet needs a name")

  const last = await db.projectSheet.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  })

  const sheet = await db.projectSheet.create({
    data: {
      projectId,
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

  await record(sheet.id, actorId, "SHEET_CREATED", { label: sheet.name })
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

export async function addRow(sheetId: string, actorId: string): Promise<void> {
  const last = await db.projectSheetRow.findFirst({
    where: { sheetId },
    orderBy: { position: "desc" },
    select: { position: true },
  })
  const row = await db.projectSheetRow.create({
    data: { sheetId, position: (last?.position ?? -1) + 1, createdById: actorId },
  })
  await record(sheetId, actorId, "ROW_ADDED", { rowId: row.id })
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
  actorId: string,
  updates: Record<string, unknown>,
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
  actorId: string,
  cells: Record<string, unknown>,
): Promise<void> {
  let row = await db.projectSheetRow.findFirst({ where: { sheetId, position } })
  if (!row) {
    // Nothing to write and no row to write it to: don't create an empty row
    // just because someone clicked a cell and pressed Escape.
    const meaningful = Object.values(cells).some((v) => v !== null && v !== "")
    if (!meaningful) return
    row = await db.projectSheetRow.create({ data: { sheetId, position, createdById: actorId } })
    await record(sheetId, actorId, "ROW_ADDED", { rowId: row.id })
  }
  await updateCells(row.id, actorId, cells)
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
