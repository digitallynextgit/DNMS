// A calendar tab as a plain table for CSV/Excel downloads: what the grid shows, in grid order.
import type { CellValue, ProjectSheet, SheetColumn } from "./sheet-types"

/** Prefixed to CSV downloads so Excel reads curly quotes and Hindi as UTF-8. */
export const UTF8_BOM = String.fromCharCode(0xfeff)

export interface SheetTable {
  name: string
  header: string[]
  rows: CellValue[][]
}

function cellOut(
  column: SheetColumn,
  value: CellValue | undefined,
  personName: (id: string) => string | undefined,
): CellValue {
  if (value === undefined || value === null || value === "") return null
  // A person cell stores an employee id; the grid shows the name (the id once they've left).
  if (column.type === "PERSON") return personName(String(value)) ?? String(value)
  return value
}

/** Column names, then every row from the first to the last filled one; blank rows keep their place. */
export function sheetTable(
  sheet: ProjectSheet,
  personName: (id: string) => string | undefined,
): SheetTable {
  const columns = [...sheet.columns].sort((a, b) => a.position - b.position)
  const byPos = new Map(sheet.rows.map((r) => [r.position, r]))
  const rows: CellValue[][] = []
  const last = sheet.rows.reduce((max, r) => Math.max(max, r.position), -1)
  for (let pos = 0; pos <= last; pos++) {
    const row = byPos.get(pos)
    rows.push(columns.map((c) => cellOut(c, row?.cells[c.id], personName)))
  }
  // Rows that exist but were cleared still trail at the end; drop them.
  while (rows.length > 0 && rows[rows.length - 1]!.every((v) => v === null)) rows.pop()
  return { name: sheet.name, header: columns.map((c) => c.name), rows }
}

/** "Hard2Soft Calendar · Dec 2026 · LinkedIn" -> a name every OS accepts. */
export function exportFileName(parts: (string | null | undefined)[], ext: "csv" | "xlsx"): string {
  const base = parts
    .filter((p): p is string => !!p && p.trim() !== "")
    .join(" - ")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
  return `${base || "Calendar"}.${ext}`
}
