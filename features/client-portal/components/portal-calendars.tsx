"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, ExternalLink, Plus, Table2, Trash2, User } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
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

// =============================================================================
// The client's view of the team's content calendars.
// =============================================================================
// The SAME sheets the team fills on the project's Calendars tab - a cell edited
// here is edited there. Only calendars staff ticked as shared ever arrive, and
// the filtering happens on the server, so this component never has to decide
// what it is allowed to show.
//
// ── WHY NOT REUSE project-sheet.tsx ──────────────────────────────────────────
// That component is ~2,000 lines and carries column editing, import, history,
// assignment, deletion, resizing and a staff session. None of it is available
// to a client, so reusing it would mean threading the portal's access rules
// through a staff component and trusting every branch to respect them. What a
// client may do - fill a cell - is small enough to write plainly.
//
// It does have to FEEL like that grid, and like every other spreadsheet the
// client has used: frozen header and row numbers, column letters, a cursor you
// drive with the arrow keys, type-to-replace, Enter down and Tab across. Those
// are not decoration - a grid that only answers the mouse reads as a table, and
// people do not try to type into a table.
// =============================================================================

/** Geometry, matched to the staff grid so the two read as the same object. */
const ROW_H = 64
const COL_W = 220
const GUTTER_W = 44
const HEADER_H = 30

/**
 * How many rows the grid offers before anyone asks for more.
 *
 * Every one is live and none is a database row: the server creates a row the
 * first time something is typed into it, so an untouched grid of a hundred
 * costs nothing to offer. The staff grid offers a thousand on the same basis.
 */
const DEFAULT_ROWS = 100
/** What the button under the grid adds, the way a spreadsheet's does. */
const ROW_STEP = 100
/** Rows kept in the DOM above and below the visible band, to hide fast scrolling. */
const OVERSCAN = 6

/** Types whose own control IS the editor - there is no "start editing" step. */
const LIVE_TYPES = new Set<string>(["SELECT", "CHECKBOX"])
/**
 * Types a client may not set.
 *
 * PERSON stores an employee id, and the portal has no staff roster to pick from
 * or to resolve one against. Read-only is the honest answer; a free-text box
 * would let someone type a name into a column that holds ids.
 */
const READ_ONLY_TYPES = new Set<string>(["PERSON"])

/** One shared empty object, so "nothing pending" is a stable reference. */
const EMPTY_CELLS: Record<string, CellValue> = {}

/**
 * A calendar, plus whether this client may remove it.
 *
 * `canDelete` comes from the server, which knows who is asking. It is only ever
 * true for a calendar they started: the team's are theirs to delete, and the
 * API refuses regardless of what this flag says.
 */
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

  // Fall back to the first calendar/tab rather than holding an id that is no
  // longer shared - a calendar can be withdrawn while this page is open.
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
      // Put the server's value back under the cell that failed, or the grid
      // goes on showing an edit that was never saved.
      invalidate()
    },
  })

  const deleteCalendar = useMutation({
    mutationFn: (id: string) => apiFetch(`${base}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Calendar deleted")
      setConfirmDelete(null)
      // Let the fallback below pick the next calendar rather than naming one
      // here - by the time this runs the list has not refetched yet.
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
      // Open what they just made, rather than leaving them on whichever
      // calendar happened to be first.
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

  // A failed load must not read as "nothing shared with you": those are two very
  // different things to tell somebody, and only one of them is actionable.
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
          // Says BOTH ways one arrives. The old copy only mentioned the team
          // sharing one, which read as "there is nothing you can do here".
          description="Calendars the team shares with you appear here. You can also start one of your own - the team sees it too."
          action={{ label: "New calendar", onClick: () => setCreating(true) }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {/* One picker for the calendar, one strip for its tabs - the same
                two levels the team sees, named the same way. Shown even for a
                single calendar, because otherwise its name appears nowhere. */}
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
                {/* The month is part of the NAME here, because the name alone
                    stopped being unique: a calendar now has one edition per
                    month, so a team sharing September and October would
                    otherwise offer two identical-looking rows. */}
                {workbooks.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.periodMonth ? `${w.name} · ${formatMonth(w.periodMonth)}` : w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Kept visible but disabled on the team's calendars, rather than
                hidden: "where did the button go" is a worse question than one
                the button answers itself. */}
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
            // Remount on a tab change: the cursor, the open editor and the
            // not-yet-echoed values all belong to the sheet they were made on.
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

/**
 * The grid.
 *
 * Rows are addressed by POSITION, not by id: the grid offers far more rows than
 * exist, and the server creates the row the first time something lands in it.
 * That is the same contract the staff grid uses, and it is why a blank row can
 * be filled without being created first.
 */
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
   * Values written but not yet echoed back by the fetch.
   *
   * Without them a committed cell shows its OLD value until the refetch lands
   * and then flips, which reads as the edit having been rejected.
   *
   * They are NOT a local copy that outlives the server's. Each batch is stamped
   * with the rows array it was written against, and the moment a fetch replaces
   * that array the batch stops counting - so a colleague editing the same
   * calendar always wins in the end. Stamping rather than clearing in an effect
   * keeps this a derivation: there is no render in which the stale values are
   * still on screen waiting to be cleaned up.
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

  /** Cumulative y of every row - drives both the window and scroll-into-view. */
  const offsets = React.useMemo(() => rowOffsets(total, heightOf), [total, heightOf])

  const scrollerRef = React.useRef<HTMLDivElement>(null)

  // ── Windowing ──────────────────────────────────────────────────────────────
  // A hundred rows by twenty-six columns is 2,600 cells, and every one of them
  // would re-render on every arrow key. Only the visible band is in the DOM;
  // two spacer rows stand in for the rest, so the scrollbar still measures the
  // whole grid. It is also what keeps "Add 100 rows" free: the cost of a row
  // nobody has scrolled to is zero.
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
    if (next === valueAt(pos, column)) return // in and out again is not an edit
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
    // A seed is the character that opened the edit: typing over a selected cell
    // REPLACES it, exactly as it does in a spreadsheet.
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
          // Read the value out FIRST: React pools nothing these days, but the
          // functional setState below runs after the handler returns, and
          // touching the event in there throws on every scroll.
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
              {/* Frozen on BOTH axes so the corner stays put when the grid is
                  scrolled diagonally. The backgrounds are deliberately OPAQUE:
                  a translucent header lets row 1 show through as it scrolls
                  under, which reads as the header being broken. */}
              <th
                className="bg-muted border-border sticky top-0 left-0 z-30 border-r border-b"
                style={{ height: HEADER_H }}
              />
              {columns.map((c, ci) => {
                // A column still called by its letter is UNNAMED - show just
                // the letter, as a spreadsheet does. Once the team renames it
                // the name leads and the letter stays as the small reference
                // people say out loud ("what's in C4?").
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
            {/* Spacers stand in for the rows outside the window, so the
                scrollbar reflects the whole grid rather than the slice of it
                that happens to be mounted. */}
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

      {/* The spreadsheet answer to running out of room. Nothing is saved by
          pressing it - blank rows are not database rows - so it simply offers
          more of the grid. */}
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

/**
 * One row.
 *
 * Its own component so that moving the cursor re-renders the two rows that
 * changed rather than all hundred: `selectedCol` and `editingColumnId` are null
 * for every other row, so their props do not move.
 */
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
    <tr>
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
              // The cursor sits ON TOP of its neighbours, or the ring is
              // clipped by the next cell's rule.
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

/**
 * One cell: what it looks like at rest, and what it becomes while being typed
 * into.
 *
 * At rest it is plain text, not an input. A hundred rows of live inputs is
 * thousands of focusable controls, which is both slow and wrong - in a
 * spreadsheet exactly one cell is in edit mode at a time.
 */
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
    // A SELECT with no choices yet would render an unopenable dropdown, which
    // reads as broken rather than as unconfigured.
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
      /* Wraps and clips to the ROW's height, which is what a spreadsheet does:
         the whole value is stored and you see as much of it as the row is tall.
         Row heights are the team's to set, so a clipped cell is one to ask them
         about - the client cannot drag rows here. */
      <div className="h-full overflow-hidden px-2 py-1 leading-snug break-words whitespace-pre-wrap">
        <CellText column={column} value={value} />
      </div>
    )
  }

  const value_ = () => (draft.trim() === "" ? null : draft)
  const keys = (e: React.KeyboardEvent) => {
    // Stopped here rather than left to bubble: the grid's own handler would
    // read this keystroke as a second command and move the cursor out from
    // under the editor that is still open.
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
    // Enter commits everywhere EXCEPT a long-text cell, where a newline is the
    // whole reason that type exists. There, Ctrl/Cmd+Enter commits.
    if (e.key === "Enter" && (column.type !== "LONG_TEXT" || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onCommitAndMove(value_(), 1, 0)
    }
  }

  // Every free-text type edits in a TEXTAREA, not an input: a single-line input
  // scrolls sideways as you type and only appears to wrap once committed.
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
    // The portal has no staff roster, so the stored id cannot be turned into a
    // name here. Saying "someone is on this" is true; printing a raw id at a
    // client, or showing an assigned cell as blank, is not.
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
