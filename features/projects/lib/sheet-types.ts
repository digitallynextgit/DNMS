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

import type { WorkbookTeamStatus } from "./workbook-team-progress"

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
  /** The workbook (what the UI calls a "sheet") this tab belongs to. */
  workbookId: string
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

/** A workbook - what the Calendars UI calls a "sheet": a named set of tabs. */
/** Just enough of an employee to show who owns a sheet. */
export interface SheetAssignee {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
}

export interface SheetWorkbook {
  id: string
  name: string
  /**
   * The month this edition covers, as "YYYY-MM-01". Null = an undated calendar.
   *
   * NULLABLE rather than required, and that is load-bearing: this interface is
   * shared with the client portal, so a required field would break every
   * consumer at once - and every calendar made before calendars were monthly
   * genuinely has no month.
   */
  periodMonth: string | null
  position: number
  createdByName: string | null
  /** Set when a CLIENT started this calendar in the portal. Null for the team's own. */
  createdByClientId: string | null
  /** Who owns this sheet now, or null when nobody has picked it up. */
  assignedTo: SheetAssignee | null
  /** Published to the client portal, where the client may fill its cells. */
  isClientVisible: boolean
  updatedAt: string
  /** Its tabs, in order. Never empty: a workbook is created with one. */
  sheets: ProjectSheet[]
}

// ─────────────────────────────────────────────────────────────────────────────
// The per-team plan.
//
// STAFF ONLY. None of this travels through toWorkbook(), which the client
// portal shares - see the comment on listClientWorkbooks in sheets.service.ts.
// Who is doing the work, how much they owe and when it is due is an internal
// conversation, and the portal must never be one refactor away from it.
// ─────────────────────────────────────────────────────────────────────────────

/** Someone put on a team's row for this calendar. */
export interface WorkbookTeamMember {
  employeeId: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  designation: string | null
}

/** A file produced against a team's row. Uploaded through the project's own pipeline. */
export interface WorkbookTeamAttachment {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  /** Set when the file lives in Google Drive instead of Backblaze (video). */
  driveFileId: string | null
  uploadedByName: string | null
  createdAt: string
}

/** One team's commitment on one monthly calendar. */
export interface WorkbookTeam {
  id: string
  teamId: string
  /** "WEB", "VIDEO"… the project's fixed team names. */
  teamName: string
  /** Who manages that team on this project, for "is this mine to edit". */
  teamManagerId: string | null
  /** How many items they owe. 0 = on the calendar, not yet quantified. */
  quantity: number
  /** Where the month stands. See lib/workbook-team-progress.ts. */
  status: WorkbookTeamStatus
  /** "YYYY-MM-DD", or null when no date has been agreed. */
  dueOn: string | null
  /** Task URLs, Drive folders, published pages. */
  links: string[]
  notes: string | null
  members: WorkbookTeamMember[]
  attachments: WorkbookTeamAttachment[]
}

/**
 * One calendar in the PICKER: enough to name it, date it and say who runs it,
 * and nothing else.
 *
 * Deliberately carries no columns and no rows. The picker lists every edition
 * of every calendar on the project, and monthly editions mean that list grows
 * by twelve a year per calendar - sending each one's whole grid to draw a
 * dropdown would make opening the tab cost more every month it is used.
 */
export interface WorkbookIndexEntry {
  id: string
  name: string
  periodMonth: string | null
  position: number
  createdByName: string | null
  createdByClientId: string | null
  assignedTo: SheetAssignee | null
  isClientVisible: boolean
  updatedAt: string
  /** Tab names only, in order - enough for the importer to match one by name. */
  tabs: { id: string; name: string; position: number }[]
}

/** One calendar in FULL: the grid, plus the team plan. Staff only. */
export type StaffWorkbook = SheetWorkbook & { teams: WorkbookTeam[] }

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

/**
 * 0 -> A, 25 -> Z, 26 -> AA. The reference people actually use out loud
 * ("what's in C4?"), which is why it is worth showing even though every column
 * here also has a name.
 *
 * Lives here rather than in the staff grid because the portal grid shows the
 * same letters, and two copies of this loop would be two chances to disagree
 * about what column 27 is called.
 */
export function columnLetter(index: number): string {
  let n = index
  let out = ""
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}
