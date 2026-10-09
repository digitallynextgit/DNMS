"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Columns3, Download, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { PAGE_SIZES, Pagination } from "@/components/shared/pagination"
import { useStoredState } from "@/hooks/use-stored-state"
import { parseKeyList, sortRows, spreadsheetSafe } from "@/lib/data-table"
import { downloadCsv, toCsv } from "@/lib/export-csv"
import { cn } from "@/lib/utils"

/**
 * The one table every list screen uses. With all rows handed in it sorts, pages and exports them
 * itself; with `pagination` the server pages and the table shows that page. Headers and cells don't
 * wrap - a wide table scrolls sideways. Hidden columns and rows per page are remembered per `tableId`.
 */
export interface DataTableColumn<T> {
  header: React.ReactNode
  cell: (row: T, index: number) => React.ReactNode
  align?: "left" | "right" | "center"
  className?: string
  headClassName?: string
  /** Cell placeholder while `loading`, when a plain bar is the wrong shape (e.g. avatar + two lines). */
  skeleton?: React.ReactNode
  /** Stable id for the column picker. Defaults to the header text. */
  key?: string
  /** Makes the column sortable (when the table holds every row) and is its default export value. */
  sortValue?: (row: T) => string | number | null | undefined
  /** What exports get for this column. Defaults to `sortValue`; with neither it is left out. */
  exportValue?: (row: T) => string | number | boolean | null | undefined
  /** false keeps it out of the column picker. Default: any column with a text header but "Actions". */
  hideable?: boolean
  /** Starts hidden until someone shows it in the column picker. */
  defaultHidden?: boolean
}

/** Pass the result of `useRowSelection(...)`. */
export interface DataTableSelection {
  isSelected: (key: string) => boolean
  toggle: (key: string) => void
  /** Called with the keys of the rows on screen. */
  toggleAll: (keys?: string[]) => void
  /** Every ticked key, including rows on other server pages. */
  count?: number
  clear?: () => void
  /** Ignored: worked out from the rows on screen. */
  allSelected?: boolean
  someSelected?: boolean
}

/** Server-side paging: `rows` is one page. */
export interface DataTablePagination {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  /** Singular noun for the count, e.g. "employee". */
  itemLabel?: string
  /** Rows per page on the server, for "21–40 of 95". */
  pageSize?: number
  /** Offers a rows-per-page choice. */
  onPageSizeChange?: (size: number) => void
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  onRowClick?: (row: T) => void
  /** Min width for the table, e.g. "min-w-[680px]". */
  minWidth?: string
  className?: string
  showSerial?: boolean
  /** Offset for the S.No with server paging, e.g. (page - 1) * pageSize. */
  serialOffset?: number
  /** Tick boxes; ticked rows also become what Export downloads. */
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
  /** Server-side paging. Omit it and the table pages the rows itself. */
  pagination?: DataTablePagination
  /** Remembers hidden columns and rows per page in this browser, e.g. "projects". */
  tableId?: string
  /** Inside the frame, top left: a view menu, search, filters. */
  toolbar?: React.ReactNode
  /** Top right, before the column picker and Export. */
  toolbarEnd?: React.ReactNode
  /** Bulk actions, shown in the header row while rows are ticked. Needs `selection`. */
  selectionActions?: React.ReactNode
  /** The column picker. Default: on when four or more columns can be hidden. */
  columnToggle?: boolean
  /** Adds Export (CSV, Excel) of the ticked rows, else every row; this is the filename stem. */
  exportName?: string
  /** Rows per page when the table pages itself (default 20); false shows every row. */
  pageSize?: number | false
  /** Rows-per-page choices. */
  pageSizes?: readonly number[]
  /** When this changes the table goes back to page 1: a new filter or search. */
  pageKey?: string
  /** Singular noun for counts when the table pages itself. Default "row". */
  itemLabel?: string
  /** Shown inside the frame when there are no rows. */
  empty?: React.ReactNode
  rowClassName?: (row: T) => string | undefined
  /** A line under the rows, e.g. "Showing the first 200 - search to find the rest." */
  footerNote?: React.ReactNode
  /** Caps the height (e.g. "max-h-[60vh]"); the rows scroll under a sticky header. */
  maxHeight?: string
}

/** Widest bar for the first (identity) column, narrow ones for the trailing columns. */
function skeletonWidth(index: number, total: number): string {
  if (index === 0) return "w-40"
  if (index === total - 1) return "w-12"
  if (index === total - 2) return "w-16"
  return "w-24"
}

function columnKey<T>(col: DataTableColumn<T>, index: number): string {
  if (col.key) return col.key
  return typeof col.header === "string" && col.header ? col.header : `column-${index}`
}

function canHide<T>(col: DataTableColumn<T>): boolean {
  if (col.hideable !== undefined) return col.hideable
  return (
    typeof col.header === "string" &&
    col.header.trim() !== "" &&
    col.header.toLowerCase() !== "actions"
  )
}

function plural(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`
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
  mobileCard,
  pagination,
  tableId,
  toolbar,
  toolbarEnd,
  selectionActions,
  columnToggle,
  exportName,
  pageSize = 20,
  pageSizes = PAGE_SIZES,
  pageKey,
  itemLabel = "row",
  empty,
  rowClassName,
  footerNote,
  maxHeight,
}: DataTableProps<T>) {
  const serverPaged = !!pagination
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null)
  const [page, setPage] = React.useState(1)
  const [ownPicked, setOwnPicked] = React.useState<Set<string>>(new Set())

  // Back to page one during render, React's pattern for state that follows a prop.
  const [seenPageKey, setSeenPageKey] = React.useState(pageKey)
  if (pageKey !== seenPageKey) {
    setSeenPageKey(pageKey)
    setPage(1)
  }

  const keyed = columns.map((col, i) => ({ col, key: columnKey(col, i) }))
  const hideable = keyed.filter(({ col }) => canHide(col))
  const pickerOn = columnToggle ?? hideable.length >= 4
  const defaultHidden = JSON.stringify(keyed.filter((c) => c.col.defaultHidden).map((c) => c.key))
  const [hiddenRaw, setHiddenRaw] = useStoredState(
    tableId ? `dnms.table.${tableId}.hidden` : undefined,
    defaultHidden,
  )
  // Without the picker, defaultHidden columns stay hidden: they exist for the export.
  const hidden = pickerOn
    ? parseKeyList(hiddenRaw)
    : new Set(keyed.filter((c) => c.col.defaultHidden).map((c) => c.key))
  const shownCols = keyed.filter((c) => !canHide(c.col) || !hidden.has(c.key))
  // Columns renamed since the choice was saved can leave none: show them all.
  const visible = shownCols.some((c) => canHide(c.col)) || hideable.length === 0 ? shownCols : keyed

  const sortCol = sort && !serverPaged ? keyed.find((c) => c.key === sort.key)?.col : undefined
  const sortValue = sortCol?.sortValue
  const sorted = sortValue && sort ? sortRows(rows, sortValue, sort.dir) : rows

  const sizes = pageSizes.length > 0 ? pageSizes : PAGE_SIZES
  const [sizeRaw, setSizeRaw] = useStoredState(
    tableId ? `dnms.table.${tableId}.size` : undefined,
    String(pageSize || sizes[0]),
  )
  const ownPaging = !serverPaged && pageSize !== false
  const size = sizes.includes(Number(sizeRaw)) ? Number(sizeRaw) : Number(pageSize || sizes[0])
  const ownTotalPages = ownPaging ? Math.max(1, Math.ceil(sorted.length / size)) : 1
  const current = Math.min(page, ownTotalPages)
  // A filter upstream can shrink the list under the current page.
  if (ownPaging && page !== current) setPage(current)
  const start = ownPaging ? (current - 1) * size : 0
  const shown = ownPaging ? sorted.slice(start, start + size) : sorted
  const serialStart = serverPaged ? serialOffset : start

  const sel: DataTableSelection | null =
    selection ??
    (exportName
      ? {
          isSelected: (k) => ownPicked.has(k),
          toggle: (k) =>
            setOwnPicked((prev) => {
              const next = new Set(prev)
              if (next.has(k)) next.delete(k)
              else next.add(k)
              return next
            }),
          toggleAll: (keys = []) =>
            setOwnPicked((prev) => {
              const next = new Set(prev)
              const all = keys.length > 0 && keys.every((k) => next.has(k))
              keys.forEach((k) => (all ? next.delete(k) : next.add(k)))
              return next
            }),
          count: ownPicked.size,
          clear: () => setOwnPicked(new Set()),
        }
      : null)

  // Keys come from each row's place in `rows`, so index-based keys survive sorting.
  const position = new Map(rows.map((row, i) => [row, i]))
  const keyOf = (row: T) => rowKey(row, position.get(row) ?? 0)
  const shownKeys = shown.map(keyOf)
  const allOnPage = !!sel && shownKeys.length > 0 && shownKeys.every((k) => sel.isSelected(k))
  const someOnPage = !!sel && !allOnPage && shownKeys.some((k) => sel.isSelected(k))
  // A ticked row a filter has since hidden is neither counted nor exported.
  const pickedRows = sel ? sorted.filter((row) => sel.isSelected(keyOf(row))) : []
  const pickedCount = serverPaged ? (sel?.count ?? pickedRows.length) : pickedRows.length
  const clearPicked = () => {
    if (!sel) return
    if (sel.clear) sel.clear()
    else pickedRows.forEach((row) => sel.toggle(keyOf(row)))
  }
  const selecting = pickedCount > 0

  const exportCols = keyed.filter(
    ({ col }) => typeof col.header === "string" && (col.exportValue ?? col.sortValue),
  )
  const canExport = !!exportName && exportCols.length > 0
  const exportRows = pickedRows.length > 0 ? pickedRows : sorted

  async function download(format: "csv" | "xlsx") {
    const base = serverPaged ? serialOffset : 0
    const rank = new Map(sorted.map((row, i) => [row, base + i + 1]))
    const header = ["S.No", ...exportCols.map(({ col }) => String(col.header))]
    const body = exportRows.map((row) => [
      rank.get(row) ?? "",
      ...exportCols.map(({ col }) => spreadsheetSafe((col.exportValue ?? col.sortValue)!(row))),
    ])
    // Names that already carry a date (a range) don't get today's as well.
    const stem = /\d{4}-\d{2}-\d{2}/.test(exportName!)
      ? exportName
      : `${exportName}-${new Date().toISOString().slice(0, 10)}`
    if (format === "csv") {
      // BOM, or Excel on Windows garbles UTF-8 (the rupee sign, Hindi names).
      downloadCsv(`﻿${toCsv(body, header)}`, `${stem}.csv`)
      return
    }
    try {
      const { exportToXlsx } = await import("@/lib/export-xlsx")
      await exportToXlsx(header, body, `${stem}.xlsx`)
    } catch {
      toast.error("Could not build the Excel file. Try again, or export as CSV.")
    }
  }

  const columnsMenu = pickerOn ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Show or hide columns" title="Columns">
          <Columns3 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 min-w-48 overflow-y-auto">
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        {hideable.map(({ col, key }) => {
          const on = visible.some((c) => c.key === key)
          const lastOne = on && visible.filter((c) => canHide(c.col)).length === 1
          return (
            <DropdownMenuCheckboxItem
              key={key}
              checked={on}
              disabled={lastOne}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(next) => {
                const keys = new Set(hidden)
                if (next) keys.delete(key)
                else keys.add(key)
                setHiddenRaw(JSON.stringify([...keys]))
              }}
            >
              {col.header}
            </DropdownMenuCheckboxItem>
          )
        })}
        {hidden.size > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setHiddenRaw("[]")}>
              Show all columns
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  const exportMenu = canExport ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-1.5" disabled={exportRows.length === 0}>
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          {pickedRows.length > 0
            ? `${plural(pickedRows.length, itemLabel)} ticked`
            : serverPaged
              ? `This page: ${plural(exportRows.length, pagination?.itemLabel ?? itemLabel)}`
              : `All ${plural(exportRows.length, itemLabel)}`}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void download("csv")}>
          <Download className="h-4 w-4" />
          CSV file
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void download("xlsx")}>
          <FileSpreadsheet className="h-4 w-4" />
          Excel file
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  const showBar = toolbar != null || toolbarEnd != null || columnsMenu != null || exportMenu != null
  const countNoun = pagination?.itemLabel ?? itemLabel
  const bar = showBar ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5">
      <div className="flex min-w-0 flex-[1_1_320px] flex-wrap items-center gap-2">
        {toolbar ??
          (loading ? (
            <Skeleton className="h-3 w-20" />
          ) : (
            <span className="text-muted-foreground text-xs tabular-nums">
              {plural(pagination?.total ?? sorted.length, countNoun)}
            </span>
          ))}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {toolbarEnd}
        {exportMenu}
        {columnsMenu}
      </div>
    </div>
  ) : null

  // Footer: the range, rows per page and page buttons.
  const total = serverPaged ? pagination.total : sorted.length
  const totalPages = serverPaged ? pagination.totalPages : ownTotalPages
  const rangeStart = serverPaged
    ? pagination.pageSize
      ? (pagination.page - 1) * pagination.pageSize + 1
      : serialOffset + 1
    : start + 1
  const sizeChoice = serverPaged ? !!pagination.onPageSizeChange : ownPaging
  const footer =
    !loading &&
    total > 0 &&
    (serverPaged || totalPages > 1 || (sizeChoice && total > Math.min(...sizes))) ? (
      <Pagination
        className="border-t px-3 py-2.5"
        hideOnSinglePage={false}
        page={serverPaged ? pagination.page : current}
        totalPages={totalPages}
        total={total}
        itemLabel={countNoun}
        onPageChange={serverPaged ? pagination.onPageChange : setPage}
        range={{ start: rangeStart, end: Math.min(total, rangeStart + shown.length - 1) }}
        pageSizes={sizes}
        pageSize={serverPaged ? pagination.pageSize : size}
        onPageSizeChange={
          !sizeChoice
            ? undefined
            : serverPaged
              ? pagination.onPageSizeChange
              : (n) => {
                  setSizeRaw(String(n))
                  setPage(1)
                }
        }
      />
    ) : null

  const alignClass = (align?: DataTableColumn<T>["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
  const justifyClass = (align?: DataTableColumn<T>["align"]) =>
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"

  const rowKeyHandler = (row: T) =>
    onRowClick
      ? (e: React.KeyboardEvent) => {
          if (e.target !== e.currentTarget) return
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onRowClick(row)
          }
        }
      : undefined

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
        : shown.map((row, i) => {
            const key = shownKeys[i]!
            const rowIndex = serialStart + i
            const picked = sel?.isSelected(key) ?? false
            return (
              <div
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={rowKeyHandler(row)}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  "p-4 transition-colors",
                  onRowClick &&
                    "focus-visible:ring-ring hover:bg-muted/20 cursor-pointer focus-visible:ring-2 focus-visible:outline-none",
                  picked && "bg-primary/5",
                  rowClassName?.(row),
                )}
              >
                <div className="flex items-start gap-3">
                  {sel && (
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={picked}
                        onCheckedChange={() => sel.toggle(key)}
                        aria-label="Select row"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {mobileCard ? (
                      mobileCard(row, rowIndex)
                    ) : (
                      <dl className="space-y-1.5">
                        {visible.map(({ col, key: ck }) => {
                          const value = col.cell(row, rowIndex)
                          if (value === null || value === undefined || value === "") return null
                          return (
                            <div
                              key={ck}
                              className="flex items-start justify-between gap-3 text-sm"
                            >
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

  // Phones get cards, not the header row, so the selection count and actions sit above them.
  const phoneSelection =
    cardsOn && selecting ? (
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm md:hidden">
        <span className="font-semibold">{pickedCount} selected</span>
        <button
          type="button"
          onClick={clearPicked}
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Clear
        </button>
        {selection ? selectionActions : null}
      </div>
    ) : null

  return (
    <div className={cn("bg-card rounded-sm border", className)}>
      {bar}
      {phoneSelection}
      {cards}
      {/* contain-inline-size: a wide table scrolls here instead of widening the page. */}
      <div
        className={cn(
          "overflow-x-auto contain-inline-size",
          maxHeight && ["overflow-y-auto", maxHeight],
          cardsOn && "hidden md:block",
        )}
      >
        <table className={cn("w-full text-sm", minWidth)}>
          <thead>
            <tr
              className={cn(
                "border-b whitespace-nowrap",
                // Solid when sticky, or rows show through it.
                maxHeight ? "bg-muted sticky top-0 z-10" : "bg-muted/40",
              )}
            >
              {sel && (
                <th className="relative w-10 px-4 py-3">
                  <Checkbox
                    checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                    onCheckedChange={() => sel.toggleAll(shownKeys)}
                    aria-label="Select all rows on this page"
                  />
                  {/* Headings turn invisible, not removed, so no column changes width. */}
                  {selecting ? (
                    <span className="absolute inset-y-0 left-full z-10 flex items-center gap-3 pl-1 text-sm font-normal whitespace-nowrap">
                      <span className="text-foreground font-semibold">{pickedCount} selected</span>
                      <button
                        type="button"
                        onClick={clearPicked}
                        className="text-muted-foreground hover:text-foreground underline-offset-4 transition-colors hover:underline"
                      >
                        Clear
                      </button>
                      {selection && selectionActions ? (
                        <span className="flex items-center gap-2">{selectionActions}</span>
                      ) : null}
                    </span>
                  ) : null}
                </th>
              )}
              {showSerial && (
                <th
                  className={cn(
                    "text-muted-foreground w-12 px-4 py-3 text-left font-semibold",
                    selecting && "invisible",
                  )}
                >
                  S.No
                </th>
              )}
              {visible.map(({ col, key }) => {
                const sortable = !!col.sortValue && !serverPaged
                const active = sort?.key === key && sortable
                return (
                  <th
                    key={key}
                    aria-sort={
                      active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined
                    }
                    className={cn(
                      "text-muted-foreground px-4 py-3 font-semibold",
                      alignClass(col.align),
                      selecting && "invisible",
                      col.headClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => {
                          // Ascending, descending, then back to the original order.
                          setSort((s) =>
                            s?.key !== key
                              ? { key, dir: "asc" }
                              : s.dir === "asc"
                                ? { key, dir: "desc" }
                                : null,
                          )
                          setPage(1)
                        }}
                        className={cn(
                          "hover:text-foreground inline-flex items-center gap-1 font-semibold transition-colors",
                          active && "text-foreground",
                          col.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {col.header}
                        {active ? (
                          sort!.dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading
              ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                  <tr key={`sk-${rowIndex}`}>
                    {sel && (
                      <td className="w-10 px-4 py-3">
                        <Skeleton className="h-4 w-4 rounded-sm" />
                      </td>
                    )}
                    {showSerial && (
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-4" />
                      </td>
                    )}
                    {visible.map(({ col, key }, i) => (
                      <td key={key} className={cn("px-4 py-3", alignClass(col.align))}>
                        <div className={cn("flex", justifyClass(col.align))}>
                          {col.skeleton ?? (
                            <Skeleton className={cn("h-4", skeletonWidth(i, visible.length))} />
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              : shown.map((row, i) => {
                  const key = shownKeys[i]!
                  const rowIndex = serialStart + i
                  const picked = sel?.isSelected(key) ?? false
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={rowKeyHandler(row)}
                      role={onRowClick ? "button" : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      className={cn(
                        "transition-colors",
                        picked ? "bg-primary/5" : "hover:bg-muted/20",
                        onRowClick &&
                          "focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none",
                        rowClassName?.(row),
                      )}
                    >
                      {sel && (
                        <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={picked}
                            onCheckedChange={() => sel.toggle(key)}
                            aria-label="Select row"
                          />
                        </td>
                      )}
                      {showSerial && (
                        <td className="text-muted-foreground px-4 py-3 tabular-nums">
                          {rowIndex + 1}
                        </td>
                      )}
                      {visible.map(({ col, key: ck }) => (
                        <td
                          key={ck}
                          className={cn(
                            "px-4 py-3 align-middle whitespace-nowrap",
                            alignClass(col.align),
                            col.className,
                          )}
                        >
                          {col.cell(row, rowIndex)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          {empty ?? "Nothing to show yet."}
        </p>
      ) : null}
      {footerNote ? (
        <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">{footerNote}</p>
      ) : null}
      {footer}
    </div>
  )
}
