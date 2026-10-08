// XLSX export, same call shape as export-csv / export-docx. Dynamically imported (~1 MB).
// ExcelJS, not SheetJS: the SheetJS community build can't write styles (wrapText) or freeze panes.

type Cell = string | number | boolean | null | undefined

/** Excel refuses a sheet name longer than this, or containing []:*?/\ */
const SHEET_NAME_MAX = 31
const SHEET_NAME_BANNED = /[[\]:*?/\\]/g

/** In characters. */
const MAX_COL_CHARS = 60

/** In points (~15pt per line). */
const MAX_ROW_POINTS = 120

function columnWidth(header: string, index: number, rows: Cell[][]): number {
  let widest = header.length
  for (const row of rows) {
    // Measure the longest line, not the whole cell - that's its width once wrapped.
    for (const line of String(row[index] ?? "").split("\n")) {
      if (line.length > widest) widest = line.length
    }
  }
  // +2 so the text is not flush against the cell border.
  return Math.min(MAX_COL_CHARS, widest + 2)
}

function download(data: ArrayBuffer, filename: string): void {
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Cells with newlines wrap and their rows grow. Async (dynamic import) - await it to stop a spinner. */
export async function exportToXlsx(
  header: string[],
  rows: Cell[][],
  filename: string,
  sheetName = "Sheet1",
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet(
    sheetName.replace(SHEET_NAME_BANNED, " ").slice(0, SHEET_NAME_MAX) || "Sheet1",
  )

  sheet.addRow(header)
  for (const row of rows) sheet.addRow(row.map((c) => c ?? ""))

  sheet.columns = header.map((h, i) => ({ width: columnWidth(h, i, rows) }))

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.alignment = { vertical: "middle" }
  sheet.views = [{ state: "frozen", ySplit: 1 }]

  for (let r = 0; r < rows.length; r++) {
    const row = sheet.getRow(r + 2)
    // Top-aligned so the neighbours of a tall wrapped cell don't float mid-row.
    row.alignment = { wrapText: true, vertical: "top" }
    const lines = Math.max(...rows[r]!.map((c) => String(c ?? "").split("\n").length), 1)
    if (lines > 1) row.height = Math.min(MAX_ROW_POINTS, lines * 15)
  }

  download((await book.xlsx.writeBuffer()) as ArrayBuffer, filename)
}
