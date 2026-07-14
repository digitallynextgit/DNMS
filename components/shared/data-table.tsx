"use client"

import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Pagination } from "@/components/shared/pagination"
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

/** Multi-select wiring - pass the result of `useRowSelection(pageIds)`. */
export interface DataTableSelection {
  isSelected: (key: string) => boolean
  toggle: (key: string) => void
  toggleAll: () => void
  allSelected: boolean
  someSelected: boolean
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** Min width for horizontal scroll on small screens, e.g. "min-w-[680px]". */
  minWidth?: string
  className?: string
  /** Render a leading auto-numbered "S.No" column. */
  showSerial?: boolean
  /** Offset for the S.No when paginated, e.g. (page - 1) * pageSize. */
  serialOffset?: number
  /** Enable multi-select checkboxes (header select-all + per-row). */
  selection?: DataTableSelection
  /** Optional pagination bar rendered directly below the table. Pair `serialOffset`
   *  with `(page - 1) * pageSize` so the S.No stays continuous across pages. */
  pagination?: {
    page: number
    totalPages: number
    total: number
    onPageChange: (page: number) => void
    itemLabel?: string
  }
}

/**
 * Shared table with the app's house styling (bordered `bg-card` panel,
 * `bg-muted/40` header, `divide-y` body, hover rows). Columns differ only in
 * their `cell` renderers. Optionally renders a leading **S.No** column
 * (`showSerial`) and **multi-select** checkboxes (`selection`, paired with
 * `useRowSelection` + `BulkActionBar`).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  minWidth,
  className,
  showSerial,
  serialOffset = 0,
  selection,
  pagination,
}: DataTableProps<T>) {
  const alignClass = (align?: DataTableColumn<T>["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"

  const table = (
    <div className={cn("bg-card rounded-lg border", className)}>
      <div className={cn(minWidth && "overflow-x-auto")}>
        <table className={cn("w-full text-sm", minWidth)}>
          <thead>
            <tr className="bg-muted/40 border-b">
              {selection && (
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={
                      selection.allSelected
                        ? true
                        : selection.someSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={() => selection.toggleAll()}
                    aria-label="Select all"
                  />
                </th>
              )}
              {showSerial && (
                <th className="text-muted-foreground w-12 px-4 py-3 text-left font-medium">S.No</th>
              )}
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
            {rows.map((row, rowIndex) => {
              const key = rowKey(row)
              const selected = selection?.isSelected(key) ?? false
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "hover:bg-muted/20 transition-colors",
                    onRowClick && "cursor-pointer",
                    selected && "bg-muted/30",
                  )}
                >
                  {selection && (
                    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => selection.toggle(key)}
                        aria-label="Select row"
                      />
                    </td>
                  )}
                  {showSerial && (
                    <td className="text-muted-foreground px-4 py-3 tabular-nums">
                      {serialOffset + rowIndex + 1}
                    </td>
                  )}
                  {columns.map((col, i) => (
                    <td key={i} className={cn("px-4 py-3", alignClass(col.align), col.className)}>
                      {col.cell(row, rowIndex)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  if (!pagination) return table

  return (
    <div className="space-y-4">
      {table}
      {pagination.total > 0 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
          itemLabel={pagination.itemLabel}
        />
      )}
    </div>
  )
}
