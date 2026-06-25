/**
 * Shared CSV helpers. `toCsv` is framework-agnostic (usable in API routes and
 * the client); `downloadCsv` is client-only (uses the DOM). Replaces the
 * cell-escaping logic that was copy-pasted across the employee export, the
 * attendance template, and the attendance export API route.
 */

type Cell = string | number | boolean | null | undefined

function escapeCell(value: Cell): string {
  const s = String(value ?? "")
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Build a CSV string from a 2D array of rows, with an optional header row. */
export function toCsv(rows: Cell[][], header?: string[]): string {
  const all = header ? [header, ...rows] : rows
  return all.map((row) => row.map(escapeCell).join(",")).join("\n")
}

/** Trigger a browser download of CSV content (client-side only). */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Convenience: build CSV from columns + rows and download it. */
export function exportToCsv(header: string[], rows: Cell[][], filename: string): void {
  downloadCsv(toCsv(rows, header), filename)
}
