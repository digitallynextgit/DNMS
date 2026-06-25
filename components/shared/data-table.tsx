import * as React from "react"

import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  header: React.ReactNode
  cell: (row: T, index: number) => React.ReactNode
  /** td/th alignment. */
  align?: "left" | "right" | "center"
  /** Extra classes for this column's body cells. */
  className?: string
  /** Extra classes for this column's header cell. */
  headClassName?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** Min width for horizontal scroll on small screens, e.g. "min-w-[680px]". */
  minWidth?: string
  className?: string
}

/**
 * Read-only table with the app's house styling (the `bg-card` bordered panel,
 * `bg-muted/40` header, `divide-y` body, hover rows). Replaces hand-rolled
 * `<table>` shells for plain list tables — columns differ only in their
 * `cell` renderers. (Selection/summary/financial tables stay bespoke.)
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  minWidth,
  className,
}: DataTableProps<T>) {
  const alignClass = (align?: DataTableColumn<T>["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"

  return (
    <div className={cn("bg-card rounded border", className)}>
      <div className={cn(minWidth && "overflow-x-auto")}>
        <table className={cn("w-full text-sm", minWidth)}>
          <thead>
            <tr className="bg-muted/40 border-b">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    "text-muted-foreground px-4 py-3 font-medium",
                    alignClass(col.align),
                    col.headClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, rowIndex) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "hover:bg-muted/20 transition-colors",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((col, i) => (
                  <td key={i} className={cn("px-4 py-3", alignClass(col.align), col.className)}>
                    {col.cell(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
