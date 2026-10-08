"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
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
  Eye,
  EyeOff,
} from "lucide-react"
import { SheetImportDialog } from "./sheet-import-dialog"

import { useMeasuredRowHeights } from "@/hooks/use-measured-row-heights"
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
import {
  useSheetHistory,
  useSheetMutations,
  useWorkbook,
  useWorkbookIndex,
} from "../hooks/use-sheets"
import {
  currentMonth,
  editionIndexForMonth,
  monthISO,
  groupIntoSeries,
  parseMonth,
  type YearMonth,
} from "../lib/calendar-months"
import { CalendarMonthPicker, CalendarNamePicker } from "./calendar/calendar-picker"
import { NewMonthDialog, SetMonthDialog } from "./calendar/month-dialogs"
import { TeamPlanStrip } from "./calendar/team-plan-strip"
import { TeamPlanSheet } from "./calendar/team-plan-sheet"
import {
  COLUMN_TYPE_HINT,
  COLUMN_TYPE_LABEL,
  columnLetter,
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
  type WorkbookIndexEntry,
} from "../lib/sheet-types"

// Anyone on the project may edit; only the account manager or an admin may delete (those controls
// aren't rendered for others). Every edit is recorded, which is what makes open editing safe.

const PLACEHOLDER = ""

/** Three lines of body text tall - the smallest size that behaves like a field you can write in. */
const ROW_H = 64
const COL_W = 220
const GUTTER_W = 44
const HEADER_H = 30
/** Every row is live: typing in row 700 creates it; untouched rows aren't database rows. */
const TOTAL_ROWS = 1000
/** Rows rendered above and below the visible band, to hide fast scrolling. */
const OVERSCAN = 8

/** Types whose control IS the editor - Enter or a printable key must not try to "open" them. */
const LIVE_TYPES = new Set<SheetColumnType>(["SELECT", "PERSON", "CHECKBOX"])

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

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

function DisplayCell({
  column,
  value,
  people,
  highlight,
}: {
  column: SheetColumn
  value: CellValue
  people: Map<string, string>
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
    // Falls back to the stored id when the person has left the project.
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

  const [prevOpen, setPrevOpen] = React.useState(false)
  const [prevColumn, setPrevColumn] = React.useState(column)
  if (open !== prevOpen || column !== prevColumn) {
    setPrevOpen(open)
    setPrevColumn(column)
    if (open) {
      setName(column?.name ?? "")
      setType(column?.type ?? "TEXT")
      setOptions((column?.options ?? []).join("\n"))
    }
  }

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

/** Pointer capture, not window listeners; normal flow, as an absolute grip mislands in a table cell. */
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
  onReset: () => void
}) {
  const [dragging, setDragging] = React.useState(false)
  return (
    <span
      role="separator"
      aria-orientation={axis === "col" ? "vertical" : "horizontal"}
      title="Drag to resize, double-click to reset"
      onPointerDown={(e) => {
        // Left button only, so right-click still opens the browser menu.
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

function AssigneeChip({ person }: { person: SheetAssignee | null }) {
  if (!person) return <span className="text-muted-foreground text-xs">No manager</span>
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

/** The calendar manager: one person answering for the month; managers can pick any active employee. */
function WorkbookAssignee({
  projectId,
  workbook,
  canStaff,
  onAssign,
  pending,
}: {
  projectId: string
  workbook: { assignedTo: SheetAssignee | null }
  canStaff: boolean
  onAssign: (employeeId: string | null) => void
  pending: boolean
}) {
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
      {/* Custom trigger content: shows the avatar, and still works if the owner was deactivated. */}
      <SelectTrigger
        className="hover:bg-foreground/5 h-8 w-auto gap-1.5 border-transparent bg-transparent px-2"
        title="Who manages this calendar"
      >
        <AssigneeChip person={workbook.assignedTo} />
      </SelectTrigger>
      <SelectContent align="end" className="max-h-72">
        <SelectItem value={UNASSIGNED}>
          <span className="text-muted-foreground text-xs">No manager</span>
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
  // Two reads: a cheap index of every calendar and month, and the open month's detail.
  const qc = useQueryClient()
  const { data: index, isLoading } = useWorkbookIndex(projectId)
  const { data: teams } = useProjectTeams(projectId)
  const m = useSheetMutations(projectId)
  // Assigning follows the staffing rule, not the delete rule.
  const { data: session } = useSession()
  const me = session?.user?.id ?? null
  const projectTeams = React.useMemo(() => teams?.data ?? [], [teams])
  const managedTeamId = React.useMemo(
    () => projectTeams.find((t) => t.managerId != null && t.managerId === me)?.id ?? null,
    [projectTeams, me],
  )
  const canStaff = canManage || managedTeamId !== null
  /** The one team this person is on, only when unambiguous. */
  const myTeamId = React.useMemo(() => {
    if (!me) return null
    const mine = projectTeams.filter((t) => t.members.some((mm) => mm.employeeId === me))
    return mine.length === 1 ? mine[0]!.id : (managedTeamId ?? null)
  }, [projectTeams, me, managedTeamId])

  const series = React.useMemo(() => groupIntoSeries(index ?? []), [index])
  const [seriesName, setSeriesName] = React.useState<string | null>(null)
  /** The month asked for, which may not exist; null = whatever this calendar opens on. */
  const [requestedMonth, setRequestedMonth] = React.useState<YearMonth | null>(null)

  const activeSeries = React.useMemo(
    () => series.find((x) => x.name === seriesName) ?? series[0] ?? null,
    [series, seriesName],
  )

  /** Derived, not stored, so the name, month and id can't disagree. */
  const entry = React.useMemo<WorkbookIndexEntry | null>(() => {
    if (!activeSeries) return null
    const at = editionIndexForMonth(activeSeries, requestedMonth)
    if (at >= 0) return activeSeries.editions[at]!
    // The requested month has no edition here (e.g. after switching calendars): use the newest.
    return activeSeries.editions[0] ?? null
  }, [activeSeries, requestedMonth])

  const month = React.useMemo(() => parseMonth(entry?.periodMonth), [entry])

  const { data: workbook, isLoading: bookLoading } = useWorkbook(projectId, entry?.id ?? null)
  const sheets = React.useMemo(() => workbook?.sheets, [workbook])

  const [planOpen, setPlanOpen] = React.useState(false)
  const [planFocusTeamId, setPlanFocusTeamId] = React.useState<string | null>(null)
  const [newMonthOpen, setNewMonthOpen] = React.useState(false)
  const [setMonthOpen, setSetMonthOpen] = React.useState(false)

  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<CellRef | null>(null)
  /** Row position + column index; a sheet has a cursor even when nothing is being typed. */
  const [selected, setSelected] = React.useState<{ r: number; c: number } | null>(null)
  const [draft, setDraft] = React.useState("")

  /** Declared here, not beside the month state: it uses setActiveId, and reading a later binding is a TDZ error. */
  const openEdition = React.useCallback(
    (workbookId: string) => {
      const found = (index ?? []).find((w) => w.id === workbookId)
      if (!found) return
      setSeriesName(found.name)
      setRequestedMonth(parseMonth(found.periodMonth))
      // The tab resets: the tab ids belong to the month being left.
      setActiveId(null)
    },
    [index],
  )
  // Committed-but-not-yet-refetched values, keyed "position:columnId".
  const [overrides, setOverrides] = React.useState<Record<string, CellValue>>({})
  /** Committed sizes not yet echoed back; saveLayout doesn't refetch, so without this a resize would snap back. */
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
  const [importIntent, setImportIntent] = React.useState<"new-tab" | "new-sheet" | undefined>()
  /** New month handed off to the importer, which creates the month itself - backing out leaves nothing behind. */
  const [monthUpload, setMonthUpload] = React.useState<{
    name: string
    periodMonth: string
    copyFrom: { workbookId: string; teamPlan: boolean } | null
  } | null>(null)
  const [newTabOpen, setNewTabOpen] = React.useState(false)
  const [newTabName, setNewTabName] = React.useState("")
  // `matchIdx` is unbounded and wrapped at use, so a new query needs no reset effect.
  const [search, setSearch] = React.useState("")
  const [matchIdx, setMatchIdx] = React.useState(0)
  const [confirm, setConfirm] = React.useState<{
    kind: "workbook" | "sheet" | "row" | "column"
    id: string
    label: string
  } | null>(null)
  /** The live drag, kept apart from the server copy; written once on mouse-up. */
  const [drag, setDrag] = React.useState<
    | { kind: "col"; columnId: string; startX: number; startW: number; w: number }
    | { kind: "row"; position: number; startY: number; startH: number; h: number }
    | null
  >(null)

  // Fresh server data supersedes local overrides; the cell being typed keeps its `draft`.
  const [prevSheets, setPrevSheets] = React.useState(sheets)
  if (sheets !== prevSheets) {
    setPrevSheets(sheets)
    setOverrides({})
    setSizes({ cols: {}, rows: {} })
  }

  const active = React.useMemo(
    () => sheets?.find((s) => s.id === activeId) ?? sheets?.[0] ?? null,
    [sheets, activeId],
  )

  const columns = React.useMemo(() => active?.columns ?? [], [active])

  /** Committed sizes, not the live drag: like Google Sheets, a guide line shows and the grid snaps on release. */
  const widthOf = (c: SheetColumn) => sizes.cols[c.id] ?? c.width ?? COL_W

  const heightOf = React.useCallback(
    (pos: number) => sizes.rows[pos] ?? active?.rowHeights?.[String(pos)] ?? ROW_H,
    [active, sizes],
  )

  // Mirrored into a ref so mouse-up reads the final size outside a state updater.
  const dragRef = React.useRef(drag)
  React.useEffect(() => {
    dragRef.current = drag
  }, [drag])

  /** Reads the final size from a ref: React may run an updater twice, which would save twice. */
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

  // While dragging, the whole page takes the resize cursor and stops selecting text.
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

  /** Most positions have no entry - only typed-in rows exist in the database. */
  const rowByPos = React.useMemo(() => {
    const map = new Map<number, SheetRow>()
    for (const r of active?.rows ?? []) map.set(r.position, r)
    return map
  }, [active])

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

  // Windowing: only the visible band is in the DOM, sized from each row's MEASURED height (rows grow to fit text).
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

  /** Real on-screen row heights (stored, or grown around wrapped text); drives the windowing. */
  const extentOf = useMeasuredRowHeights(scrollerRef, heightOf, active?.id ?? "")

  /** offsets[i] is where row i starts (a prefix sum, since rows have their own heights). */
  const offsets = React.useMemo(() => {
    const out = new Array<number>(TOTAL_ROWS + 1)
    out[0] = 0
    for (let i = 0; i < TOTAL_ROWS; i++) out[i + 1] = out[i]! + extentOf(i)
    return out
  }, [extentOf])

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
    // Persist the growth from typing, or the row would spring back when the editor closes.
    const grown = sizes.rows[pos]
    const stored = active.rowHeights?.[String(pos)] ?? ROW_H
    if (grown && grown > stored) {
      void m.saveLayout(active.id, { rowHeight: { position: pos, height: grown } })
    }
  }

  /** Only ever grows (up to the ceiling), so the sheet doesn't jump under the caret. */
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
    // A seed (the key that started the edit) replaces the value, as in a spreadsheet.
    setDraft(seed !== undefined ? seed : v === null ? "" : String(v))
  }

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
        // +ROW_H for the sticky header, which would otherwise cover the cell.
        if (top < el.scrollTop + ROW_H) el.scrollTop = Math.max(0, top - ROW_H)
        else if (bottom > el.scrollTop + el.clientHeight)
          el.scrollTop = bottom + ROW_H - el.clientHeight
      }
      return next
    })
  }

  /** Cells matching the query, in reading order; PERSON cells match on the shown name. */
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

  /** Key map on the grid, not per cell, so it works on a merely selected cell. */
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

  if (!index || index.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={Table2}
          title="No calendars yet."
          description="Build a calendar with whatever tabs and columns this project actually needs - a content calendar, a campaign plan, a tracker. Or import one you already have."
          action={{ label: "New calendar", onClick: () => setNewSheetOpen(true) }}
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
              {
                name: newSheetName,
                periodMonth: monthISO(currentMonth().year, currentMonth().month0),
              },
              {
                onSuccess: (w) => {
                  openEdition(w.id)
                  setActiveId(w.sheets[0]?.id ?? null)
                  setNewSheetName("")
                  setNewSheetOpen(false)
                },
              },
            )
          }
        />
        {/* The importer creates the sheet itself when there is none. */}
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

  // The table must carry its total width: with table-layout:fixed and auto width, <col> widths are ignored.
  const totalWidth = GUTTER_W + columns.reduce((sum, c) => sum + widthOf(c), 0)

  /** Guide line position, minus the scroll offset so it tracks the pointer. */
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

  /** Double-click fits the column to its widest rendered value, like Google Sheets. */
  const autofitColumn = (c: SheetColumn, ci: number) => {
    if (!active) return
    const scroller = scrollerRef.current
    if (!scroller) return
    let widest = 0
    scroller.querySelectorAll<HTMLElement>(`[data-col="${c.id}"] [data-measure]`).forEach((el) => {
      widest = Math.max(widest, el.scrollWidth)
    })
    const next = Math.min(MAX_COL_W, Math.max(MIN_COL_W, widest + 24))
    setSizes((s) => ({ ...s, cols: { ...s.cols, [c.id]: next } }))
    void m.saveLayout(active.id, { columnWidth: { columnId: c.id, width: next } })
  }

  const topPad = offsets[firstRow]!
  const bottomPad = offsets[TOTAL_ROWS]! - offsets[lastRow]!

  return (
    <div className="mt-4 space-y-3">
      <div className="border-border flex flex-wrap items-center gap-1 border-b pb-2">
        <CalendarNamePicker
          series={series}
          activeName={activeSeries?.name ?? null}
          onPick={(name) => {
            // Keep the month when switching calendars; `entry` falls back to the newest if it doesn't exist.
            setSeriesName(name)
            setActiveId(null)
          }}
        />
        <CalendarMonthPicker
          series={activeSeries}
          month={month}
          onPickEdition={openEdition}
          onNewMonth={() => setNewMonthOpen(true)}
          onSetMonth={() => setSetMonthOpen(true)}
          canCreate={canStaff}
        />
        <Button variant="ghost" className="gap-1 px-2" onClick={() => setNewSheetOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New calendar
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
              {/* Managers only: this decides whether an outside party can read and write the sheet. */}
              {canManage && (
                <Button
                  variant={workbook.isClientVisible ? "secondary" : "ghost"}
                  className="gap-1 px-2"
                  disabled={m.shareWorkbook.isPending}
                  title={
                    workbook.isClientVisible
                      ? "Shared with the client - they can fill cells and add rows. Click to withdraw."
                      : "Share this calendar with the client so they can fill it in"
                  }
                  onClick={() =>
                    m.shareWorkbook.mutate({
                      workbookId: workbook.id,
                      isClientVisible: !workbook.isClientVisible,
                    })
                  }
                >
                  {workbook.isClientVisible ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  {workbook.isClientVisible ? "Shared" : "Share"}
                </Button>
              )}
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

      {workbook && (
        <TeamPlanStrip
          teams={workbook.teams}
          periodMonth={workbook.periodMonth}
          myTeamId={myTeamId}
          canPlan={canStaff}
          onOpen={(teamId) => {
            setPlanFocusTeamId(teamId ?? null)
            setPlanOpen(true)
          }}
        />
      )}

      <div className="flex items-center gap-1">
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {(sheets ?? []).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              className={cn(
                "shrink-0 rounded-sm border px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
                s.id === active?.id
                  ? "border-primary/40 bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 border-transparent",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          className="shrink-0 gap-1 px-2 text-xs"
          onClick={() => setNewTabOpen(true)}
          disabled={!workbook}
        >
          <Plus className="h-3.5 w-3.5" /> New tab
        </Button>
        {canManage && active && (sheets?.length ?? 0) > 1 && (
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-destructive shrink-0 gap-1 px-2 text-xs"
            onClick={() => setConfirm({ kind: "sheet", id: active.id, label: active.name })}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete tab
          </Button>
        )}

        <div className="flex shrink-0 items-center gap-1">
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

      {/* A skeleton while the next month loads, so the old grid never sits under the new label. */}
      {bookLoading && !active && <Skeleton className="h-72 rounded-sm" />}

      {active && (
        /* tabIndex makes the grid focusable, so the key map works on a selected cell. */
        <div className="relative">
          <div
            ref={scrollerRef}
            tabIndex={0}
            onKeyDown={onGridKeyDown}
            onScroll={(e) => {
              // Read now: React nulls currentTarget once the handler returns, before the updater runs.
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
                  {/* Sticky on both axes; opaque so row 1 doesn't show through as it scrolls under. */}
                  <th
                    className="bg-muted border-border sticky top-0 left-0 z-30 border-r border-b"
                    style={{ height: HEADER_H }}
                  />
                  {columns.map((c, ci) => {
                    // A column still named by its letter is unnamed: show just the letter.
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
                {topPad > 0 && (
                  <tr aria-hidden>
                    <td colSpan={columns.length + 1} style={{ height: topPad, padding: 0 }} />
                  </tr>
                )}

                {window_.map((pos) => {
                  const row = rowByPos.get(pos)
                  return (
                    <tr key={pos} data-row-pos={pos} className="group">
                      <th
                        className={cn(
                          "bg-muted border-border sticky left-0 z-10 border-r border-b px-0 font-normal",
                          selected?.r === pos && "bg-primary/20",
                        )}
                        style={{ height: heightOf(pos) }}
                      >
                        <div className="flex w-full flex-col" style={{ height: heightOf(pos) }}>
                          <span className="text-muted-foreground flex min-h-0 flex-1 items-start justify-center gap-1 pt-1 text-[11px] tabular-nums">
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
                                startH: extentOf(pos),
                                h: extentOf(pos),
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
                              // Raised so the next cell's rule doesn't clip the ring.
                              isSelected && !isEditing && "ring-primary z-10 ring-2",
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

      <NewSheetDialog
        kind="sheet"
        open={newSheetOpen}
        name={newSheetName}
        setName={setNewSheetName}
        pending={m.createWorkbook.isPending}
        onCancel={() => setNewSheetOpen(false)}
        onUpload={() => {
          setNewSheetOpen(false)
          setImportIntent("new-sheet")
          setImportOpen(true)
        }}
        onCreate={() =>
          m.createWorkbook.mutate(
            {
              name: newSheetName,
              // Dated from birth, so the month stepper works immediately.
              periodMonth: monthISO(currentMonth().year, currentMonth().month0),
            },
            {
              onSuccess: (w) => {
                openEdition(w.id)
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
        onUpload={() => {
          setNewTabOpen(false)
          setImportIntent("new-tab")
          setImportOpen(true)
        }}
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
        // A month-upload has no active tab yet - its month doesn't exist until the file is read.
        open={importOpen && (importIntent === "new-sheet" || !!monthUpload || !!active)}
        onOpenChange={(o) => {
          setImportOpen(o)
          if (!o) {
            setImportIntent(undefined)
            setMonthUpload(null)
          }
        }}
        projectId={projectId}
        workbook={workbook ?? null}
        sheet={active ?? null}
        people={people}
        intent={importIntent}
        createAs={monthUpload ?? undefined}
        onCreated={openEdition}
      />
      {workbook && (
        <TeamPlanSheet
          open={planOpen}
          onOpenChange={(o) => {
            setPlanOpen(o)
            if (!o) setPlanFocusTeamId(null)
          }}
          projectId={projectId}
          workbook={workbook}
          projectTeams={projectTeams}
          canPlanAll={canManage || workbook.assignedTo?.id === me}
          managedTeamId={managedTeamId}
          myTeamId={myTeamId}
          focusTeamId={planFocusTeamId}
          pending={m.saveTeamPlan.isPending || m.removeTeamPlan.isPending}
          onSave={({ teamId, ...rest }) =>
            m.saveTeamPlan.mutate({ workbookId: workbook.id, teamId, ...rest })
          }
          onRemove={(teamId) => m.removeTeamPlan.mutate({ workbookId: workbook.id, teamId })}
          // An upload writes a ProjectResource, so the usual mutation invalidation doesn't fire.
          onFilesChanged={() =>
            void qc.invalidateQueries({ queryKey: ["project-workbook", projectId] })
          }
        />
      )}

      <NewMonthDialog
        open={newMonthOpen}
        onOpenChange={setNewMonthOpen}
        series={activeSeries}
        pending={m.createWorkbook.isPending}
        onCreate={(input) =>
          m.createWorkbook.mutate(input, {
            onSuccess: (w) => {
              openEdition(w.id)
              setNewMonthOpen(false)
            },
          })
        }
        onUpload={(input) => {
          setNewMonthOpen(false)
          setImportIntent(undefined)
          setMonthUpload(input)
          setImportOpen(true)
        }}
      />

      <SetMonthDialog
        open={setMonthOpen}
        onOpenChange={setSetMonthOpen}
        workbook={entry}
        series={activeSeries}
        pending={m.setWorkbookMonth.isPending}
        onSave={(periodMonth) => {
          if (!entry) return
          m.setWorkbookMonth.mutate(
            { workbookId: entry.id, periodMonth },
            { onSuccess: () => setSetMonthOpen(false) },
          )
        }}
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
                // The open month is gone: back to what's left of this calendar, or the first calendar.
                setRequestedMonth(null)
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

function NewSheetDialog({
  kind,
  open,
  name,
  setName,
  pending,
  onCancel,
  onCreate,
  onUpload,
}: {
  kind: "sheet" | "tab"
  open: boolean
  name: string
  setName: (v: string) => void
  pending: boolean
  onCancel: () => void
  onCreate: () => void
  onUpload?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "sheet" ? "New sheet" : "New tab"}</DialogTitle>
          <DialogDescription>
            {kind === "sheet"
              ? "A sheet holds tabs, like a workbook. Name it to start empty, or build it from a file you already have."
              : "A new grid inside this sheet. Name it to start empty, or bring one in from a file."}
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
        <DialogFooter className={onUpload ? "sm:justify-between" : undefined}>
          {onUpload && (
            <Button variant="ghost" className="text-muted-foreground gap-1.5" onClick={onUpload}>
              <Upload className="h-3.5 w-3.5" /> Upload a sheet instead
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={!name.trim()} loading={pending}>
              Create
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Grows the row to fit typed text; a layout effect so it measures before paint. */
function useAutoGrow(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  active: boolean,
  onGrow: (px: number) => void,
) {
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || !active) return
    // Collapse first: scrollHeight never shrinks on its own.
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
  highlight?: string
  isEditing: boolean
  draft: string
  setDraft: (v: string) => void
  onCommit: (v: CellValue) => void
  onCancel: () => void
  onCommitAndMove: (v: CellValue, dr: number, dc: number) => void
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
    // A SELECT with no choices would be an unopenable dropdown.
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

  // All free-text types edit in a textarea, so text wraps under the caret.
  if (column.type === "TEXT" || column.type === "LONG_TEXT" || column.type === "URL") {
    return (
      <Textarea
        ref={areaRef}
        wrap="soft"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={keys}
        // overflow-hidden: the row grows to fit, so an inner scrollbar would only appear at the ceiling.
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
