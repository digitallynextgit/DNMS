/**
 * The vocabulary of a project sheet, shared by the server and the browser.
 *
 * Mirrors the SheetColumnType and SheetEventType enums in schema.prisma. Kept
 * dependency-free so the grid can import it without pulling anything server-side
 * into the client bundle.
 */

/** Resize bounds. Wide enough to be useful, tight enough to stay a grid. */
export const MIN_COL_W = 64
export const MAX_COL_W = 640
export const MIN_ROW_H = 24
export const MAX_ROW_H = 400

export const SHEET_COLUMN_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DATE",
  "SELECT",
  "CHECKBOX",
  "URL",
  "PERSON",
] as const

export type SheetColumnType = (typeof SHEET_COLUMN_TYPES)[number]

export const COLUMN_TYPE_LABEL: Record<SheetColumnType, string> = {
  TEXT: "Text",
  LONG_TEXT: "Long text",
  NUMBER: "Number",
  DATE: "Date",
  SELECT: "Select",
  CHECKBOX: "Checkbox",
  URL: "Link",
  PERSON: "Person",
}

/** One line each, so the type picker explains itself rather than being a guess. */
export const COLUMN_TYPE_HINT: Record<SheetColumnType, string> = {
  TEXT: "A single line",
  LONG_TEXT: "A paragraph, wraps in the cell",
  NUMBER: "Digits only, right-aligned",
  DATE: "A date picker",
  SELECT: "One of a fixed list you define",
  CHECKBOX: "Ticked or not",
  URL: "A link, opens in a new tab",
  PERSON: "Someone on the project",
}

export type SheetEventType =
  | "SHEET_CREATED"
  | "SHEET_RENAMED"
  | "COLUMN_ADDED"
  | "COLUMN_UPDATED"
  | "COLUMN_DELETED"
  | "ROW_ADDED"
  | "CELL_UPDATED"
  | "ROW_DELETED"

/** A cell value. Everything is stored as-is inside ProjectSheetRow.cells. */
export type CellValue = string | number | boolean | null

export interface SheetColumn {
  id: string
  name: string
  type: SheetColumnType
  position: number
  width: number | null
  /** SELECT choices. Empty for every other type. */
  options: string[]
}

export interface SheetRow {
  id: string
  position: number
  /** Keyed by column id. A column with no value here has never been filled in. */
  cells: Record<string, CellValue>
  createdByName: string | null
  updatedAt: string
}

export interface SheetEvent {
  id: string
  type: SheetEventType
  /** What the row or column was called at the time, not what it is called now. */
  label: string | null
  before: unknown
  after: unknown
  actorName: string | null
  at: string
}

export interface ProjectSheet {
  id: string
  name: string
  description: string | null
  position: number
  /** Row heights in px, keyed by row position. Absent = ROW_H. */
  rowHeights: Record<string, number>
  columns: SheetColumn[]
  rows: SheetRow[]
  createdByName: string | null
  updatedAt: string
}

/**
 * Coerce whatever arrives for a cell into something storable.
 *
 * The grid sends strings for nearly everything (an input's value always is one),
 * so NUMBER and CHECKBOX are normalised here rather than trusting the client.
 * An empty string becomes null: "cleared" and "never filled in" should look the
 * same to a filter, and storing "" makes them differ.
 */
export function normalizeCell(type: SheetColumnType, raw: unknown): CellValue {
  if (raw === null || raw === undefined) return null
  if (type === "CHECKBOX") return raw === true || raw === "true"
  if (type === "NUMBER") {
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null
    const n = Number(String(raw).trim())
    return String(raw).trim() === "" || Number.isNaN(n) ? null : n
  }
  const s = typeof raw === "string" ? raw : String(raw)
  return s.trim() === "" ? null : s
}
