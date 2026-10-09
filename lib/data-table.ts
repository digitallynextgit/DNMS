// Pure helpers behind components/shared/data-table.tsx, kept apart so they can be unit-tested.

export type SortValue = string | number | null | undefined
export type ExportCell = string | number | boolean | null | undefined

/** A sorted copy (never the caller's array). Blanks go last either way; text sorts 2 before 10. */
export function sortRows<T>(rows: readonly T[], value: (row: T) => SortValue, dir: "asc" | "desc") {
  const sign = dir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * sign
  })
}

/** Security: a leading ' stops a spreadsheet running a typed-in formula (CSV injection). */
export function spreadsheetSafe(value: ExportCell): ExportCell {
  return typeof value === "string" && /^[=+@\t\r]|^-[^\d.]/.test(value) ? `'${value}` : value
}

/** A saved JSON list of column keys; anything else reads as none. */
export function parseKeyList(raw: string): Set<string> {
  try {
    const list: unknown = JSON.parse(raw)
    return new Set(
      Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : [],
    )
  } catch {
    return new Set()
  }
}
