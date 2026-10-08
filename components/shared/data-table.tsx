"use client"

import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/shared/pagination"
import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  header: React.ReactNode
  cell: (row: T, index: number) => React.ReactNode
  align?: "left" | "right" | "center"
  className?: string
  headClassName?: string
  /** Cell placeholder while `loading`, when a plain bar is the wrong shape (e.g. avatar + two lines). */
  skeleton?: React.ReactNode
}

/** Pass the result of `useRowSelection(pageIds)`. */
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
  rowKey: (row: T, index: number) => string
  onRowClick?: (row: T) => void
  /** Min width for horizontal scroll on small screens, e.g. "min-w-[680px]". */
  minWidth?: string
  className?: string
  showSerial?: boolean
  /** Offset for the S.No when paginated, e.g. (page - 1) * pageSize. */
  serialOffset?: number
  selection?: DataTableSelection
  /** Draws skeleton rows inside the real table, derived from `columns`, so they always match. */
  loading?: boolean
  /** Default 8. */
  skeletonRows?: number
  /**
   * Phone layout (below md): omitted = automatic `header: value` cards; a function = a bespoke card;
   * `false` = keep the scrolling table (for spreadsheet-shaped grids).
   */
  mobileCard?: ((row: T, index: number) => React.ReactNode) | false
  /** Rendered below the table. Pair with `serialOffset` so S.No continues across pages. */
  pagination?: {
    page: number
    totalPages: number
    total: number
    onPageChange: (page: number) => void
    itemLabel?: string
  }
}

/** Widest bar for the first (identity) column, narrow ones for the trailing columns. */
function skeletonWidth(index: number, total: number): string {
  if (index === 0) return "w-40"
  if (index === total - 1) return "w-12"
  if (index === total - 2) return "w-16"
  return "w-24"
}

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
  loading = false,
  skeletonRows = 8,
  pagination,
  mobileCard,
}: DataTableProps<T>) {
  const alignClass = (align?: DataTableColumn<T>["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
  const justifyClass = (align?: DataTableColumn<T>["align"]) =>
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"

  const cardsOn = mobileCard !== false

  const cards = cardsOn ? (
    <div className="divide-border divide-y md:hidden">
      {loading
        ? Array.from({ length: Math.min(skeletonRows, 5) }).map((_, i) => (
            <div key={`mc-${i}`} className="space-y-2 p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))
        : rows.map((row, rowIndex) => {
            const key = rowKey(row, rowIndex)
            const selected = selection?.isSelected(key) ?? false
            return (
              <div
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  "p-4 transition-colors",
                  onRowClick &&
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  onRowClick && "hover:bg-muted/20 cursor-pointer",
                  selected && "bg-muted/30",
                )}
              >
                <div className="flex items-start gap-3">
                  {selection && (
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => selection.toggle(key)}
                        aria-label="Select row"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {mobileCard ? (
                      mobileCard(row, rowIndex)
                    ) : (
                      <dl className="space-y-1.5">
                        {columns.map((col, i) => {
                          const value = col.cell(row, rowIndex)
                          if (value === null || value === undefined || value === "") return null
                          return (
                            <div key={i} className="flex items-start justify-between gap-3 text-sm">
                              <dt className="text-muted-foreground shrink-0 text-xs">
                                {col.header}
                              </dt>
                              {/* Keep col.className: some callers rely on it for truncation. */}
                              <dd className={cn("min-w-0 text-right", col.className)}>{value}</dd>
                            </div>
                          )
                        })}
                      </dl>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
    </div>
  ) : null

  const table = (
    <div className={cn("bg-card rounded-sm border", className)}>
      {cards}
      {/* Always scrollable: at md the sidebar leaves the narrowest content column (~496px). */}
      <div className={cn("overflow-x-auto", cardsOn && "hidden md:block")}>
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
            {loading
              ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                  <tr key={`sk-${rowIndex}`}>
                    {selection && (
                      <td className="w-10 px-4 py-3">
                        <Skeleton className="h-4 w-4 rounded-sm" />
                      </td>
                    )}
                    {showSerial && (
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-4" />
                      </td>
                    )}
                    {columns.map((col, i) => (
                      <td key={i} className={cn("px-4 py-3", alignClass(col.align))}>
                        <div className={cn("flex", justifyClass(col.align))}>
                          {col.skeleton ?? (
                            <Skeleton className={cn("h-4", skeletonWidth(i, columns.length))} />
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!loading &&
              rows.map((row, rowIndex) => {
                const key = rowKey(row, rowIndex)
                const selected = selection?.isSelected(key) ?? false
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.target !== e.currentTarget) return
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              onRowClick(row)
                            }
                          }
                        : undefined
                    }
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      "hover:bg-muted/20 transition-colors",
                      onRowClick &&
                        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
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
      {!loading && pagination.total > 0 && (
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
