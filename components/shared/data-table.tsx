"use client"

import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
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
  rowKey: (row: T, index: number) => string
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
  /**
   * Renders skeleton rows INSIDE the real table (real headers, real column count,
   * real alignment, real S.No/checkbox columns) instead of the caller guessing
   * `<TableSkeleton rows={5} cols={5} />`. The placeholder therefore always matches
   * the table it is standing in for - it is derived from `columns`, so it can never
   * drift when a column is added or removed.
   */
  loading?: boolean
  /** How many skeleton rows to draw while `loading` (default 8). */
  skeletonRows?: number
  /**
   * Phone rendering (below `md`). A wide table cannot work on a 390px screen -
   * it either clips or scrolls sideways - so every table also renders as a stack
   * of cards there.
   *
   * - omitted: each row becomes an automatic `header: value` card built from
   *   `columns`, so a page gets a usable phone layout for free.
   * - a function: bespoke card for that page (preferred - lets the page lead with
   *   the two or three fields that matter and drop the rest).
   * - `false`: keep the horizontally-scrolling table on phones too (for grids
   *   that are genuinely spreadsheet-shaped).
   */
  mobileCard?: ((row: T, index: number) => React.ReactNode) | false
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
/**
 * Skeleton bar width per column. The first column is usually the "identity" cell
 * (name/avatar) so it gets the widest bar; trailing columns are usually short
 * (status pill, actions) so they get narrow ones. Keeps the placeholder visually
 * proportional to real content instead of every bar being the same length.
 */
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

  // Phone list: one card per row. Bespoke when the page supplies a renderer,
  // otherwise an automatic label/value stack derived from `columns`.
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
                              {/* col.className is carried through: two callers
                                  (holidays:186, wfh:80) rely on it for their
                                  truncation, and dropping it here rendered
                                  those values at full length on phones. */}
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
      {/* overflow-x-auto is unconditional: `md` is the app's TIGHTEST content
          column (cards stop at md, but the 224px sidebar starts at md, leaving
          ~496px at 768px - narrower than the 358px phone case gets after cards).
          Gating the scroller on `minWidth` left 16 tables clipped there with no
          way to reach their right-hand columns. */}
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
                          <Skeleton className={cn("h-4", skeletonWidth(i, columns.length))} />
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
