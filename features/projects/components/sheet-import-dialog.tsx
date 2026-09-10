"use client"

import { useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { FileSpreadsheet, FolderPlus, Layers, Link2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiFetch } from "@/lib/api-fetch"
import { toastError } from "@/lib/error-message"
import { cn } from "@/lib/utils"
import { useProjectDrive } from "../hooks/use-project-drive"
import { useSheetMutations } from "../hooks/use-sheets"
import {
  COLUMN_TYPE_LABEL,
  type ProjectSheet,
  type SheetColumn,
  type SheetColumnType,
  type SheetWorkbook,
} from "../lib/sheet-types"

// =============================================================================
// Import rows into project sheets from a CSV / Excel file or a Google Sheet.
//
// Everything is parsed in the browser (xlsx handles all three; a Google Sheet
// is first exported to .xlsx by the server). Two modes:
//   • ALL TABS  - every workbook tab becomes a TAB inside one sheet (the open
//                 one, or a new sheet named after the file), with the tab's
//                 headers as its columns. The default for a multi-tab file,
//                 because a calendar workbook IS its tabs.
//   • ONE TAB   - a chosen tab is mapped column-by-column into the open tab,
//                 with a preview.
// Rows are appended in batches through the same normaliser a typed edit uses.
// =============================================================================

type Raw = string | number | boolean | Date | null
interface Tab {
  name: string
  rows: Raw[][]
}
type Mode = "all" | "one"
/** Where the caller came from - see the `intent` prop. */
type Intent = "new-tab" | "new-sheet"
type Target = "current" | "new"

const SKIP = "__skip"
const NEW = "__new"
const MAX_ROWS = 2000
const BATCH = 200
const JSON_HEADERS = { "Content-Type": "application/json" }

/** 0 -> A, 25 -> Z, 26 -> AA. Same as the grid's. */
function columnLetter(index: number): string {
  let n = index
  let out = ""
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** A default column the team has not named yet - fair game for an imported header. */
const isPlaceholder = (c: SheetColumn) =>
  c.name.trim() === "" || c.name.trim().toUpperCase() === columnLetter(c.position)

const normalise = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

async function parseWorkbook(buf: ArrayBuffer): Promise<Tab[]> {
  const XLSX = await import("xlsx")
  const wb = XLSX.read(buf, { type: "array", cellDates: true })
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const rows = ws
      ? XLSX.utils.sheet_to_json<Raw[]>(ws, {
          header: 1,
          raw: true,
          defval: null,
          blankrows: false,
        })
      : []
    return { name, rows: rows.map((r) => (Array.isArray(r) ? r : [])) }
  }).filter((t) => t.rows.length > 0)
}

const pad = (n: number) => String(n).padStart(2, "0")
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Dates arrive as Date objects (xlsx with cellDates), "2026-03-01", or
 *  "01/03/2026" - day first, this app is en-GB. */
function toIsoDate(v: Raw): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : isoDate(v)
  if (v === null || v === "" || typeof v === "boolean") return null
  const s = String(v).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return null // a bare number is not a date
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!
    return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : isoDate(d)
}

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "x", "✓", "done", "ticked", "checked"])
const FALSE_WORDS = new Set(["false", "no", "n", "0", "-"])

interface PeopleIndex {
  byId: Map<string, string>
  byName: Map<string, string>
}

/** One file value into what the column type stores; `issue` when it could not be. */
function coerce(
  type: SheetColumnType,
  raw: Raw,
  people: PeopleIndex,
): { value: string | number | boolean | null; issue?: string } {
  if (raw === null || raw === undefined) return { value: null }
  // A Date landing in a text-ish column reads better as a date than as
  // "Tue Mar 01 2026 00:00:00 GMT…".
  const v: Raw = raw instanceof Date && type !== "DATE" ? isoDate(raw) : raw
  switch (type) {
    case "NUMBER": {
      if (typeof v === "number") return { value: v }
      const n = Number(String(v).replace(/[,\s₹$€£%]/g, ""))
      return Number.isFinite(n) && String(v).trim() !== ""
        ? { value: n }
        : { value: null, issue: "number" }
    }
    case "CHECKBOX": {
      if (typeof v === "boolean") return { value: v }
      const s = String(v).trim().toLowerCase()
      if (s === "") return { value: null }
      if (TRUE_WORDS.has(s)) return { value: true }
      if (FALSE_WORDS.has(s)) return { value: false }
      return { value: null, issue: "checkbox" }
    }
    case "DATE": {
      const d = toIsoDate(v)
      return d ? { value: d } : { value: null, issue: "date" }
    }
    case "PERSON": {
      const s = String(v).trim()
      if (!s) return { value: null }
      if (people.byId.has(s)) return { value: s }
      const id = people.byName.get(normalise(s))
      return id ? { value: id } : { value: s, issue: "person" }
    }
    default: {
      const s = typeof v === "string" ? v : String(v)
      return { value: s.trim() === "" ? null : s }
    }
  }
}

/** For a column created or claimed by the import: what the values look like. */
function guessType(samples: Raw[]): SheetColumnType {
  const vals = samples.filter((s) => s !== null && s !== "")
  if (vals.length === 0) return "TEXT"
  if (vals.every((s) => s instanceof Date || (typeof s === "string" && toIsoDate(s) !== null)))
    return "DATE"
  if (
    vals.every(
      (s) =>
        typeof s === "number" ||
        (typeof s === "string" &&
          s.trim() !== "" &&
          Number.isFinite(Number(s.replace(/[,\s]/g, "")))),
    )
  )
    return "NUMBER"
  if (
    vals.every(
      (s) =>
        typeof s === "boolean" ||
        (typeof s === "string" &&
          (TRUE_WORDS.has(s.toLowerCase()) || FALSE_WORDS.has(s.toLowerCase()))),
    )
  )
    return "CHECKBOX"
  if (vals.every((s) => typeof s === "string" && /^https?:\/\//i.test(s))) return "URL"
  return vals.some((s) => typeof s === "string" && s.length > 80) ? "LONG_TEXT" : "TEXT"
}

/** Google Sheets URL or bare id -> file id. */
function driveIdFrom(input: string): string | null {
  const s = input.trim()
  const m = s.match(/\/spreadsheets\/d\/([\w-]+)/)
  if (m) return m[1]!
  return /^[\w-]{20,}$/.test(s) ? s : null
}

/** A tab's header row and data rows, given the header setting. */
function split(tab: Tab, hasHeader: boolean): { headers: Raw[]; rows: Raw[][] } {
  const width = tab.rows.reduce((w, r) => Math.max(w, r.length), 0)
  const headers = Array.from({ length: width }, (_, i) =>
    hasHeader ? (tab.rows[0]?.[i] ?? `Column ${i + 1}`) : `Column ${i + 1}`,
  )
  return { headers, rows: hasHeader ? tab.rows.slice(1) : tab.rows }
}

/**
 * Default mapping: a header that matches a sheet column by name goes there;
 * anything else takes the next unnamed default column (A, B, C…) and will
 * rename it; once those run out, a new column is created.
 */
function autoMap(headers: Raw[], columns: SheetColumn[]): Record<number, string> {
  const used = new Set<string>()
  const map: Record<number, string> = {}
  const byName = new Map(
    columns.filter((c) => !isPlaceholder(c)).map((c) => [normalise(c.name), c.id]),
  )
  headers.forEach((h, i) => {
    const id = byName.get(normalise(h))
    if (id && !used.has(id)) {
      map[i] = id
      used.add(id)
    }
  })
  const spare = columns
    .filter((c) => isPlaceholder(c) && !used.has(c.id))
    .sort((a, b) => a.position - b.position)
  headers.forEach((_, i) => {
    if (map[i]) return
    const next = spare.shift()
    map[i] = next ? next.id : NEW
  })
  return map
}

/** "calendar-v3.xlsx" -> "calendar-v3". */
const stripExt = (name: string) => name.replace(/\.[^.]+$/, "").trim()

export function SheetImportDialog({
  open,
  onOpenChange,
  projectId,
  workbook,
  sheet,
  people,
  intent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** The open sheet (workbook of tabs); null when the project has none yet. */
  workbook: SheetWorkbook | null
  /** The open tab; null when the sheet has none. */
  sheet: ProjectSheet | null
  /** Employee id -> display name, the grid's own map for PERSON cells. */
  people: Map<string, string>
  /**
   * Why it was opened, which decides where the file lands.
   *
   * From the tab strip ("new-tab") or the New sheet dialog ("new-sheet") the
   * answer is always NEW TABS - mapping a single-tab file into the tab you are
   * standing on would overwrite the thing you meant to add to. Unset is the
   * plain Import button, which keeps its own judgement.
   */
  intent?: Intent
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        {/* Body only exists while open, so every opening starts clean. */}
        {open && (
          <Body
            projectId={projectId}
            workbook={workbook}
            sheet={sheet}
            people={people}
            intent={intent}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface Progress {
  done: number
  total: number
  /** Set in ALL TABS mode: which tab is being written. */
  tab?: number
  tabs?: number
}

function Body({
  projectId,
  workbook,
  sheet,
  people,
  intent,
  onClose,
}: {
  projectId: string
  workbook: SheetWorkbook | null
  sheet: ProjectSheet | null
  people: Map<string, string>
  intent?: Intent
  onClose: () => void
}) {
  const qc = useQueryClient()
  const m = useSheetMutations(projectId)
  const drive = useProjectDrive(projectId)
  const driveSheets = (drive.data?.files ?? []).filter((f) => f.mimeType.includes("spreadsheet"))

  const fileRef = useRef<HTMLInputElement>(null)
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [tabs, setTabs] = useState<Tab[] | null>(null)
  const [mode, setMode] = useState<Mode>("one")
  const [target, setTarget] = useState<Target>(
    intent === "new-sheet" || !workbook ? "new" : "current",
  )
  const [newSheetName, setNewSheetName] = useState("")
  const [tabIndex, setTabIndex] = useState(0)
  /**
   * Which tabs of the file to bring in, by index.
   *
   * A workbook is rarely all wanted: a calendar file carries a notes tab, a
   * lookup tab, last quarter's sheet. Importing the lot and deleting the rest
   * afterwards is worse than choosing here, and until now that was the only
   * option the dialog offered.
   */
  const [chosen, setChosen] = useState<Set<number>>(new Set())
  const [hasHeader, setHasHeader] = useState(true)
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const [driveInput, setDriveInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)

  const peopleIndex = useMemo<PeopleIndex>(
    () => ({
      byId: people,
      byName: new Map([...people.entries()].map(([id, label]) => [normalise(label), id])),
    }),
    [people],
  )

  const current = tabs?.[tabIndex]
  const { headers, rows: dataRows } = current
    ? split(current, hasHeader)
    : { headers: [] as Raw[], rows: [] as Raw[][] }

  function load(nextTabs: Tab[], name: string) {
    if (nextTabs.length === 0) {
      toast.error("That file has no rows in it.")
      return
    }
    setSourceName(name)
    setTabs(nextTabs)
    setTabIndex(0)
    // Asked for a new tab or a new sheet, every tab in the file becomes one,
    // however few there are. Otherwise: a file with several tabs is almost
    // always "several tabs of one sheet", not "one tab and some clutter".
    setMode(intent || nextTabs.length > 1 || !sheet ? "all" : "one")
    setNewSheetName(stripExt(name) || "Imported sheet")
    // Everything with rows in it, to start - the common case is "all of it",
    // and unticking two is less work than ticking six.
    setChosen(new Set(nextTabs.flatMap((t, i) => (split(t, hasHeader).rows.length > 0 ? [i] : []))))
    if (sheet) setMapping(autoMap(split(nextTabs[0]!, hasHeader).headers, sheet.columns))
  }

  function remap(nextIndex: number, nextHasHeader: boolean) {
    const tab = tabs?.[nextIndex]
    if (!tab || !sheet) return
    setMapping(autoMap(split(tab, nextHasHeader).headers, sheet.columns))
  }

  async function onFile(file: File) {
    setLoading(true)
    try {
      load(await parseWorkbook(await file.arrayBuffer()), file.name)
    } catch (error) {
      toastError(error, "Couldn't read that file")
    } finally {
      setLoading(false)
    }
  }

  async function onDrive(fileId: string, label: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/drive/export`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ fileId }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Export failed (HTTP ${res.status})`)
      }
      load(await parseWorkbook(await res.arrayBuffer()), label)
    } catch (error) {
      toastError(error, "Couldn't fetch that Google Sheet")
    } finally {
      setLoading(false)
    }
  }

  /**
   * The shared pipeline: claim/create columns for the mapped headers, coerce
   * every value, extend SELECT options, append rows in batches. Used by both
   * modes - the single-tab import with the person's mapping, and the all-tabs
   * import with an automatic one per new tab.
   */
  async function importInto(
    targetSheet: ProjectSheet,
    hs: Raw[],
    rows: Raw[][],
    map: Record<number, string>,
    onRows: (done: number, total: number) => void,
  ): Promise<{ imported: number; issues: Record<string, number> }> {
    const targets: string[] = hs.map((_, i) => map[i] ?? SKIP)
    let columns = targetSheet.columns
    const columnsById = new Map(columns.map((c) => [c.id, { ...c }]))

    // 1. Columns the import creates or claims. Placeholder (A, B, C…) columns
    //    are renamed to the header and typed from the data; NEW ones are
    //    created, then re-read so we learn their ids.
    const created: number[] = []
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]!
      if (t === SKIP) continue
      const header = String(hs[i] ?? "").trim() || `Column ${i + 1}`
      const type = guessType(rows.slice(0, 50).map((r) => r[i] ?? null))
      if (t === NEW) {
        await m.addColumn.mutateAsync({ sheetId: targetSheet.id, name: header, type })
        created.push(i)
      } else if (hasHeader) {
        const col = columnsById.get(t)
        if (col && isPlaceholder(col)) {
          await m.updateColumn.mutateAsync({
            sheetId: targetSheet.id,
            columnId: col.id,
            name: header,
            type,
          })
          col.type = type
          col.name = header
        }
      }
    }
    if (created.length > 0) {
      const fresh = await apiFetch<{ data: SheetWorkbook[] }>(`/api/projects/${projectId}/sheets`)
      const s = fresh.data.flatMap((w) => w.sheets).find((x) => x.id === targetSheet.id)
      if (!s) throw new Error("The tab is no longer there")
      columns = s.columns
      const known = new Set(targetSheet.columns.map((c) => c.id))
      for (const i of created) {
        const header = normalise(String(hs[i] ?? "").trim() || `Column ${i + 1}`)
        const col =
          columns.find((c) => !known.has(c.id) && normalise(c.name) === header) ??
          columns.find((c) => normalise(c.name) === header)
        targets[i] = col?.id ?? SKIP
        if (col) known.add(col.id)
      }
      for (const c of columns) if (!columnsById.has(c.id)) columnsById.set(c.id, { ...c })
    }

    // 2. Values, through the same coercion the grid stores. SELECT values that
    //    are not options yet become options (matching the existing spelling
    //    when one differs only in case).
    const issues: Record<string, number> = {}
    const selectAdds = new Map<string, Map<string, string>>()
    const out: Record<string, unknown>[] = []
    for (const r of rows) {
      const cells: Record<string, unknown> = {}
      targets.forEach((t, i) => {
        if (t === SKIP || t === NEW) return
        const col = columnsById.get(t)
        if (!col) return
        const { value, issue } = coerce(col.type, r[i] ?? null, peopleIndex)
        if (issue) issues[issue] = (issues[issue] ?? 0) + 1
        if (value === null) return
        if (col.type === "SELECT" && typeof value === "string") {
          const existing = col.options.find((o) => normalise(o) === normalise(value))
          if (existing) {
            cells[t] = existing
            return
          }
          const adds = selectAdds.get(col.id) ?? new Map<string, string>()
          if (!adds.has(normalise(value))) adds.set(normalise(value), value)
          selectAdds.set(col.id, adds)
        }
        cells[t] = value
      })
      if (Object.keys(cells).length > 0) out.push(cells)
    }
    for (const [columnId, adds] of selectAdds) {
      const col = columnsById.get(columnId)!
      await m.updateColumn.mutateAsync({
        sheetId: targetSheet.id,
        columnId,
        options: [...col.options, ...adds.values()],
      })
    }

    // 3. Append in batches so a long file shows progress and a hiccup loses
    //    at most one batch.
    let done = 0
    onRows(0, out.length)
    for (let i = 0; i < out.length; i += BATCH) {
      await m.importRows.mutateAsync({ sheetId: targetSheet.id, rows: out.slice(i, i + BATCH) })
      done = Math.min(i + BATCH, out.length)
      onRows(done, out.length)
    }
    return { imported: out.length, issues }
  }

  const describeIssues = (issues: Record<string, number>) => {
    const skipped = Object.values(issues).reduce((a, b) => a + b, 0)
    return skipped
      ? ` · ${skipped} ${skipped === 1 ? "value" : "values"} left blank (${Object.entries(issues)
          .map(([k, n]) => `${n} not a ${k}`)
          .join(", ")})`
      : ""
  }

  // ── ONE TAB -> the open tab ────────────────────────────────────────────────
  const rowCount = dataRows.length
  const tooMany = rowCount > MAX_ROWS
  const mappedCount = headers.filter((_, i) => (mapping[i] ?? SKIP) !== SKIP).length

  async function runImportOne() {
    if (!sheet || tooMany || mappedCount === 0 || rowCount === 0) return
    setProgress({ done: 0, total: rowCount })
    try {
      const res = await importInto(sheet, headers, dataRows, mapping, (done, total) =>
        setProgress({ done, total }),
      )
      toast.success(
        `Imported ${res.imported} ${res.imported === 1 ? "row" : "rows"} into "${sheet.name}"${describeIssues(res.issues)}`,
      )
      onClose()
    } catch {
      // Each mutation already toasted its own reason; the dialog stays open so
      // nothing chosen in the mapping is lost.
    } finally {
      setProgress(null)
    }
  }

  // ── ALL TABS -> tabs inside one sheet ──────────────────────────────────────
  const tabPlans = (tabs ?? []).map((t, i) => {
    const { rows } = split(t, hasHeader)
    return { index: i, name: t.name.trim() || `Tab ${i + 1}`, rows: rows.length }
  })
  // Only what is ticked can be too big, or be imported: an oversized tab you
  // did not ask for should not block the ones you did.
  const oversized = tabPlans.filter((p) => p.rows > MAX_ROWS && chosen.has(p.index))
  const importableTabs = tabPlans.filter((p) => p.rows > 0 && chosen.has(p.index))
  const selectableTabs = tabPlans.filter((p) => p.rows > 0)
  const allChosen = selectableTabs.length > 0 && selectableTabs.every((p) => chosen.has(p.index))
  const toggleTab = (i: number) =>
    setChosen((cur) => {
      const next = new Set(cur)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  const canRunAll =
    importableTabs.length > 0 &&
    oversized.length === 0 &&
    (target === "current" ? !!workbook : newSheetName.trim().length > 0)

  async function runImportAll() {
    if (!tabs || !canRunAll) return
    setProgress({ done: 0, total: 0, tab: 1, tabs: importableTabs.length })
    const made: string[] = []
    let totalRows = 0
    let sheetName = workbook?.name ?? ""
    const issues: Record<string, number> = {}
    try {
      let workbookId: string
      let takenTabs: Set<string>
      // In a NEW sheet the first import tab rides along with the sheet's
      // creation (a sheet always opens with one tab), so it is not made twice.
      let firstTab: ProjectSheet | null = null
      if (target === "new") {
        const books = await apiFetch<{ data: SheetWorkbook[] }>(`/api/projects/${projectId}/sheets`)
        const takenBooks = new Set(books.data.map((b) => normalise(b.name)))
        const base = newSheetName.trim()
        sheetName = base
        for (let k = 2; takenBooks.has(normalise(sheetName)); k++) sheetName = `${base} (${k})`
        const created = await apiFetch<{ data: SheetWorkbook }>(
          `/api/projects/${projectId}/workbooks`,
          {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({ name: sheetName, firstTab: importableTabs[0]!.name }),
          },
        )
        workbookId = created.data.id
        firstTab = created.data.sheets[0] ?? null
        takenTabs = new Set(created.data.sheets.map((s) => normalise(s.name)))
      } else {
        workbookId = workbook!.id
        takenTabs = new Set(workbook!.sheets.map((s) => normalise(s.name)))
      }

      for (const [n, plan] of importableTabs.entries()) {
        const tab = tabs[plan.index]!
        let targetSheet: ProjectSheet
        if (n === 0 && firstTab) {
          targetSheet = firstTab
        } else {
          // Tab names are unique inside a sheet: suffix rather than fail midway.
          let name = plan.name
          for (let k = 2; takenTabs.has(normalise(name)); k++) name = `${plan.name} (${k})`
          takenTabs.add(normalise(name))
          const created = await apiFetch<{ data: ProjectSheet }>(
            `/api/projects/${projectId}/sheets`,
            {
              method: "POST",
              headers: JSON_HEADERS,
              body: JSON.stringify({ workbookId, name }),
            },
          )
          targetSheet = created.data
        }
        const { headers: hs, rows } = split(tab, hasHeader)
        const res = await importInto(
          targetSheet,
          hs,
          rows,
          autoMap(hs, targetSheet.columns),
          (done, total) => setProgress({ done, total, tab: n + 1, tabs: importableTabs.length }),
        )
        made.push(targetSheet.name)
        totalRows += res.imported
        for (const [k, v] of Object.entries(res.issues)) issues[k] = (issues[k] ?? 0) + v
      }
      toast.success(
        `Imported ${made.length} ${made.length === 1 ? "tab" : "tabs"} into "${sheetName}" (${totalRows} rows): ${made.join(", ")}${describeIssues(issues)}`,
      )
      onClose()
    } catch (error) {
      // A failure mid-way leaves the tabs made so far - say so, rather than let
      // a partial import look like nothing happened.
      if (made.length > 0) {
        toastError(
          error,
          `Stopped after ${made.length} ${made.length === 1 ? "tab" : "tabs"} (${made.join(", ")})`,
        )
      }
    } finally {
      void qc.invalidateQueries({ queryKey: ["project-sheets", projectId] })
      setProgress(null)
    }
  }

  const importing = progress !== null
  const preview = dataRows.slice(0, 5)
  const progressLabel = progress
    ? progress.tabs
      ? `Tab ${progress.tab}/${progress.tabs} · ${progress.done}/${progress.total} rows…`
      : `Importing ${progress.done}/${progress.total}…`
    : null
  const oneTabTitle = sheet ? `Import into “${sheet.name}”` : "Import"

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          {mode === "all" && tabs ? "Import workbook" : oneTabTitle}
        </DialogTitle>
        <DialogDescription>
          {mode === "all" && tabs
            ? "Choose the tabs you want. Each becomes a tab in a sheet here, named after it, with the file's headers as columns."
            : "Rows are added after the last row of the tab. Nothing already in it is changed."}
        </DialogDescription>
      </DialogHeader>

      {!tabs ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-sm border p-4">
            <p className="text-sm font-medium">From a file</p>
            <p className="text-muted-foreground text-xs">
              CSV, Excel (.xlsx / .xls). A workbook with several tabs imports every tab.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (f) void onFile(f)
              }}
            />
            <Button
              variant="outline"
              className="w-full gap-1.5 border-dashed"
              loading={loading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" /> Choose file
            </Button>
          </div>
          <div className="space-y-2 rounded-sm border p-4">
            <p className="text-sm font-medium">From a Google Sheet</p>
            <p className="text-muted-foreground text-xs">
              Paste the sheet&rsquo;s link. It must be in this project&rsquo;s Drive folder.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/…"
                value={driveInput}
                onChange={(e) => setDriveInput(e.target.value)}
                disabled={!drive.data?.configured}
              />
              <Button
                variant="outline"
                className="shrink-0 gap-1.5"
                loading={loading}
                disabled={!driveIdFrom(driveInput)}
                onClick={() => {
                  const id = driveIdFrom(driveInput)
                  if (id) void onDrive(id, "Google Sheet")
                }}
              >
                <Link2 className="h-3.5 w-3.5" /> Fetch
              </Button>
            </div>
            {driveSheets.length > 0 && (
              <Select
                onValueChange={(id) =>
                  void onDrive(id, driveSheets.find((f) => f.id === id)?.name ?? "Google Sheet")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="…or pick one from the project folder" />
                </SelectTrigger>
                <SelectContent>
                  {driveSheets.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {drive.data && !drive.data.configured && (
              <p className="text-muted-foreground text-xs">Google Drive isn&rsquo;t connected.</p>
            )}
          </div>
        </div>
      ) : (
        // A focused Input draws ring-2 + ring-offset-2, i.e. 4px OUTSIDE its
        // own box, and overflow-y:auto clips on both axes - so the ring was
        // being sliced off on the left, top and bottom. The negative margin
        // widens the scroll box by that 4px and the padding puts the content
        // back where it was, so nothing moves and the ring has room.
        <div className="-mx-1 max-h-[65vh] space-y-4 overflow-y-auto px-1 py-1">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="truncate">{sourceName}</span>
              <span className="text-muted-foreground font-normal">
                · {tabs.length} {tabs.length === 1 ? "tab" : "tabs"}
              </span>
            </span>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={hasHeader}
                onCheckedChange={(v) => {
                  const next = v === true
                  setHasHeader(next)
                  remap(tabIndex, next)
                }}
              />
              First row is headers
            </label>
          </div>

          {sheet && (
            <div className="grid gap-2 sm:grid-cols-2">
              <ModeCard
                active={mode === "all"}
                icon={Layers}
                title={tabs.length === 1 ? "As a new tab" : "Tabs → tabs in a sheet"}
                text={
                  tabs.length === 1
                    ? "One tab here, named after it."
                    : "Choose which tabs to bring in; each becomes a tab here, named after it."
                }
                onClick={() => setMode("all")}
              />
              <ModeCard
                active={mode === "one"}
                icon={FileSpreadsheet}
                title={`One tab → “${sheet.name}”`}
                text="Pick a tab and map its columns onto this tab's."
                onClick={() => setMode("one")}
              />
            </div>
          )}

          {mode === "all" ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {workbook && (
                  <ModeCard
                    active={target === "current"}
                    icon={Layers}
                    title={`Add to “${workbook.name}”`}
                    text="New tabs next to the ones already there."
                    onClick={() => setTarget("current")}
                  />
                )}
                <ModeCard
                  active={target === "new"}
                  icon={FolderPlus}
                  title="Create a new sheet"
                  text="A fresh sheet holding these tabs."
                  onClick={() => setTarget("new")}
                />
              </div>
              {target === "new" && (
                <div className="space-y-1.5">
                  <Label required htmlFor="import-sheet-name" className="text-[11px]">
                    New sheet name
                  </Label>
                  <Input
                    id="import-sheet-name"
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                    placeholder="Content calendar"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-muted-foreground text-[11px]">Which tabs to import</Label>
                  {selectableTabs.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setChosen(
                          allChosen ? new Set() : new Set(selectableTabs.map((p) => p.index)),
                        )
                      }
                      className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-4"
                    >
                      {allChosen ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>

                <div className="divide-border/70 divide-y overflow-hidden rounded-sm border">
                  {tabPlans.map((p) => {
                    const empty = p.rows === 0
                    const tooBig = p.rows > MAX_ROWS
                    const on = chosen.has(p.index)
                    return (
                      <label
                        key={p.index}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                          empty
                            ? "cursor-not-allowed opacity-50"
                            : "hover:bg-muted/40 cursor-pointer",
                          on && !empty && "bg-primary/5",
                        )}
                      >
                        <Checkbox
                          checked={on && !empty}
                          disabled={empty}
                          onCheckedChange={() => !empty && toggleTab(p.index)}
                          aria-label={`Import ${p.name}`}
                        />
                        <FileSpreadsheet
                          className={cn(
                            "h-4 w-4 shrink-0",
                            on && !empty ? "text-emerald-500" : "text-muted-foreground",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                        <span
                          className={cn(
                            "text-muted-foreground shrink-0 text-xs tabular-nums",
                            tooBig && on && "text-destructive font-medium",
                            empty && "italic",
                          )}
                        >
                          {empty
                            ? "empty"
                            : `${p.rows} ${p.rows === 1 ? "row" : "rows"}${tooBig ? ` · over ${MAX_ROWS}` : ""}`}
                        </span>
                      </label>
                    )
                  })}
                </div>

                {/* What is actually about to happen, in one line, so the button
                    is never the first place you learn the count. */}
                <p className="text-muted-foreground text-xs">
                  {importableTabs.length === 0
                    ? "Pick at least one tab."
                    : `${importableTabs.length} of ${selectableTabs.length} tab${selectableTabs.length === 1 ? "" : "s"} · ${importableTabs.reduce((n, p) => n + p.rows, 0)} rows`}
                </p>

                <p className="text-muted-foreground text-xs">
                  Headers become column names, typed from the data (dates day-first, yes/no as
                  ticks, people matched to team members). A tab named like an existing one gets a
                  &ldquo;(2)&rdquo; suffix.
                </p>
                {oversized.length > 0 && (
                  <p className="text-destructive text-xs">
                    {oversized.map((p) => p.name).join(", ")}: more than {MAX_ROWS} rows - untick
                    {oversized.length === 1 ? " it" : " them"}, or split the tab and import it
                    separately.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {tabs.length > 1 && (
                  <Select
                    value={String(tabIndex)}
                    onValueChange={(v) => {
                      const idx = Number(v)
                      setTabIndex(idx)
                      remap(idx, hasHeader)
                    }}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tabs.map((t, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                  {rowCount} {rowCount === 1 ? "row" : "rows"} · {mappedCount} of {headers.length}{" "}
                  columns mapped
                </span>
              </div>

              {tooMany && (
                <p className="text-destructive text-xs">
                  That is more than {MAX_ROWS} rows - split the file and import it in parts.
                </p>
              )}

              {sheet && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[11px]">
                    Where each column goes
                  </Label>
                  <div className="divide-y rounded-sm border">
                    {headers.map((h, i) => {
                      const t = mapping[i] ?? SKIP
                      const sample = dataRows.find((r) => r[i] !== null && r[i] !== "")?.[i]
                      return (
                        <div
                          key={i}
                          className="grid items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_auto_1fr]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium" title={String(h)}>
                              {String(h)}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {sample instanceof Date
                                ? isoDate(sample)
                                : sample === undefined
                                  ? "(empty)"
                                  : String(sample)}
                            </p>
                          </div>
                          <span className="text-muted-foreground hidden text-xs sm:block">→</span>
                          <Select
                            value={t}
                            onValueChange={(v) => setMapping((prev) => ({ ...prev, [i]: v }))}
                          >
                            <SelectTrigger className={cn(t === SKIP && "text-muted-foreground")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SKIP}>Skip this column</SelectItem>
                              <SelectItem value={NEW}>
                                + New column &ldquo;{String(h)}&rdquo;
                              </SelectItem>
                              {sheet.columns.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {columnLetter(c.position)} ·{" "}
                                  {isPlaceholder(c) ? "(unnamed)" : c.name}
                                  <span className="text-muted-foreground ml-1 text-xs">
                                    {COLUMN_TYPE_LABEL[c.type]}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Unnamed columns (A, B, C…) take the header as their name. Dates are read
                    day-first (01/03/2026 = 1 March). People are matched to team members by name.
                  </p>
                </div>
              )}

              {preview.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[11px]">
                    Preview (first {preview.length})
                  </Label>
                  <div className="overflow-x-auto rounded-sm border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          {headers.map((h, i) =>
                            (mapping[i] ?? SKIP) === SKIP ? null : (
                              <th
                                key={i}
                                className="px-2 py-1.5 text-left font-medium whitespace-nowrap"
                              >
                                {String(h)}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {preview.map((r, ri) => (
                          <tr key={ri}>
                            {headers.map((_, i) =>
                              (mapping[i] ?? SKIP) === SKIP ? null : (
                                <td key={i} className="max-w-[220px] truncate px-2 py-1.5">
                                  {r[i] instanceof Date
                                    ? isoDate(r[i] as Date)
                                    : String(r[i] ?? "")}
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <DialogFooter className="gap-2 sm:justify-between">
        {tabs ? (
          <Button variant="outline" onClick={() => setTabs(null)} disabled={importing}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          {tabs && mode === "all" && (
            <Button onClick={() => void runImportAll()} disabled={!canRunAll} loading={importing}>
              {progressLabel ??
                `Import ${importableTabs.length} ${importableTabs.length === 1 ? "tab" : "tabs"}`}
            </Button>
          )}
          {tabs && mode === "one" && (
            <Button
              onClick={() => void runImportOne()}
              disabled={!sheet || tooMany || mappedCount === 0 || rowCount === 0}
              loading={importing}
            >
              {progressLabel ?? `Import ${rowCount} ${rowCount === 1 ? "row" : "rows"}`}
            </Button>
          )}
        </div>
      </DialogFooter>
    </>
  )
}

function ModeCard({
  active,
  icon: Icon,
  title,
  text,
  onClick,
}: {
  active: boolean
  icon: React.ElementType
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-sm border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "hover:bg-muted/40",
      )}
    >
      <Icon
        className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block text-xs">{text}</span>
      </span>
    </button>
  )
}
