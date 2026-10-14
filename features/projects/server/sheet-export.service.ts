import "server-only"

import { db } from "@/server/db"
import { toCsv } from "@/lib/export-csv"
import { buildBookXlsx } from "@/lib/export-xlsx"
import { formatMonthShort } from "../lib/calendar-months"
import { UTF8_BOM, exportFileName, sheetTable } from "../lib/sheet-export"
import { getWorkbook } from "./sheets.service"

// The calendar Download menu, built on the server: the same tables (lib/sheet-export) and the same
// Excel builder as the browser, so a file fetched through the API matches the one from the grid.

export type WorkbookExport =
  | { ok: true; fileName: string; contentType: string; body: Uint8Array }
  | { ok: false; status: number; error: string }

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** One tab (`sheetId`) as CSV or Excel, or every tab of the calendar in one Excel file. */
export async function exportWorkbook(
  projectId: string,
  workbookId: string,
  format: "xlsx" | "csv",
  sheetId?: string,
): Promise<WorkbookExport> {
  const workbook = await getWorkbook(projectId, workbookId)
  if (!workbook) return { ok: false, status: 404, error: "Calendar not found" }

  const tabs = sheetId ? workbook.sheets.filter((s) => s.id === sheetId) : workbook.sheets
  if (tabs.length === 0) return { ok: false, status: 404, error: "Tab not found on this calendar" }
  if (format === "csv" && tabs.length > 1) {
    return {
      ok: false,
      status: 422,
      error: "A CSV holds one tab - pass sheetId, or use format=xlsx for the whole calendar",
    }
  }

  // A person cell stores an employee id; the grid shows the name. Unlike the grid (which only knows
  // the current team), this also names people who have since left the project.
  const personIds = new Set<string>()
  for (const tab of tabs) {
    const personColumns = tab.columns.filter((c) => c.type === "PERSON").map((c) => c.id)
    for (const row of tab.rows) {
      for (const id of personColumns) {
        const value = row.cells[id]
        if (typeof value === "string" && value) personIds.add(value)
      }
    }
  }
  const people = personIds.size
    ? await db.employee.findMany({
        where: { id: { in: [...personIds] } },
        select: { id: true, firstName: true, lastName: true },
      })
    : []
  const names = new Map(people.map((p) => [p.id, `${p.firstName} ${p.lastName ?? ""}`.trim()]))
  const personName = (id: string) => names.get(id)

  const parts = [
    workbook.name,
    workbook.periodMonth ? formatMonthShort(workbook.periodMonth) : null,
  ]
  const tables = tabs.map((s) => sheetTable(s, personName))

  if (format === "csv") {
    const t = tables[0]!
    return {
      ok: true,
      fileName: exportFileName([...parts, t.name], "csv"),
      contentType: "text/csv; charset=utf-8",
      body: new TextEncoder().encode(`${UTF8_BOM}${toCsv(t.rows, t.header)}`),
    }
  }
  return {
    ok: true,
    // A single tab is named after it, as in the grid's "this tab as Excel".
    fileName: exportFileName(sheetId ? [...parts, tables[0]!.name] : parts, "xlsx"),
    contentType: XLSX_TYPE,
    body: new Uint8Array(await buildBookXlsx(tables)),
  }
}
