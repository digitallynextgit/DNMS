"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import {
  Plus,
  History,
  Trash2,
  Upload,
  Search,
  ChevronUp,
  Table2,
  ChevronDown,
  Pencil,
  Check,
  ExternalLink,
} from "lucide-react"
import { SheetImportDialog } from "./sheet-import-dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAssignableEmployees, useProjectTeams } from "../hooks/use-projects"
import { useProjectSheets, useSheetHistory, useSheetMutations } from "../hooks/use-sheets"
import {
  COLUMN_TYPE_HINT,
  COLUMN_TYPE_LABEL,
  MAX_COL_W,
  MAX_ROW_H,
  MIN_COL_W,
  MIN_ROW_H,
  SHEET_COLUMN_TYPES,
  type CellValue,
  type ProjectSheet,
  type SheetAssignee,
  type SheetColumn,
  type SheetColumnType,
  type SheetEvent,
  type SheetRow,
  type SheetWorkbook,
} from "../lib/sheet-types"

// =============================================================================
// The sheet: a spreadsheet the team builds itself.
//
// It replaces a nine-field form whose fields never matched what any one project
// actually planned. Columns are the team's to define, so the grid makes no
// assumption about what a row means.
//
// ── WHO CAN DO WHAT, AND WHY IT SHOWS ────────────────────────────────────────
// Anyone on the project can add sheets, columns and rows and edit any cell.
// Only the account manager or an admin can DELETE any of the three. Delete
// controls are not rendered at all for everyone else rather than shown disabled:
// a row of greyed bins invites people to ask for permissions they do not need,
// and the sheet is meant to feel open.
//
// Every edit is recorded. That is what makes open editing safe, and it is why
// History sits in the toolbar rather than behind a menu.
//
// ── EDITING MODEL ────────────────────────────────────────────────────────────
// One cell edits at a time, with the value held locally until it is committed
// (Enter, Tab, or clicking away). Escape abandons it. Committed values are shown
// from a local override until the refetch that follows brings the server's copy
// back, so typing never flickers through a stale value.
// =============================================================================

const PLACEHOLDER = ""

// Spreadsheet geometry.
//
// Text WRAPS inside a cell and is clipped to the row's height, which is exactly
// what a spreadsheet does: the value is all there, and you drag the row taller
// to see more of it. Both dimensions are draggable and both persist.
/**
 * Default cell size.
 *
 * A rectangle, not a line: at 28px tall nothing wrapped in practice, because a
 * single line filled the cell and everything after it was clipped. Three lines
 * of the body size, and wide enough for a short sentence, is the smallest thing
 * that behaves like a field you can write in.
 */
const ROW_H = 64
const COL_W = 220
const GUTTER_W = 44
/** The header row. Stays compact - it holds a label, not content. */
const HEADER_H = 30
/**
 * How many rows the grid offers. Every one is live: typing in row 700 creates
 * a row at position 700, and rows nobody has touched cost nothing because they
 * are not database rows at all.
 */
const TOTAL_ROWS = 1000
/** Rows rendered above and below the visible band, to hide fast scrolling. */
const OVERSCAN = 8

/**
 * 0 -> A, 25 -> Z, 26 -> AA. The reference people actually use out loud
 * ("what's in C4?"), which is why it is worth showing even though every column
 * here also has a name.
 */
/**
 * Types whose control IS the editor.
 *
 * A dropdown or a checkbox commits in one gesture, so there is no "start
 * editing" step to enter - and Enter or a printable key must not try to open
 * one, or the cell ends up in a state it cannot leave.
 */
const LIVE_TYPES = new Set<SheetColumnType>(["SELECT", "PERSON", "CHECKBOX"])

function columnLetter(index: number): string {
  let n = index
  let out = ""
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** A cell's text with every hit of the find query highlighted. */
function mark(text: string, highlight?: string): React.ReactNode {
  const q = highlight?.trim().toLowerCase()
  if (!q) return text
  const lower = text.toLowerCase()
  const parts: React.ReactNode[] = []
  let i = 0
  let at = lower.indexOf(q)
  while (at >= 0) {
    if (at > i) parts.push(text.slice(i, at))
    parts.push(
      <mark key={at} className="rounded-[2px] bg-amber-200 text-inherit dark:bg-amber-500/40">
        {text.slice(at, at + q.length)}
      </mark>,
    )
    i = at + q.length
    at = lower.indexOf(q, i)
  }
  if (i < text.length) parts.push(text.slice(i))
  return parts
}

/** What a value looks like when it is NOT being edited. */
function DisplayCell({
  column,
  value,
  people,
  highlight,
}: {
  column: SheetColumn
  value: CellValue
  people: Map<string, string>
  /** The find query, if any - hits are wrapped in <mark>. */
  highlight?: string
}) {
  if (column.type === "CHECKBOX") {
    return value === true ? (
      <Check className="h-4 w-4 text-emerald-500" aria-label="Yes" />
    ) : (
      <span className="text-muted-foreground/40 text-xs">-</span>
    )
  }
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/40">{PLACEHOLDER}</span>
  }
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
  if (column.type === "PERSON") {
    // Falls back to the stored id when the person has left the project, rather
    // than rendering an empty cell that looks like nobody was ever assigned.
    return <span>{mark(people.get(String(value)) ?? String(value), highlight)}</span>
  }
  if (column.type === "SELECT") {
    return (
      <span className="bg-muted inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium">
        {mark(String(value), highlight)}
      </span>
    )
  }
  if (column.type === "NUMBER")
    return <span className="tabular-nums">{mark(String(value), highlight)}</span>
  return <span className="whitespace-pre-wrap">{mark(String(value), highlight)}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Column dialog (add + edit share it - the fields are identical)
// ─────────────────────────────────────────────────────────────────────────────

function ColumnDialog({
  open,
  column,
  onCancel,
  onSave,
}: {
  open: boolean
  /** null when adding. */
  column: SheetColumn | null
  onCancel: () => void
  onSave: (input: { name: string; type: SheetColumnType; options: string[] }) => void
}) {
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<SheetColumnType>("TEXT")
  const [options, setOptions] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    setName(column?.name ?? "")
    setType(column?.type ?? "TEXT")
    setOptions((column?.options ?? []).join("\n"))
  }, [open, column])

  const submit = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      type,
      options:
        type === "SELECT"
          ? options
              .split("\n")
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{column ? "Edit column" : "Add column"}</DialogTitle>
          <DialogDescription>
            {column
              ? "Renaming is safe. Changing the type keeps the values as they are - they are re-read as the new type."
              : "Name it and pick what it holds."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="col-name" className="mb-1.5 block text-xs font-medium">
              Name
            </label>
            <Input
              id="col-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Platform"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div>
            <label htmlFor="col-type" className="mb-1.5 block text-xs font-medium">
              Type
            </label>
            <Select value={type} onValueChange={(v) => setType(v as SheetColumnType)}>
              <SelectTrigger id="col-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHEET_COLUMN_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="flex w-full items-center gap-2">
                      {COLUMN_TYPE_LABEL[t]}
                      <span className="text-muted-foreground text-xs">{COLUMN_TYPE_HINT[t]}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === "SELECT" && (
            <div>
              <label htmlFor="col-options" className="mb-1.5 block text-xs font-medium">
                Choices, one per line
              </label>
              <Textarea
                id="col-options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                rows={5}
                placeholder={"Planned\nIn progress\nReady\nPosted"}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            {column ? "Save" : "Add column"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_VERB: Record<SheetEvent["type"], string> = {
  SHEET_CREATED: "created the sheet",
  SHEET_RENAMED: "renamed the sheet",
  COLUMN_ADDED: "added column",
  COLUMN_UPDATED: "changed column",
  COLUMN_DELETED: "deleted column",
  ROW_ADDED: "added a row",
  CELL_UPDATED: "edited",
  ROW_DELETED: "deleted a row",
}

const shortValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "empty"
  if (typeof v === "boolean") return v ? "ticked" : "unticked"
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80)
  const s = String(v)
  return s.length > 60 ? `${s.slice(0, 60)}…` : s
}

function HistoryDialog({
  open,
  onOpenChange,
  projectId,
  sheet,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  projectId: string
  sheet: ProjectSheet | null
}) {
  const { data, isLoading } = useSheetHistory(projectId, open ? (sheet?.id ?? null) : null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>History{sheet ? ` · ${sheet.name}` : ""}</DialogTitle>
          <DialogDescription>
            Every change, newest first. Append-only - nothing here can be edited or removed.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-sm" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Nothing yet.</p>
          ) : (
            <ol className="space-y-2">
              {data.map((e) => (
                <li key={e.id} className="border-border rounded-sm border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-medium">{e.actorName ?? "Someone"}</span>
                    <span className="text-muted-foreground">{EVENT_VERB[e.type]}</span>
                    {e.label && <span className="font-medium">{e.label}</span>}
                    <span className="text-muted-foreground ml-auto text-[11px] whitespace-nowrap">
                      {fmtWhen(e.at)}
                    </span>
                  </div>
                  {e.type === "CELL_UPDATED" && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      <span className="line-through">{shortValue(e.before)}</span>
                      {" → "}
                      <span className="text-foreground">{shortValue(e.after)}</span>
                    </p>
                  )}
                  {(e.type === "ROW_DELETED" || e.type === "COLUMN_DELETED") &&
                    e.before != null && (
                      <p className="text-muted-foreground mt-0.5 text-xs break-all">
                        was: {shortValue(e.before)}
                      </p>
                    )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// The grid
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The resize handle, on a column header's right edge or a row gutter's bottom.
 *
 * POINTER CAPTURE, not window listeners: capturing routes every subsequent
 * pointer event back to this element even once the pointer has left its 8px,
 * which is what a drag always does immediately. It also ends cleanly if the
 * pointer is lost, which a window listener has to be told about.
 *
 * The element is in NORMAL FLOW - a flex child of the header or gutter - after
 * two attempts with absolute positioning failed. A table cell is not a
 * dependable containing block, so an absolutely-positioned handle was landing
 * somewhere other than the cell it belonged to and could not be hit at all.
 */
function Grip({
  axis,
  onStart,
  onMove,
  onEnd,
  onReset,
}: {
  axis: "col" | "row"
  onStart: (e: React.PointerEvent) => void
  onMove: (e: React.PointerEvent) => void
  onEnd: () => void
  /** Double-click restores the default size. */
  onReset: () => void
}) {
  const [dragging, setDragging] = React.useState(false)
  return (
    <span
      role="separator"
      aria-orientation={axis === "col" ? "vertical" : "horizontal"}
      title="Drag to resize, double-click to reset"
      onPointerDown={(e) => {
        // Left button only: a right-click here should open the browser menu,
        // not start a resize nothing will finish.
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging(true)
        onStart(e)
      }}
      onPointerMove={(e) => {
        if (!dragging) return
        e.preventDefault()
        onMove(e)
      }}
      onPointerUp={(e) => {
        if (!dragging) return
        e.currentTarget.releasePointerCapture(e.pointerId)
        setDragging(false)
        onEnd()
      }}
      onPointerCancel={() => {
        if (!dragging) return
        setDragging(false)
        onEnd()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onReset()
      }}
      className={cn(
        "shrink-0 touch-none transition-colors",
        axis === "col" ? "w-2 cursor-col-resize self-stretch" : "h-2 w-full cursor-row-resize",
        dragging ? "bg-primary" : "hover:bg-primary/70",
      )}
    />
  )
}

interface CellRef {
  /** Row POSITION, not id - the row may not exist until something is typed. */
  pos: number
  columnId: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Who owns a sheet
// ─────────────────────────────────────────────────────────────────────────────

/** Sentinel for "nobody" - Radix Select cannot hold an empty string value. */
const UNASSIGNED = "__none__"

const initials = (p: SheetAssignee) =>
  `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase() || "?"

function PersonAvatar({ person, className }: { person: SheetAssignee; className?: string }) {
  return (
    <Avatar className={cn("h-5 w-5 rounded-full", className)}>
      {person.profilePhoto && <AvatarImage src={person.profilePhoto} alt="" />}
      <AvatarFallback className="rounded-full text-[9px]">{initials(person)}</AvatarFallback>
    </Avatar>
  )
}

/** Avatar + first name, or a muted "Unassigned". */
function AssigneeChip({ person }: { person: SheetAssignee | null }) {
  if (!person) return <span className="text-muted-foreground text-xs">Unassigned</span>
  return (
    <span
      className="flex min-w-0 items-center gap-1.5"
      title={`${person.firstName} ${person.lastName}`.trim()}
    >
      <PersonAvatar person={person} />
      <span className="truncate text-xs font-medium">{person.firstName}</span>
    </span>
  )
}

/**
 * The owner of the open sheet. A manager gets a picker over every active
 * employee - the point is to be able to hand a calendar to anyone in the
 * company, not only to whoever happens to be on this project's teams.
 * Everyone else sees the same chip, read-only.
 */
function WorkbookAssignee({
  projectId,
  workbook,
  canStaff,
  onAssign,
  pending,
}: {
  projectId: string
  workbook: SheetWorkbook
  canStaff: boolean
  onAssign: (employeeId: string | null) => void
  pending: boolean
}) {
  // Only fetched for someone who can actually act on it.
  const people = useAssignableEmployees(projectId, canStaff)

  if (!canStaff) {
    return (
      <span className="flex items-center gap-1.5 px-2" title="Only a manager can change this">
        <AssigneeChip person={workbook.assignedTo} />
      </span>
    )
  }

  return (
    <Select
      value={workbook.assignedTo?.id ?? UNASSIGNED}
      onValueChange={(v) => onAssign(v === UNASSIGNED ? null : v)}
      disabled={pending}
    >
      {/* Custom trigger content instead of <SelectValue />: it has to show the
          avatar, and it must keep working when the current owner has since
          been deactivated and so is missing from the list below. */}
      <SelectTrigger
        className="hover:bg-foreground/5 h-8 w-auto gap-1.5 border-transparent bg-transparent px-2"
        title="Who owns this sheet"
      >
        <AssigneeChip person={workbook.assignedTo} />
      </SelectTrigger>
      <SelectContent align="end" className="max-h-72">
        <SelectItem value={UNASSIGNED}>
          <span className="text-muted-foreground text-xs">Unassigned</span>
        </SelectItem>
        {(people.data?.data ?? []).map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="flex items-center gap-2">
              <PersonAvatar
                person={{
                  id: p.id,
                  firstName: p.firstName,
                  lastName: p.lastName,
                  profilePhoto: p.profilePhoto ?? null,
                }}
              />
              <span className="truncate">
                {p.firstName} {p.lastName}
              </span>
              {p.designation?.title && (
                <span className="text-muted-foreground truncate text-[11px]">
                  {p.designation.title}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ProjectSheetSection({
  projectId,
  canManage,
}: {
  projectId: string
  canManage: boolean
}) {
  const { data: workbooks, isLoading } = useProjectSheets(projectId)
  const { data: teams } = useProjectTeams(projectId)
  const m = useSheetMutations(projectId)
  // Assigning follows the staffing rule, not the delete rule: a team manager
  // owns the work, so they get to say who owns the sheet it lives in.
  const { data: session } = useSession()
  const me = session?.user?.id ?? null
  const canStaff =
    canManage || (teams?.data ?? []).some((t) => t.managerId != null && t.managerId === me)

  // Two levels: the workbook ("sheet" in the UI) and the tab inside it.
  const [activeWorkbookId, setActiveWorkbookId] = React.useState<string | null>(null)
  const workbook = React.useMemo(
    () => workbooks?.find((w) => w.id === activeWorkbookId) ?? workbooks?.[0] ?? null,
    [workbooks, activeWorkbookId],
  )
  const sheets = React.useMemo(() => workbook?.sheets, [workbook])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<CellRef | null>(null)
  /** The highlighted cell: a ROW POSITION and a column index. A sheet has a
   *  cursor even when nothing is being typed. */
  const [selected, setSelected] = React.useState<{ r: number; c: number } | null>(null)
  const [draft, setDraft] = React.useState("")
  // Committed-but-not-yet-refetched values, keyed "position:columnId".
  const [overrides, setOverrides] = React.useState<Record<string, CellValue>>({})
  /**
   * Sizes already committed but not yet echoed back by the server.
   *
   * saveLayout deliberately does not refetch - a refetch on every mouse-up
   * would make the column jump as the server's copy lands. Without this the
   * released column would snap straight back to its old width and the resize
   * would look like it had failed.
   */
  const [sizes, setSizes] = React.useState<{
    cols: Record<string, number>
    rows: Record<number, number>
  }>({ cols: {}, rows: {} })
  const [newSheetOpen, setNewSheetOpen] = React.useState(false)
  const [newSheetName, setNewSheetName] = React.useState("")
  const [columnDialog, setColumnDialog] = React.useState<{ column: SheetColumn | null } | null>(
    null,
  )
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [newTabOpen, setNewTabOpen] = React.useState(false)
  const [newTabName, setNewTabName] = React.useState("")
  // Find in the open tab. `matchIdx` is unbounded and wrapped at use, so a
  // changed query never needs an effect to reset it.
  const [search, setSearch] = React.useState("")
  const [matchIdx, setMatchIdx] = React.useState(0)
  const [confirm, setConfirm] = React.useState<{
    kind: "workbook" | "sheet" | "row" | "column"
    id: string
    label: string
  } | null>(null)
  /**
   * The size being dragged right now.
   *
   * Kept apart from the server's copy so the grid follows the pointer at frame
   * rate without a request per pixel. On mouse-up it is written once and this
   * clears, and the server's value takes over.
   */
  const [drag, setDrag] = React.useState<
    | { kind: "col"; columnId: string; startX: number; startW: number; w: number }
    | { kind: "row"; position: number; startY: number; startH: number; h: number }
    | null
  >(null)

  // Fresh server data supersedes every local override. The cell being typed in
  // keeps its own `draft`, so nothing mid-edit is lost.
  React.useEffect(() => {
    setOverrides({})
    setSizes({ cols: {}, rows: {} })
  }, [sheets])

  const active = React.useMemo(
    () => sheets?.find((s) => s.id === activeId) ?? sheets?.[0] ?? null,
    [sheets, activeId],
  )

  const columns = React.useMemo(() => active?.columns ?? [], [active])

  /**
   * The COMMITTED sizes - deliberately not the in-flight drag.
   *
   * Google Sheets does not reflow the grid while you drag; it paints a guide
   * line and snaps once on release. Following the pointer here instead would
   * relayout every column on every pointer move, and would make the guide line
   * redundant.
   */
  const widthOf = (c: SheetColumn) => sizes.cols[c.id] ?? c.width ?? COL_W

  const heightOf = React.useCallback(
    (pos: number) => sizes.rows[pos] ?? active?.rowHeights?.[String(pos)] ?? ROW_H,
    [active, sizes],
  )

  // The live drag, mirrored into a ref so mouse-up can read the final size
  // without reaching into a state updater.
  const dragRef = React.useRef(drag)
  React.useEffect(() => {
    dragRef.current = drag
  }, [drag])

  /**
   * Finish a drag: write the size once, then clear.
   *
   * The final size comes from a ref rather than from inside a setState updater,
   * because React may run an updater more than once and that would save twice.
   */
  const endDrag = React.useCallback(() => {
    const d = dragRef.current
    if (d && active) {
      if (d.kind === "col") {
        setSizes((s) => ({ ...s, cols: { ...s.cols, [d.columnId]: d.w } }))
        void m.saveLayout(active.id, { columnWidth: { columnId: d.columnId, width: d.w } })
      } else {
        setSizes((s) => ({ ...s, rows: { ...s.rows, [d.position]: d.h } }))
        void m.saveLayout(active.id, { rowHeight: { position: d.position, height: d.h } })
      }
    }
    setDrag(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  // While a drag is live the WHOLE PAGE takes the resize cursor and stops
  // selecting text - otherwise dragging paints a blue selection across every
  // cell the pointer crosses.
  React.useEffect(() => {
    if (!drag) return
    const prev = document.body.style.cursor
    document.body.style.cursor = drag.kind === "col" ? "col-resize" : "row-resize"
    document.body.style.userSelect = "none"
    return () => {
      document.body.style.cursor = prev
      document.body.style.userSelect = ""
    }
  }, [drag?.kind])

  /**
   * Row position -> the row that exists there.
   *
   * Most positions have no entry, and that is the point: the grid draws
   * TOTAL_ROWS of them and only the typed-in ones are database rows. A missing
   * entry is an empty row, not a missing one.
   */
  const rowByPos = React.useMemo(() => {
    const map = new Map<number, SheetRow>()
    for (const r of active?.rows ?? []) map.set(r.position, r)
    return map
  }, [active])

  /** Everyone on the project, for PERSON columns. */
  const people = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const t of teams?.data ?? []) {
      for (const mem of t.members ?? []) {
        const e = mem.employee
        if (e) map.set(e.id, `${e.firstName} ${e.lastName}`.trim())
      }
      if (t.manager) map.set(t.manager.id, `${t.manager.firstName} ${t.manager.lastName}`.trim())
    }
    return map
  }, [teams])

  // ── Windowing ──────────────────────────────────────────────────────────────
  // A thousand rows by twenty-six columns is 26,000 cells. Rendering them all
  // locks the tab, so only the visible band is in the DOM and two spacer rows
  // stand in for the rest. Row height is fixed, which is what makes the maths
  // trivial and the scrollbar honest.
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = React.useState({ top: 0, left: 0, height: 640 })

  React.useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const measure = () => setScroll((s) => ({ ...s, height: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [active?.id])

  /**
   * Cumulative y of every row: offsets[i] is where row i starts.
   *
   * Rows have their own heights now, so the visible band cannot be found by
   * dividing. A thousand-entry prefix sum is cheap, recomputed only when the
   * heights change, and it also gives the exact spacer sizes below.
   */
  const offsets = React.useMemo(() => {
    const out = new Array<number>(TOTAL_ROWS + 1)
    out[0] = 0
    // heightOf, not the stored map: the row being dragged has to shift the ones
    // below it as the pointer moves, or the grid tears away from the cursor and
    // snaps back on release. A thousand additions per pointermove is nothing.
    for (let i = 0; i < TOTAL_ROWS; i++) out[i + 1] = out[i]! + heightOf(i)
    return out
  }, [heightOf])

  /** First row whose bottom edge is past y. Binary search over the prefix sum. */
  const rowAt = React.useCallback(
    (y: number) => {
      let lo = 0
      let hi = TOTAL_ROWS
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (offsets[mid + 1]! <= y) lo = mid + 1
        else hi = mid
      }
      return Math.min(lo, TOTAL_ROWS - 1)
    },
    [offsets],
  )

  const firstRow = Math.max(0, rowAt(scroll.top) - OVERSCAN)
  const lastRow = Math.min(TOTAL_ROWS, rowAt(scroll.top + scroll.height) + 1 + OVERSCAN)
  const window_ = React.useMemo(
    () => Array.from({ length: Math.max(0, lastRow - firstRow) }, (_, i) => firstRow + i),
    [firstRow, lastRow],
  )

  const cellValue = (pos: number, column: SheetColumn): CellValue => {
    const key = `${pos}:${column.id}`
    if (key in overrides) return overrides[key]!
    return rowByPos.get(pos)?.cells[column.id] ?? null
  }

  const commit = (pos: number, column: SheetColumn, raw: CellValue) => {
    setOverrides((o) => ({ ...o, [`${pos}:${column.id}`]: raw }))
    setEditing(null)
    if (!active) return
    void m.saveCells(active.id, pos, { [column.id]: raw })
    // The row grew to fit the text while it was being typed. Persist that, or
    // the value would be clipped the moment the editor closes and the row
    // sprang back to its stored height.
    const grown = sizes.rows[pos]
    const stored = active.rowHeights?.[String(pos)] ?? ROW_H
    if (grown && grown > stored) {
      void m.saveLayout(active.id, { rowHeight: { position: pos, height: grown } })
    }
  }

  /**
   * Make room for what is being typed.
   *
   * Only ever grows, and only up to the ceiling. Shrinking as you delete would
   * make the whole sheet jump around under the caret, and a row someone
   * deliberately made tall must not be undone by an edit in one of its cells.
   */
  const growRow = React.useCallback((pos: number, px: number) => {
    const wanted = Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, px))
    setSizes((s) => {
      const current = s.rows[pos] ?? 0
      if (wanted <= current) return s
      return { ...s, rows: { ...s.rows, [pos]: wanted } }
    })
  }, [])

  const startEdit = (pos: number, column: SheetColumn, seed?: string) => {
    const v = cellValue(pos, column)
    setEditing({ pos, columnId: column.id })
    // A seed is the character that started the edit: typing over a selected
    // cell REPLACES it, exactly as it does in a spreadsheet.
    setDraft(seed !== undefined ? seed : v === null ? "" : String(v))
  }

  /** Move the cursor, clamped. Also scrolls it back into view. */
  const move = (dr: number, dc: number) => {
    setSelected((sel) => {
      const cur = sel ?? { r: 0, c: 0 }
      const next = {
        r: Math.min(Math.max(0, cur.r + dr), TOTAL_ROWS - 1),
        c: Math.min(Math.max(0, cur.c + dc), Math.max(0, columns.length - 1)),
      }
      const el = scrollerRef.current
      if (el) {
        const top = offsets[next.r]!
        const bottom = offsets[next.r + 1]!
        // +ROW_H for the sticky header, which would otherwise cover the cell
        // the cursor just moved onto.
        if (top < el.scrollTop + ROW_H) el.scrollTop = Math.max(0, top - ROW_H)
        else if (bottom > el.scrollTop + el.clientHeight)
          el.scrollTop = bottom + ROW_H - el.clientHeight
      }
      return next
    })
  }

  /**
   * Find: every cell in the open tab whose text contains the query, in reading
   * order. PERSON cells are matched on the name shown, not the id stored.
   */
  const matches = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    const out: { r: number; c: number }[] = []
    if (!q || !active) return out
    const rows = [...active.rows].sort((a, b) => a.position - b.position)
    for (const row of rows) {
      columns.forEach((col, ci) => {
        const v = row.cells[col.id]
        if (v === null || v === undefined || v === "") return
        const text = col.type === "PERSON" ? (people.get(String(v)) ?? String(v)) : String(v)
        if (text.toLowerCase().includes(q)) out.push({ r: row.position, c: ci })
      })
    }
    return out
  }, [search, active, columns, people])
  const safeMatchIdx = matches.length ? matchIdx % matches.length : 0
  const currentMatch = matches.length ? matches[safeMatchIdx]! : null

  /** Step to the next/previous match: select it and scroll it into view. */
  const jumpToMatch = (dir: 1 | -1) => {
    if (matches.length === 0) return
    const next = (safeMatchIdx + dir + matches.length) % matches.length
    setMatchIdx(next)
    const target = matches[next]!
    setSelected(target)
    const el = scrollerRef.current
    if (el) {
      const top = offsets[target.r]!
      const bottom = offsets[target.r + 1]!
      if (top < el.scrollTop + ROW_H) el.scrollTop = Math.max(0, top - ROW_H)
      else if (bottom > el.scrollTop + el.clientHeight)
        el.scrollTop = bottom + ROW_H - el.clientHeight
    }
  }

  /**
   * The spreadsheet key map, handled on the grid rather than per cell so it
   * works while a cell is merely SELECTED - which is most of the time, and the
   * whole reason arrow keys feel right in a sheet.
   */
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (editing || !selected) return
    const column = columns[selected.c]

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
      case "Tab":
        e.preventDefault()
        return move(0, e.shiftKey ? -1 : 1)
      case "Enter":
      case "F2":
        e.preventDefault()
        if (column && !LIVE_TYPES.has(column.type)) startEdit(selected.r, column)
        return
      case "Backspace":
      case "Delete":
        e.preventDefault()
        if (column) commit(selected.r, column, null)
        return
      default:
        break
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (column && !LIVE_TYPES.has(column.type)) {
        e.preventDefault()
        startEdit(selected.r, column, e.key)
      }
    }
  }

  if (isLoading) return <Skeleton className="mt-4 h-72 rounded-sm" />

  // ── No sheets yet ──────────────────────────────────────────────────────────
  if (!workbooks || workbooks.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={Table2}
          title="No sheets yet."
          description="Build a sheet with whatever tabs and columns this project actually needs - a content calendar, a campaign plan, a tracker. Or import one you already have."
          action={{ label: "New sheet", onClick: () => setNewSheetOpen(true) }}
          secondaryAction={{ label: "Import a spreadsheet", onClick: () => setImportOpen(true) }}
        />
        <NewSheetDialog
          kind="sheet"
          open={newSheetOpen}
          name={newSheetName}
          setName={setNewSheetName}
          pending={m.createWorkbook.isPending}
          onCancel={() => setNewSheetOpen(false)}
          onCreate={() =>
            m.createWorkbook.mutate(
              { name: newSheetName },
              {
                onSuccess: (w) => {
                  setActiveWorkbookId(w.id)
                  setActiveId(w.sheets[0]?.id ?? null)
                  setNewSheetName("")
                  setNewSheetOpen(false)
                },
              },
            )
          }
        />
        {/* The importer creates the sheet itself when there is none (it falls
            back to ALL-TABS into a new sheet), so it works from here - which
            is the whole point: a project with nothing in it is exactly when
            someone has a spreadsheet to bring in. */}
        <SheetImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          projectId={projectId}
          workbook={null}
          sheet={null}
          people={people}
        />
      </div>
    )
  }

  // The table MUST carry its own total width. With table-layout:fixed and an
  // auto width, the browser sizes the table to its container and divides that
  // between the columns, ignoring every <col> - which is why resizing appeared
  // to do nothing at all: the width changed, and nothing read it.
  const totalWidth = GUTTER_W + columns.reduce((sum, c) => sum + widthOf(c), 0)

  /**
   * Where the guide line is drawn, relative to the scroller.
   *
   * Derived from the column/row being dragged plus the size the pointer has
   * asked for, minus how far the grid is scrolled - so the line tracks the
   * pointer even when the grid is scrolled away from the origin.
   */
  const guideLeft =
    drag?.kind === "col"
      ? GUTTER_W +
        columns
          .slice(0, columns.findIndex((c) => c.id === drag.columnId) + 1)
          .reduce((sum, c) => sum + (c.id === drag.columnId ? drag.w : (c.width ?? COL_W)), 0) -
        scroll.left
      : 0
  const guideTop =
    drag?.kind === "row" ? offsets[drag.position]! + drag.h - scroll.top + HEADER_H : 0

  /**
   * Double-click on a column edge fits it to its widest value, which is what
   * Google Sheets does there. Measured off the rendered cells rather than
   * guessed from character counts, so it is right for any font.
   */
  const autofitColumn = (c: SheetColumn, ci: number) => {
    if (!active) return
    const scroller = scrollerRef.current
    if (!scroller) return
    let widest = 0
    scroller.querySelectorAll<HTMLElement>(`[data-col="${c.id}"] [data-measure]`).forEach((el) => {
      widest = Math.max(widest, el.scrollWidth)
    })
    // Padding either side, plus a floor so an empty column stays usable.
    const next = Math.min(MAX_COL_W, Math.max(MIN_COL_W, widest + 24))
    setSizes((s) => ({ ...s, cols: { ...s.cols, [c.id]: next } }))
    void m.saveLayout(active.id, { columnWidth: { columnId: c.id, width: next } })
  }

  const topPad = offsets[firstRow]!
  const bottomPad = offsets[TOTAL_ROWS]! - offsets[lastRow]!

  return (
    <div className="mt-4 space-y-3">
      {/* Level 1: the sheets (workbooks). */}
      <div className="border-border flex flex-wrap items-center gap-1 border-b pb-2">
        {workbooks.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => {
              setActiveWorkbookId(w.id)
              setActiveId(null)
            }}
            title={
              w.assignedTo
                ? `Owned by ${w.assignedTo.firstName} ${w.assignedTo.lastName}`.trim()
                : "Unassigned"
            }
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm transition-colors",
              w.id === workbook?.id
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
            )}
          >
            {w.name}
            {/* Just the face on the chip: enough to see who owns each sheet
                without opening it, and the name is one hover away. */}
            {w.assignedTo && <PersonAvatar person={w.assignedTo} className="h-4 w-4" />}
          </button>
        ))}
        <Button variant="ghost" className="gap-1 px-2" onClick={() => setNewSheetOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New sheet
        </Button>

        <div className="ml-auto flex items-center gap-1">
          {workbook && (
            <>
              <WorkbookAssignee
                projectId={projectId}
                workbook={workbook}
                canStaff={canStaff}
                pending={m.assignWorkbook.isPending}
                onAssign={(employeeId) =>
                  m.assignWorkbook.mutate({ workbookId: workbook.id, employeeId })
                }
              />
              <span className="bg-border mx-1 h-4 w-px" aria-hidden />
            </>
          )}
          <Button
            variant="ghost"
            className="gap-1 px-2"
            onClick={() => setColumnDialog({ column: null })}
            disabled={!active}
          >
            <Plus className="h-3.5 w-3.5" /> Column
          </Button>
          <Button
            variant="ghost"
            className="gap-1 px-2"
            onClick={() => setImportOpen(true)}
            disabled={!active}
            title="Import from a CSV, Excel file or Google Sheet"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          <Button
            variant="ghost"
            className="gap-1 px-2"
            onClick={() => setHistoryOpen(true)}
            disabled={!active}
          >
            <History className="h-3.5 w-3.5" /> History
          </Button>
          {canManage && workbook && (
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-destructive gap-1 px-2"
              onClick={() =>
                setConfirm({ kind: "workbook", id: workbook.id, label: workbook.name })
              }
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete sheet
            </Button>
          )}
        </div>
      </div>

      {/* Level 2: the tabs of the open sheet, the way a workbook shows its
          tabs - plus find, which searches the open tab. */}
      <div className="flex flex-wrap items-center gap-1">
        {(sheets ?? []).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveId(s.id)}
            className={cn(
              "rounded-sm border px-2.5 py-1 text-xs transition-colors",
              s.id === active?.id
                ? "border-primary/40 bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 border-transparent",
            )}
          >
            {s.name}
          </button>
        ))}
        <Button
          variant="ghost"
          className="gap-1 px-2 text-xs"
          onClick={() => setNewTabOpen(true)}
          disabled={!workbook}
        >
          <Plus className="h-3.5 w-3.5" /> New tab
        </Button>
        {canManage && active && (sheets?.length ?? 0) > 1 && (
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-destructive gap-1 px-2 text-xs"
            onClick={() => setConfirm({ kind: "sheet", id: active.id, label: active.name })}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete tab
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setMatchIdx(0)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  jumpToMatch(e.shiftKey ? -1 : 1)
                } else if (e.key === "Escape") {
                  setSearch("")
                }
              }}
              placeholder="Find in this tab…"
              aria-label="Find in this tab"
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
          {search.trim() !== "" && (
            <>
              <span className="text-muted-foreground w-14 text-center text-xs tabular-nums">
                {matches.length ? `${safeMatchIdx + 1} of ${matches.length}` : "0 of 0"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => jumpToMatch(-1)}
                disabled={matches.length === 0}
                title="Previous match (Shift+Enter)"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => jumpToMatch(1)}
                disabled={matches.length === 0}
                title="Next match (Enter)"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {active && (
        /* The grid.
         *
         * Real spreadsheet chrome: a frozen header of column letters, a frozen
         * gutter of row numbers, hairline rules, and a cursor driven by the
         * arrow keys. A <table> underneath, because the browser already solves
         * column alignment; everything visual is here.
         *
         * tabIndex makes the grid focusable, which is what lets the key map work
         * on a SELECTED cell rather than only on one being edited. */
        <div className="relative">
          <div
            ref={scrollerRef}
            tabIndex={0}
            onKeyDown={onGridKeyDown}
            onScroll={(e) => {
              // Read the value NOW, not inside the updater. React nulls a
              // synthetic event's currentTarget once the handler returns, and a
              // functional setState runs after that - so touching e in there
              // throws on every scroll.
              const top = e.currentTarget.scrollTop
              const left = e.currentTarget.scrollLeft
              setScroll((s) => ({ ...s, top, left }))
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
                  {/* Sticky on BOTH axes so the corner stays put when the grid is
                    scrolled diagonally. Backgrounds here are deliberately
                    OPAQUE: a translucent header lets row 1 show through it as
                    it scrolls under, which reads as the header being broken. */}
                  <th
                    className="bg-muted border-border sticky top-0 left-0 z-30 border-r border-b"
                    style={{ height: HEADER_H }}
                  />
                  {columns.map((c, ci) => {
                    // A column still called by its letter is UNNAMED - show just
                    // the letter, as a spreadsheet does. Once it is renamed, the
                    // name leads and the letter stays as the small reference
                    // people say out loud ("what's in C4?").
                    const unnamed = c.name === columnLetter(ci)
                    return (
                      <th
                        key={c.id}
                        className={cn(
                          "bg-muted border-border sticky top-0 z-20 border-r border-b px-0 font-medium",
                          selected?.c === ci && "bg-primary/20",
                        )}
                        style={{ height: HEADER_H }}
                      >
                        {/* NORMAL FLOW, no absolute positioning: a table cell is
                          not a dependable containing block, so an absolutely
                          positioned grip landed somewhere other than its own
                          header. A flex child cannot miss. */}
                        <div className="flex w-full items-stretch" style={{ height: HEADER_H }}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                title={c.name + " - " + COLUMN_TYPE_LABEL[c.type]}
                                className="text-foreground/80 hover:text-foreground group flex h-full min-w-0 flex-1 items-center gap-1.5 px-2"
                              >
                                {unnamed ? (
                                  <span className="mx-auto text-[11px] font-semibold tabular-nums">
                                    {columnLetter(ci)}
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-muted-foreground text-[10px] tabular-nums">
                                      {columnLetter(ci)}
                                    </span>
                                    <span className="truncate text-xs font-medium">{c.name}</span>
                                  </>
                                )}
                                <ChevronDown className="ml-auto h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuLabel className="text-xs">
                                {c.name}
                                <span className="text-muted-foreground ml-1.5 font-normal">
                                  {COLUMN_TYPE_LABEL[c.type]}
                                </span>
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setColumnDialog({ column: c })}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit column
                              </DropdownMenuItem>
                              {/* Manager-only: it discards this column in every row. */}
                              {canManage && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    setConfirm({ kind: "column", id: c.id, label: c.name })
                                  }
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete column
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Grip
                            axis="col"
                            onStart={(e) =>
                              setDrag({
                                kind: "col",
                                columnId: c.id,
                                startX: e.clientX,
                                startW: widthOf(c),
                                w: widthOf(c),
                              })
                            }
                            onMove={(e) =>
                              setDrag((d) =>
                                d?.kind === "col"
                                  ? {
                                      ...d,
                                      w: Math.min(
                                        MAX_COL_W,
                                        Math.max(MIN_COL_W, d.startW + (e.clientX - d.startX)),
                                      ),
                                    }
                                  : d,
                              )
                            }
                            onEnd={endDrag}
                            onReset={() => autofitColumn(c, ci)}
                          />
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {/* Spacers stand in for the rows above and below the window, so
                  the scrollbar reflects all thousand rows. */}
                {topPad > 0 && (
                  <tr aria-hidden>
                    <td colSpan={columns.length + 1} style={{ height: topPad, padding: 0 }} />
                  </tr>
                )}

                {window_.map((pos) => {
                  const row = rowByPos.get(pos)
                  return (
                    <tr key={pos} className="group">
                      <th
                        className={cn(
                          "bg-muted border-border sticky left-0 z-10 border-r border-b px-0 font-normal",
                          selected?.r === pos && "bg-primary/20",
                        )}
                        style={{ height: heightOf(pos) }}
                      >
                        <div className="flex w-full flex-col" style={{ height: heightOf(pos) }}>
                          <span className="text-muted-foreground flex min-h-0 flex-1 items-start justify-center gap-1 pt-1 text-[11px] tabular-nums">
                            {/* The bin only appears where a row actually exists -
                            there is nothing to delete on a row nobody has
                            typed into yet. */}
                            <span className={cn(canManage && row && "group-hover:hidden")}>
                              {pos + 1}
                            </span>
                            {canManage && row && (
                              <button
                                type="button"
                                title={"Delete row " + (pos + 1)}
                                onClick={() =>
                                  setConfirm({ kind: "row", id: row.id, label: "Row " + (pos + 1) })
                                }
                                className="text-muted-foreground hover:text-destructive hidden group-hover:block"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                          <Grip
                            axis="row"
                            onStart={(e) =>
                              setDrag({
                                kind: "row",
                                position: pos,
                                startY: e.clientY,
                                startH: heightOf(pos),
                                h: heightOf(pos),
                              })
                            }
                            onMove={(e) =>
                              setDrag((d) =>
                                d?.kind === "row"
                                  ? {
                                      ...d,
                                      h: Math.min(
                                        MAX_ROW_H,
                                        Math.max(MIN_ROW_H, d.startH + (e.clientY - d.startY)),
                                      ),
                                    }
                                  : d,
                              )
                            }
                            onEnd={endDrag}
                            onReset={() =>
                              active &&
                              void m.saveLayout(active.id, {
                                rowHeight: { position: pos, height: ROW_H },
                              })
                            }
                          />
                        </div>
                      </th>

                      {columns.map((c, ci) => {
                        const isEditing = editing?.pos === pos && editing.columnId === c.id
                        const isSelected = selected?.r === pos && selected.c === ci
                        const isMatch = currentMatch?.r === pos && currentMatch.c === ci
                        return (
                          <td
                            key={c.id}
                            data-col={c.id}
                            onMouseDown={() => setSelected({ r: pos, c: ci })}
                            onDoubleClick={() => !LIVE_TYPES.has(c.type) && startEdit(pos, c)}
                            className={cn(
                              "border-border relative border-r border-b p-0 align-middle",
                              // The cursor sits ON TOP of its neighbours, or the
                              // ring is clipped by the next cell's rule.
                              isSelected && !isEditing && "ring-primary z-10 ring-2",
                              // The find box's current hit, when the cursor is elsewhere.
                              isMatch && !isSelected && "z-10 ring-2 ring-amber-400",
                              isEditing && "z-20",
                            )}
                            style={{ height: heightOf(pos) }}
                          >
                            <CellEditor
                              column={c}
                              value={cellValue(pos, c)}
                              people={people}
                              highlight={search}
                              isEditing={isEditing}
                              draft={draft}
                              setDraft={setDraft}
                              onCommit={(v) => {
                                commit(pos, c, v)
                                setSelected({ r: pos, c: ci })
                              }}
                              onCancel={() => setEditing(null)}
                              onGrow={(px) => growRow(pos, px)}
                              onCommitAndMove={(v, dr, dc) => {
                                commit(pos, c, v)
                                setSelected({
                                  r: Math.min(Math.max(0, pos + dr), TOTAL_ROWS - 1),
                                  c: Math.min(Math.max(0, ci + dc), columns.length - 1),
                                })
                              }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {bottomPad > 0 && (
                  <tr aria-hidden>
                    <td colSpan={columns.length + 1} style={{ height: bottomPad, padding: 0 }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* The guide. Sheets shows where the edge will land rather than
            reflowing 27 columns on every pointer move, and the grid snaps to it
            once on release. */}
          {drag && (
            <div
              aria-hidden
              className="bg-foreground/70 pointer-events-none absolute z-40"
              style={
                drag.kind === "col"
                  ? {
                      top: 0,
                      bottom: 0,
                      width: 2,
                      left: guideLeft,
                    }
                  : { left: 0, right: 0, height: 2, top: guideTop }
              }
            />
          )}
        </div>
      )}

      {/* Dialogs */}
      <NewSheetDialog
        kind="sheet"
        open={newSheetOpen}
        name={newSheetName}
        setName={setNewSheetName}
        pending={m.createWorkbook.isPending}
        onCancel={() => setNewSheetOpen(false)}
        onCreate={() =>
          m.createWorkbook.mutate(
            { name: newSheetName },
            {
              onSuccess: (w) => {
                setActiveWorkbookId(w.id)
                setActiveId(w.sheets[0]?.id ?? null)
                setNewSheetName("")
                setNewSheetOpen(false)
              },
            },
          )
        }
      />
      <NewSheetDialog
        kind="tab"
        open={newTabOpen}
        name={newTabName}
        setName={setNewTabName}
        pending={m.createSheet.isPending}
        onCancel={() => setNewTabOpen(false)}
        onCreate={() => {
          if (!workbook) return
          m.createSheet.mutate(
            { workbookId: workbook.id, name: newTabName },
            {
              onSuccess: (r) => {
                setActiveId(r.data.id)
                setNewTabName("")
                setNewTabOpen(false)
              },
            },
          )
        }}
      />

      <ColumnDialog
        open={columnDialog !== null}
        column={columnDialog?.column ?? null}
        onCancel={() => setColumnDialog(null)}
        onSave={(input) => {
          if (!active) return
          if (columnDialog?.column) {
            m.updateColumn.mutate({
              sheetId: active.id,
              columnId: columnDialog.column.id,
              ...input,
            })
          } else {
            m.addColumn.mutate({ sheetId: active.id, ...input })
          }
          setColumnDialog(null)
        }}
      />

      <SheetImportDialog
        open={importOpen && !!active}
        onOpenChange={setImportOpen}
        projectId={projectId}
        workbook={workbook}
        sheet={active ?? null}
        people={people}
      />
      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        projectId={projectId}
        sheet={active}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === "workbook"
            ? "Delete this sheet?"
            : confirm?.kind === "sheet"
              ? "Delete this tab?"
              : confirm?.kind === "column"
                ? "Delete this column?"
                : "Delete this row?"
        }
        description={
          confirm?.kind === "workbook"
            ? '"' +
              (confirm?.label ?? "") +
              '" and every tab in it - all their columns, rows and history - will be permanently removed.'
            : confirm?.kind === "sheet"
              ? '"' +
                (confirm?.label ?? "") +
                '" and every column, row and history entry in it will be permanently removed.'
              : confirm?.kind === "column"
                ? '"' +
                  (confirm?.label ?? "") +
                  '" will be removed, and its value in every row goes with it. The values are kept in the history.'
                : (confirm?.label ?? "") + " will be removed. Its values are kept in the history."
        }
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === "workbook") {
            m.deleteWorkbook.mutate(confirm.id, {
              onSuccess: () => {
                setActiveWorkbookId(null)
                setActiveId(null)
              },
            })
          } else if (confirm.kind === "sheet") {
            m.deleteSheet.mutate(confirm.id, { onSuccess: () => setActiveId(null) })
          } else if (active && confirm.kind === "column") {
            m.deleteColumn.mutate({ sheetId: active.id, columnId: confirm.id })
          } else if (active) {
            m.deleteRow.mutate({ sheetId: active.id, rowId: confirm.id })
          }
          setConfirm(null)
        }}
      />
    </div>
  )
}

/** Names a new sheet (a workbook of tabs) or a new tab inside the open one. */
function NewSheetDialog({
  kind,
  open,
  name,
  setName,
  pending,
  onCancel,
  onCreate,
}: {
  kind: "sheet" | "tab"
  open: boolean
  name: string
  setName: (v: string) => void
  pending: boolean
  onCancel: () => void
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "sheet" ? "New sheet" : "New tab"}</DialogTitle>
          <DialogDescription>
            {kind === "sheet"
              ? "A sheet holds tabs, like a workbook. It opens with one tab; add more from the tab strip."
              : "A new grid inside this sheet. It starts with columns A to Z - rename them as you go."}
          </DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor="sheet-name" className="mb-1.5 block text-xs font-medium">
            Name
          </label>
          <Input
            id="sheet-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "sheet" ? "Content calendar" : "September 2026"}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onCreate()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={!name.trim()} loading={pending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One cell.
 *
 * SELECT, PERSON and CHECKBOX are always live controls: picking a value IS the
 * commit, so making people click once to focus and again to choose would be a
 * step with nothing in it. Everything else shows its value until clicked.
 */
/**
 * Grows the row to fit what is being typed.
 *
 * A textarea that scrolls inside a fixed cell hides the top of your own
 * sentence while you write it, which is the one thing a text cell must never
 * do. Measuring scrollHeight after each keystroke and asking the row to match
 * means the sheet opens up under the caret instead.
 *
 * useLayoutEffect, not useEffect: the measurement has to happen before the
 * browser paints, or the row visibly lags a character behind the text.
 */
function useAutoGrow(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  active: boolean,
  onGrow: (px: number) => void,
) {
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || !active) return
    // Collapse first: scrollHeight never shrinks on its own, so without this
    // the row could only ever get taller, never recover from a deletion.
    el.style.height = "0px"
    const needed = el.scrollHeight
    el.style.height = "100%"
    onGrow(needed + 2)
  }, [ref, value, active, onGrow])
}

function CellEditor({
  column,
  value,
  people,
  isEditing,
  draft,
  setDraft,
  onCommit,
  onCancel,
  onCommitAndMove,
  onGrow,
  highlight,
}: {
  column: SheetColumn
  value: CellValue
  people: Map<string, string>
  /** The find query - its hits are highlighted in the displayed value. */
  highlight?: string
  isEditing: boolean
  draft: string
  setDraft: (v: string) => void
  onCommit: (v: CellValue) => void
  onCancel: () => void
  /** Commit, then step the cursor - Enter goes down, Tab goes right. */
  onCommitAndMove: (v: CellValue, dr: number, dc: number) => void
  /** How tall this cell's content needs the row to be, as it is typed. */
  onGrow: (px: number) => void
}) {
  const areaRef = React.useRef<HTMLTextAreaElement>(null)
  const isTextish = column.type === "TEXT" || column.type === "LONG_TEXT" || column.type === "URL"
  useAutoGrow(areaRef, draft, isEditing && isTextish, onGrow)

  if (column.type === "CHECKBOX") {
    return (
      <div className="flex h-full items-center justify-center">
        <Checkbox
          checked={value === true}
          onCheckedChange={(c) => onCommit(c === true)}
          aria-label={column.name}
        />
      </div>
    )
  }

  if (column.type === "SELECT" || column.type === "PERSON") {
    const choices =
      column.type === "SELECT"
        ? column.options.map((o) => ({ value: o, label: o }))
        : [...people.entries()].map(([id, label]) => ({ value: id, label }))
    // A SELECT with no choices yet would render an unopenable dropdown, which
    // reads as broken rather than as unconfigured.
    if (choices.length === 0) {
      return (
        <span className="text-muted-foreground/50 flex h-full items-center px-2 text-[11px]">
          {column.type === "SELECT" ? "No choices set" : "No one on the project"}
        </span>
      )
    }
    return (
      <Select
        value={value === null ? "" : String(value)}
        onValueChange={(v) => onCommit(v === "__clear__" ? null : v)}
      >
        <SelectTrigger className="h-full w-full rounded-none border-0 bg-transparent px-2 text-[13px] shadow-none focus:ring-0">
          <SelectValue placeholder={PLACEHOLDER} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__">
            <span className="text-muted-foreground">Clear</span>
          </SelectItem>
          {choices.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (!isEditing) {
    return (
      /* Wraps and clips to the ROW's height, which is what a spreadsheet does:
         the whole value is stored, you see as much of it as the row is tall,
         and dragging the row taller shows more. Top-aligned so the first line
         is always the one you see. */
      <div
        data-measure
        className="h-full overflow-hidden px-2 py-1 leading-snug break-words whitespace-pre-wrap"
      >
        <DisplayCell column={column} value={value} people={people} highlight={highlight} />
      </div>
    )
  }

  const value_ = () => (draft.trim() === "" ? null : draft)
  const commitDraft = () => onCommit(value_())
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
      return
    }
    if (e.key === "Tab") {
      // Commit and step sideways, which is how a row gets filled in quickly.
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

  // Every free-text type edits in a TEXTAREA, not just LONG_TEXT. A single-line
  // input scrolls sideways as you type and only appears to wrap once the value
  // is committed and re-rendered - which is exactly the "it wraps afterwards"
  // problem. A textarea wraps under the caret.
  if (column.type === "TEXT" || column.type === "LONG_TEXT" || column.type === "URL") {
    return (
      /* Fills the cell rather than floating over its neighbours: rows are
         draggable now, so the answer to "I cannot see what I am typing" is a
         taller row, not a popover that hides the rest of the sheet. */
      <Textarea
        ref={areaRef}
        wrap="soft"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={keys}
        // overflow-hidden, not auto: the ROW grows to fit, so an inner
        // scrollbar would only ever appear at the 400px ceiling - and one that
        // shows up unpredictably is worse than one that never does.
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
      onBlur={commitDraft}
      onKeyDown={keys}
      className="ring-primary h-full w-full rounded-none border-0 px-2 py-1 text-[13px] shadow-none ring-2 focus-visible:ring-2"
    />
  )
}
