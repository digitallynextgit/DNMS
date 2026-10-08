"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, ExternalLink, Plus, Table2, Trash2, User } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { useMeasuredRowHeights } from "@/hooks/use-measured-row-heights"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { FormDialog } from "@/components/shared/form-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { rowOffsets, rowWindow } from "../lib/grid-window"
import {
  columnLetter,
  normalizeCell,
  type CellValue,
  type ProjectSheet,
  type SheetColumn,
  type SheetWorkbook,
} from "@/features/projects/lib/sheet-types"
import { formatMonth } from "@/features/projects/lib/calendar-months"

// Client view of shared calendars. Not project-sheet.tsx: a client may only fill cells, but the
// grid must still feel like a spreadsheet (keyboard cursor, type-to-replace, Enter/Tab).

/** Matches the staff grid. */
const ROW_H = 64
const COL_W = 220
const GUTTER_W = 44
const HEADER_H = 30

/** Rows offered up front. A row only becomes a DB row when something is typed into it. */
const DEFAULT_ROWS = 100
const ROW_STEP = 100
/** Rows kept in the DOM above and below the visible band, to hide fast scrolling. */
const OVERSCAN = 6

/** Types whose own control IS the editor - there is no "start editing" step. */
const LIVE_TYPES = new Set<string>(["SELECT", "CHECKBOX"])
/** PERSON holds an employee id and the portal has no roster, so it's read-only. */
const READ_ONLY_TYPES = new Set<string>(["PERSON"])

/** One shared empty object, so "nothing pending" is a stable reference. */
const EMPTY_CELLS: Record<string, CellValue> = {}

/** `canDelete` comes from the server: true only for calendars this client started. */
type PortalWorkbook = SheetWorkbook & { canDelete: boolean }

interface CalendarsPayload {
  workbooks: PortalWorkbook[]
  projectName: string
}

export function PortalCalendars({ projectRef }: { projectRef: string }) {
  const qc = useQueryClient()
  const base = `/api/portal/projects/${projectRef}/calendars`

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["portal-calendars", projectRef],
    queryFn: async () => (await apiFetch<{ data: { data: CalendarsPayload } }>(base)).data.data,
    staleTime: 30_000,
  })

  const workbooks = data?.workbooks ?? []
  const [bookId, setBookId] = React.useState<string | null>(null)
  const [sheetId, setSheetId] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [confirmDelete, setConfirmDelete] = React.useState<PortalWorkbook | null>(null)

  // Fall back to the first calendar/tab: one can be un-shared while the page is open.
  const book = workbooks.find((w) => w.id === bookId) ?? workbooks[0] ?? null
  const sheet = book?.sheets.find((s) => s.id === sheetId) ?? book?.sheets[0] ?? null

  const invalidate = () => qc.invalidateQueries({ queryKey: ["portal-calendars", projectRef] })

  const writeCells = useMutation({
    mutationFn: (vars: {
      workbookId: string
      sheetId: string
      position: number
      cells: Record<string, CellValue>
    }) =>
      apiFetch(`${base}/${vars.workbookId}/sheets/${vars.sheetId}/cells`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: vars.position, cells: vars.cells }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => {
      toast.error(e.message)
      // Put the server's value back, or the grid keeps showing an unsaved edit.
      invalidate()
    },
  })

  const deleteCalendar = useMutation({
    mutationFn: (id: string) => apiFetch(`${base}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Calendar deleted")
      setConfirmDelete(null)
      // Let the fallback pick the next calendar - the list hasn't refetched yet.
      setBookId(null)
      setSheetId(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const createCalendar = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ data: { data: { workbook: SheetWorkbook } } }>(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: (res) => {
      toast.success("Calendar created")
      setCreating(false)
      setNewName("")
      setBookId(res.data.data.workbook.id)
      setSheetId(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64 rounded-sm" />
        <Skeleton className="h-[70vh] rounded-sm" />
      </div>
    )
  }

  // A failed load must not read as "nothing shared with you".
  if (isError) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold">Calendars</h1>
        <EmptyState
          icon={AlertTriangle}
          variant="card"
          title="Could not load the calendars"
          description={
            error instanceof Error && error.message ? error.message : "Please try again."
          }
          action={{ label: "Try again", onClick: () => void refetch() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Calendars</h1>
          <p className="text-muted-foreground text-sm">
            The content calendars the team has shared with you, and any you make yourself. Click a
            cell and type - arrow keys move, Enter goes down, Tab goes across.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New calendar
        </Button>
      </div>

      {workbooks.length === 0 || !book || !sheet ? (
        <EmptyState
          icon={Table2}
          variant="card"
          title="No calendars yet"
          description="Calendars the team shares with you appear here. You can also start one of your own - the team sees it too."
          action={{ label: "New calendar", onClick: () => setCreating(true) }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {/* Shown even for one calendar, or its name appears nowhere. */}
            <Select
              value={book.id}
              onValueChange={(v) => {
                setBookId(v)
                setSheetId(null)
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* The month is part of the name: a calendar has one edition per month. */}
                {workbooks.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.periodMonth ? `${w.name} · ${formatMonth(w.periodMonth)}` : w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Disabled rather than hidden on the team's calendars. */}
            <Button
              variant="ghost"
              disabled={!book.canDelete || deleteCalendar.isPending}
              title={
                book.canDelete
                  ? `Delete "${book.name}"`
                  : "The team made this calendar. Ask them to remove it, or to stop sharing it with you."
              }
              onClick={() => setConfirmDelete(book)}
              className="text-muted-foreground hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>

            {book.sheets.length > 1 &&
              book.sheets.map((s) => (
                <Button
                  key={s.id}
                  variant={s.id === sheet.id ? "secondary" : "ghost"}
                  onClick={() => setSheetId(s.id)}
                >
                  {s.name}
                </Button>
              ))}
          </div>

          <SheetGrid
            // Remount per tab: cursor, editor and pending values belong to one sheet.
            key={sheet.id}
            sheet={sheet}
            onWrite={(position, cells) =>
              writeCells.mutate({ workbookId: book.id, sheetId: sheet.id, position, cells })
            }
          />
        </>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete this calendar?"
        description={`"${confirmDelete?.name ?? ""}" and everything in it - every tab, row and history entry - will be permanently removed, for the team as well as for you.`}
        variant="destructive"
        confirmLabel="Delete"
        isLoading={deleteCalendar.isPending}
        onConfirm={() => confirmDelete && deleteCalendar.mutate(confirmDelete.id)}
      />

      <FormDialog
        open={creating}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setNewName("")
          }
        }}
        title="New calendar"
        description="It starts as an empty grid, and the team can see it too."
        submitLabel="Create"
        size="sm"
        isPending={createCalendar.isPending}
        submitDisabled={!newName.trim()}
        onSubmit={(e) => {
          e.preventDefault()
          if (newName.trim()) createCalendar.mutate(newName.trim())
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="calendar-name">Name</Label>
          <Input
            id="calendar-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={120}
            placeholder="October posts"
            autoFocus
          />
          <p className="text-muted-foreground text-xs">
            It opens with {DEFAULT_ROWS} rows and columns named A to Z. Ask the team if you need the
            columns titled - the team sets those up.
          </p>
        </div>
      </FormDialog>
    </div>
  )
}

/** The grid. Rows are addressed by position; the server creates a row on its first write. */
function SheetGrid({
  sheet,
  onWrite,
}: {
  sheet: ProjectSheet
  onWrite: (position: number, cells: Record<string, CellValue>) => void
}) {
  const columns = React.useMemo(
    () => [...sheet.columns].sort((a, b) => a.position - b.position),
    [sheet.columns],
  )
  const rowByPos = React.useMemo(
    () => new Map(sheet.rows.map((r) => [r.position, r])),
    [sheet.rows],
  )

  const [selected, setSelected] = React.useState<{ r: number; c: number } | null>(null)
  const [editing, setEditing] = React.useState<{ r: number; columnId: string } | null>(null)
  const [draft, setDraft] = React.useState("")
  const [extra, setExtra] = React.useState(0)

  /**
   * Values written but not yet echoed by the refetch, so a committed cell doesn't flash its old
   * value. Each batch is tied to the rows array it was written against and stops counting once a
   * fetch replaces it, so the server always wins in the end.
   */
  const [pending, setPending] = React.useState<{
    rows: ProjectSheet["rows"]
    cells: Record<string, CellValue>
  }>({ rows: sheet.rows, cells: EMPTY_CELLS })
  const unsaved = pending.rows === sheet.rows ? pending.cells : EMPTY_CELLS

  /** The last row anyone has actually used, so existing data is never cut off. */
  const used = sheet.rows.reduce((max, r) => Math.max(max, r.position + 1), 0)
  const total = Math.max(DEFAULT_ROWS, used) + extra

  const heightOf = React.useCallback(
    (pos: number) => sheet.rowHeights?.[String(pos)] ?? ROW_H,
    [sheet.rowHeights],
  )

  const scrollerRef = React.useRef<HTMLDivElement>(null)

  /**
   * Real on-screen row heights (stored, or grown around wrapped text). See useMeasuredRowHeights.
   */
  const extentOf = useMeasuredRowHeights(scrollerRef, heightOf, sheet.id)

  /** Cumulative y of every row - drives both the window and scroll-into-view. */
  const offsets = React.useMemo(() => rowOffsets(total, extentOf), [total, extentOf])

  // Only the visible band is in the DOM; two spacer rows stand in for the rest.
  const [scroll, setScroll] = React.useState({ top: 0, height: 600 })
  React.useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const measure = () => setScroll((s) => ({ ...s, height: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { firstRow, lastRow, topPad, bottomPad } = rowWindow(
    offsets,
    total,
    scroll.top,
    scroll.height,
    OVERSCAN,
  )
  const visible = Array.from({ length: Math.max(0, lastRow - firstRow) }, (_, i) => firstRow + i)

  const widthOf = (c: SheetColumn) => c.width ?? COL_W
  const totalWidth = GUTTER_W + columns.reduce((sum, c) => sum + widthOf(c), 0)

  const valueAt = (pos: number, column: SheetColumn): CellValue => {
    const key = `${pos}:${column.id}`
    if (key in unsaved) return unsaved[key]!
    return rowByPos.get(pos)?.cells[column.id] ?? null
  }

  const commit = (pos: number, column: SheetColumn, raw: CellValue) => {
    setEditing(null)
    const next = normalizeCell(column.type, raw)
    if (next === valueAt(pos, column)) return
    setPending({ rows: sheet.rows, cells: { ...unsaved, [`${pos}:${column.id}`]: next } })
    onWrite(pos, { [column.id]: next })
  }

  /** Move the cursor, clamped, and scroll it back into view. */
  const move = (dr: number, dc: number) => {
    setSelected((sel) => {
      const cur = sel ?? { r: 0, c: 0 }
      const next = {
        r: Math.min(Math.max(0, cur.r + dr), total - 1),
        c: Math.min(Math.max(0, cur.c + dc), Math.max(0, columns.length - 1)),
      }
      const el = scrollerRef.current
      if (el) {
        const top = offsets[next.r] ?? 0
        const bottom = offsets[next.r + 1] ?? top + ROW_H
        // +HEADER_H, or the frozen header covers the row just moved onto.
        if (top < el.scrollTop + HEADER_H) el.scrollTop = Math.max(0, top - HEADER_H)
        else if (bottom > el.scrollTop + el.clientHeight)
          el.scrollTop = bottom + HEADER_H - el.clientHeight
      }
      return next
    })
  }

  const startEdit = (pos: number, column: SheetColumn, seed?: string) => {
    if (READ_ONLY_TYPES.has(column.type) || LIVE_TYPES.has(column.type)) return
    const v = valueAt(pos, column)
    setEditing({ r: pos, columnId: column.id })
    // Typing over a selected cell replaces it, as in a spreadsheet.
    setDraft(seed !== undefined ? seed : v === null ? "" : String(v))
  }

  /** Keys land here only while no editor is open - the editor stops its own. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing || !selected) return
    const column = columns[selected.c]
    if (!column) return

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault()
        return move(-1, 0)
      case "ArrowDown":
        e.preventDefault()
        return move(1, 0)
      case "ArrowLeft":
        e.preventDefault()
        return move(0, -1)
      case "ArrowRight":
        e.preventDefault()
        return move(0, 1)
      case "Tab":
        e.preventDefault()
        return move(0, e.shiftKey ? -1 : 1)
      case "Enter":
      case "F2":
        e.preventDefault()
        return startEdit(selected.r, column)
      case "Delete":
      case "Backspace":
        e.preventDefault()
        if (!READ_ONLY_TYPES.has(column.type)) commit(selected.r, column, null)
        return
    }
    // A printable character opens the edit and becomes its first character.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      startEdit(selected.r, column, e.key)
    }
  }

  if (columns.length === 0) {
    return (
      <p className="text-muted-foreground rounded-sm border p-4 text-sm">
        This calendar has no columns yet. The team sets those up.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div
        ref={scrollerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          // Read it first: the functional setState runs after the handler returns.
          const top = e.currentTarget.scrollTop
          setScroll((s) => ({ ...s, top }))
        }}
        className="bg-card focus-visible:ring-ring/40 h-[70vh] overflow-auto rounded-sm border focus-visible:ring-2 focus-visible:outline-none"
      >
        <table
          className="border-separate border-spacing-0 text-[13px]"
          style={{ tableLayout: "fixed", width: totalWidth }}
        >
          <colgroup>
            <col style={{ width: GUTTER_W }} />
            {columns.map((c) => (
              <col key={c.id} style={{ width: widthOf(c) }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              {/* Frozen on both axes; opaque so rows don't show through when scrolled under. */}
              <th
                className="bg-muted border-border sticky top-0 left-0 z-30 border-r border-b"
                style={{ height: HEADER_H }}
              />
              {columns.map((c, ci) => {
                // A column still named by its letter is unnamed - show just the letter.
                const unnamed = c.name === columnLetter(ci)
                return (
                  <th
                    key={c.id}
                    title={c.name}
                    className={cn(
                      "bg-muted border-border text-foreground/80 sticky top-0 z-20 border-r border-b px-2 font-medium",
                      selected?.c === ci && "bg-primary/20",
                    )}
                    style={{ height: HEADER_H }}
                  >
                    {unnamed ? (
                      <span className="text-[11px] font-semibold tabular-nums">
                        {columnLetter(ci)}
                      </span>
                    ) : (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="text-muted-foreground text-[10px] tabular-nums">
                          {columnLetter(ci)}
                        </span>
                        <span className="truncate text-xs font-medium">{c.name}</span>
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {topPad > 0 && (
              <tr aria-hidden>
                <td colSpan={columns.length + 1} style={{ height: topPad, padding: 0 }} />
              </tr>
            )}

            {visible.map((pos) => (
              <GridRow
                key={pos}
                pos={pos}
                height={heightOf(pos)}
                columns={columns}
                values={columns.map((c) => valueAt(pos, c))}
                selectedCol={selected?.r === pos ? selected.c : null}
                editingColumnId={editing?.r === pos ? editing.columnId : null}
                draft={draft}
                setDraft={setDraft}
                onSelect={(ci) => setSelected({ r: pos, c: ci })}
                onEdit={(ci) => {
                  const col = columns[ci]
                  if (col) startEdit(pos, col)
                }}
                onCommit={(ci, v) => {
                  const col = columns[ci]
                  if (col) commit(pos, col, v)
                  setSelected({ r: pos, c: ci })
                }}
                onCommitAndMove={(ci, v, dr, dc) => {
                  const col = columns[ci]
                  if (col) commit(pos, col, v)
                  setSelected({
                    r: Math.min(Math.max(0, pos + dr), total - 1),
                    c: Math.min(Math.max(0, ci + dc), columns.length - 1),
                  })
                  scrollerRef.current?.focus()
                }}
                onCancel={() => {
                  setEditing(null)
                  scrollerRef.current?.focus()
                }}
              />
            ))}

            {bottomPad > 0 && (
              <tr aria-hidden>
                <td colSpan={columns.length + 1} style={{ height: bottomPad, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" className="gap-1.5" onClick={() => setExtra(extra + ROW_STEP)}>
          <Plus className="h-3.5 w-3.5" />
          Add {ROW_STEP} rows
        </Button>
        <span className="text-muted-foreground text-xs">
          {total} rows{used > 0 ? ` · ${used} in use` : ""}
        </span>
      </div>
    </div>
  )
}

/** One row. Its own component so a cursor move re-renders only the two rows that changed. */
function GridRow({
  pos,
  height,
  columns,
  values,
  selectedCol,
  editingColumnId,
  draft,
  setDraft,
  onSelect,
  onEdit,
  onCommit,
  onCommitAndMove,
  onCancel,
}: {
  pos: number
  height: number
  columns: SheetColumn[]
  values: CellValue[]
  selectedCol: number | null
  editingColumnId: string | null
  draft: string
  setDraft: (v: string) => void
  onSelect: (ci: number) => void
  onEdit: (ci: number) => void
  onCommit: (ci: number, v: CellValue) => void
  onCommitAndMove: (ci: number, v: CellValue, dr: number, dc: number) => void
  onCancel: () => void
}) {
  return (
    <tr data-row-pos={pos}>
      <th
        className={cn(
          "bg-muted border-border text-muted-foreground sticky left-0 z-10 border-r border-b text-[11px] font-normal tabular-nums",
          selectedCol !== null && "bg-primary/20",
        )}
        style={{ height }}
      >
        {pos + 1}
      </th>
      {columns.map((c, ci) => {
        const isEditing = editingColumnId === c.id
        const isSelected = selectedCol === ci
        return (
          <td
            key={c.id}
            onMouseDown={() => onSelect(ci)}
            onDoubleClick={() => onEdit(ci)}
            className={cn(
              "border-border relative border-r border-b p-0 align-top",
              // The cursor sits on top, or the next cell's border clips the ring.
              isSelected && !isEditing && "ring-primary z-10 ring-2",
              isEditing && "z-20",
            )}
            style={{ height }}
          >
            <PortalCell
              column={c}
              value={values[ci] ?? null}
              isEditing={isEditing}
              draft={draft}
              setDraft={setDraft}
              onCommit={(v) => onCommit(ci, v)}
              onCommitAndMove={(v, dr, dc) => onCommitAndMove(ci, v, dr, dc)}
              onCancel={onCancel}
            />
          </td>
        )
      })}
    </tr>
  )
}

/** One cell: plain text at rest, an editor only while being edited (one at a time). */
function PortalCell({
  column,
  value,
  isEditing,
  draft,
  setDraft,
  onCommit,
  onCommitAndMove,
  onCancel,
}: {
  column: SheetColumn
  value: CellValue
  isEditing: boolean
  draft: string
  setDraft: (v: string) => void
  onCommit: (v: CellValue) => void
  /** Commit, then step the cursor - Enter goes down, Tab goes across. */
  onCommitAndMove: (v: CellValue, dr: number, dc: number) => void
  onCancel: () => void
}) {
  if (column.type === "CHECKBOX") {
    return (
      <div className="flex h-full items-center justify-center">
        <Checkbox
          checked={value === true}
          aria-label={column.name}
          onCheckedChange={(c) => onCommit(c === true)}
        />
      </div>
    )
  }

  if (column.type === "SELECT") {
    // A SELECT with no options would render a dropdown that can't open.
    if (column.options.length === 0) {
      return (
        <span className="text-muted-foreground/50 flex h-full items-center px-2 text-[11px]">
          No choices set
        </span>
      )
    }
    return (
      <Select
        value={value === null ? "" : String(value)}
        onValueChange={(v) => onCommit(v === "__clear__" ? null : v)}
      >
        <SelectTrigger className="h-full w-full rounded-none border-0 bg-transparent px-2 text-[13px] shadow-none focus:ring-0">
          <SelectValue placeholder="" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__">
            <span className="text-muted-foreground">Clear</span>
          </SelectItem>
          {column.options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (!isEditing) {
    return (
      /* Wraps and clips to the row's height, like a spreadsheet. Row heights are staff-only. */
      <div className="h-full overflow-hidden px-2 py-1 leading-snug break-words whitespace-pre-wrap">
        <CellText column={column} value={value} />
      </div>
    )
  }

  const value_ = () => (draft.trim() === "" ? null : draft)
  const keys = (e: React.KeyboardEvent) => {
    // Stop here, or the grid's handler moves the cursor out from under the open editor.
    e.stopPropagation()
    if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
      return
    }
    if (e.key === "Tab") {
      e.preventDefault()
      onCommitAndMove(value_(), 0, e.shiftKey ? -1 : 1)
      return
    }
    // Enter commits, except in LONG_TEXT where Ctrl/Cmd+Enter does.
    if (e.key === "Enter" && (column.type !== "LONG_TEXT" || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onCommitAndMove(value_(), 1, 0)
    }
  }

  // Free text edits in a textarea so it wraps while typing.
  if (column.type === "TEXT" || column.type === "LONG_TEXT" || column.type === "URL") {
    return (
      <Textarea
        autoFocus
        wrap="soft"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(value_())}
        onKeyDown={keys}
        className="ring-primary h-full min-h-0 w-full resize-none overflow-hidden rounded-none border-0 px-2 py-1 text-[13px] leading-snug shadow-none ring-2 focus-visible:ring-2"
      />
    )
  }

  return (
    <Input
      autoFocus
      type={column.type === "NUMBER" ? "number" : column.type === "DATE" ? "date" : "text"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(value_())}
      onKeyDown={keys}
      className="ring-primary h-full w-full rounded-none border-0 px-2 py-1 text-[13px] shadow-none ring-2 focus-visible:ring-2"
    />
  )
}

/** A cell's value at rest, typed the way the staff grid types it. */
function CellText({ column, value }: { column: SheetColumn; value: CellValue }) {
  if (column.type === "PERSON") {
    // No staff roster in the portal to resolve the id, so never print it.
    return value === null || value === "" ? null : (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <User className="h-3 w-3" />
        Team member
      </span>
    )
  }
  if (value === null || value === undefined || value === "") return null
  if (column.type === "URL") {
    const href = String(value)
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-primary inline-flex items-center gap-1 hover:underline"
      >
        <span className="truncate">{href.replace(/^https?:\/\//, "")}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    )
  }
  if (column.type === "DATE") {
    const d = new Date(`${String(value)}T00:00:00.000Z`)
    return (
      <span className="tabular-nums">
        {Number.isNaN(d.getTime())
          ? String(value)
          : d.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })}
      </span>
    )
  }
  if (column.type === "NUMBER") return <span className="tabular-nums">{String(value)}</span>
  return <span className="whitespace-pre-wrap">{String(value)}</span>
}
