/**
 * Shared XLSX export - the sibling of `export-csv.ts`, and deliberately the
 * same call shape so a caller can offer both formats from one table.
 *
 * WRITE ONLY. SheetJS is loaded to build a workbook from values this app
 * already holds; nothing here parses a file, which is where that library's
 * history of advisories lives.
 *
 * The import is dynamic because the library is several hundred kilobytes and
 * an export button is pressed rarely - there is no reason for it to sit in the
 * bundle of every page that renders one.
 */

type Cell = string | number | boolean | null | undefined

/** Excel refuses a sheet name longer than this, or containing []:*?/\ */
const SHEET_NAME_MAX = 31
const SHEET_NAME_BANNED = /[[\]:*?/\\]/g

/** Widest column Excel should open at, in characters. */
const MAX_COL_CHARS = 60

function widths(header: string[], rows: Cell[][]): { wch: number }[] {
  return header.map((h, i) => {
    let widest = h.length
    for (const row of rows) {
      const len = String(row[i] ?? "").length
      if (len > widest) widest = len
    }
    // +2 so the text is not flush against the cell border.
    return { wch: Math.min(MAX_COL_CHARS, widest + 2) }
  })
}

/**
 * Build a one-sheet workbook and hand it to the browser as a download.
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
  const XLSX = await import("xlsx")
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows])
  // Without this every column opens at Excel's default width and long text is
  // clipped to "####", which reads as broken data rather than a narrow column.
  sheet["!cols"] = widths(header, rows)
  // Freeze the header so it stays put while scrolling a long export.
  sheet["!freeze"] = { xSplit: "0", ySplit: "1" }

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    book,
    sheet,
    sheetName.replace(SHEET_NAME_BANNED, " ").slice(0, SHEET_NAME_MAX) || "Sheet1",
  )
  XLSX.writeFile(book, filename)
}
