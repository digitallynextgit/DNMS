// Sheet vocabulary shared by server and browser; mirrors the SheetColumnType/SheetEventType enums.

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

export interface SheetAssignee {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
}

export interface SheetWorkbook {
  id: string
  name: string
  /** The month this edition covers, "YYYY-MM-01"; null = undated (older calendars have no month). */
  periodMonth: string | null
  position: number
  createdByName: string | null
  /** Set when a CLIENT started this calendar in the portal. Null for the team's own. */
  createdByClientId: string | null
  /** Who owns this sheet now, or null when nobody has picked it up. */
  assignedTo: SheetAssignee | null
  /** Published to the client portal, where the client may fill its cells. */
  isClientVisible: boolean
  /** The project service this calendar is for (PROJECT_SERVICES code), or null. */
  service: string | null
  updatedAt: string
  /** Its tabs, in order. Never empty: a workbook is created with one. */
  sheets: ProjectSheet[]
}

// Per-team plan - STAFF ONLY. Never goes through toWorkbook(), which the client portal shares.

export interface WorkbookTeamMember {
  employeeId: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  designation: string | null
}

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
  status: WorkbookTeamStatus
  /** "YYYY-MM-DD", or null when no date has been agreed. */
  dueOn: string | null
  /** Task URLs, Drive folders, published pages. */
  links: string[]
  notes: string | null
  members: WorkbookTeamMember[]
  attachments: WorkbookTeamAttachment[]
}

/** A calendar in the picker: no rows or columns, since the list grows by twelve editions a year. */
export interface WorkbookIndexEntry {
  id: string
  name: string
  periodMonth: string | null
  position: number
  createdByName: string | null
  createdByClientId: string | null
  assignedTo: SheetAssignee | null
  isClientVisible: boolean
  /** The project service this calendar is for (PROJECT_SERVICES code), or null. */
  service: string | null
  updatedAt: string
  /** Tab names only, in order - enough for the importer to match one by name. */
  tabs: { id: string; name: string; position: number }[]
}

/** One calendar in FULL: the grid, plus the team plan. Staff only. */
export type StaffWorkbook = SheetWorkbook & { teams: WorkbookTeam[] }

/** Coerce a cell to something storable: NUMBER/CHECKBOX normalised from strings, "" -> null. */
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

/** 0 -> A, 25 -> Z, 26 -> AA. Shared with the portal grid. */
export function columnLetter(index: number): string {
  let n = index
  let out = ""
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}
