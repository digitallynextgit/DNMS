/**
 * Shared XLSX export - the sibling of `export-csv.ts` and `export-docx.ts`, and
 * deliberately the same call shape so a caller can offer all three formats from
 * one table without reshaping its rows.
 *
 * WRITE ONLY. A workbook is built from values this app already holds; nothing
 * here opens or parses a file.
 *
 * The import is dynamic because the library is around a megabyte and an export
 * button is pressed rarely - there is no reason for it to sit in the bundle of
 * every page that renders one. ExcelJS declares a `browser` build, so bundlers
 * pick that up rather than the Node entry.
 *
 * ── WHY EXCELJS AND NOT SHEETJS ──────────────────────────────────────────────
 * This used to use SheetJS, which cannot write CELL STYLES in its community
 * build - they are a paid feature. That was not a detail:
 *
 *   - a cell holding eight urls separated by newlines renders as one clipped
 *     line, because showing the breaks needs wrapText, which is a style;
 *   - the old code also set `!freeze`, which the community build silently
 *     ignores, so the "header frozen" this file promised never happened.
 *
 * Both were verified against the bytes of a written file rather than the docs.
 * ExcelJS is already a dependency here (the PowerPoint/Excel reports use it),
 * so this adds styling without adding a package.
 */

type Cell = string | number | boolean | null | undefined

/** Excel refuses a sheet name longer than this, or containing []:*?/\ */
const SHEET_NAME_MAX = 31
const SHEET_NAME_BANNED = /[[\]:*?/\\]/g

/** Widest column Excel should open at, in characters. */
const MAX_COL_CHARS = 60

/** Tallest a wrapped row is allowed to grow, in points (~15pt per line). */
const MAX_ROW_POINTS = 120

function columnWidth(header: string, index: number, rows: Cell[][]): number {
  let widest = header.length
  for (const row of rows) {
    // The LONGEST LINE, not the whole cell: a cell of eight urls is as wide as
    // its widest url once wrapped, and measuring the joined length would make
    // the column absurd and push every other one off the screen.
    for (const line of String(row[index] ?? "").split("\n")) {
      if (line.length > widest) widest = line.length
    }
  }
  // +2 so the text is not flush against the cell border.
  return Math.min(MAX_COL_CHARS, widest + 2)
}

/** Trigger a browser download for built bytes. */
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

/**
 * Build a one-sheet workbook and hand it to the browser as a download.
 *
 * Any cell containing newlines is wrapped and its row grown to fit, so a list
 * of links reads as a list rather than as one line running off the page.
 *
 * Async because of the dynamic import - await it if you need to know the file
 * was actually produced (e.g. to stop a spinner).
 */
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
  // The header stays put while scrolling a long export - the thing the previous
  // implementation claimed and never did.
  sheet.views = [{ state: "frozen", ySplit: 1 }]

  for (let r = 0; r < rows.length; r++) {
    const row = sheet.getRow(r + 2)
    // Top-aligned: a wrapped multi-line cell centred vertically leaves its
    // neighbours floating in the middle of a tall row.
    row.alignment = { wrapText: true, vertical: "top" }
    const lines = Math.max(...rows[r]!.map((c) => String(c ?? "").split("\n").length), 1)
    if (lines > 1) row.height = Math.min(MAX_ROW_POINTS, lines * 15)
  }

  download((await book.xlsx.writeBuffer()) as ArrayBuffer, filename)
}
