// `toCsv` works anywhere; the download helpers are client-only (DOM).

type Cell = string | number | boolean | null | undefined

function escapeCell(value: Cell): string {
  const s = String(value ?? "")
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Cell[][], header?: string[]): string {
  const all = header ? [header, ...rows] : rows
  return all.map((row) => row.map(escapeCell).join(",")).join("\n")
}

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

export function exportToCsv(header: string[], rows: Cell[][], filename: string): void {
  downloadCsv(toCsv(rows, header), filename)
}
