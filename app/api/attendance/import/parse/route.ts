import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import ExcelJS from "exceljs"
import type { Session } from "next-auth"

// =============================================================================
// Parses an uploaded attendance file (CSV or Excel) into normalized rows:
//   { employee_no, date (YYYY-MM-DD), check_in (HH:MM), check_out (HH:MM) }
//
// Columns are matched by header NAME (case-insensitive, alias-tolerant) so it
// works with Hikvision's Excel export as well as our own CSV template. Handles
// two common shapes:
//   - one row per day   (employee + date + in + out columns)
//   - one row per punch  (employee + a single date-time column) → grouped per
//     employee+day, earliest time = check-in, latest = check-out.
// =============================================================================

interface ParsedRow {
  employee_no: string
  date: string
  check_in: string
  check_out: string
}

const FIELD_ALIASES: Record<string, string[]> = {
  employee_no: [
    "employee_no",
    "employee no",
    "employee code",
    "employee id",
    "emp code",
    "emp no",
    "emp id",
    "person id",
    "person no",
    "personnel id",
    "personnel no",
    "user id",
    "userid",
    "job number",
    "attendance no",
    "ac-no",
    "ac no",
    "badge number",
    "badgenumber",
    "badge",
  ],
  date: ["date", "attendance date", "att date", "day"],
  check_in: [
    "check_in",
    "check in",
    "checkin",
    "in",
    "clock in",
    "clock-in",
    "on duty",
    "first in",
    "time in",
    "in time",
    "first punch",
    "sign in",
  ],
  check_out: [
    "check_out",
    "check out",
    "checkout",
    "out",
    "clock out",
    "clock-out",
    "off duty",
    "last out",
    "time out",
    "out time",
    "last punch",
    "sign out",
  ],
  datetime: [
    "datetime",
    "date time",
    "time",
    "punch time",
    "event time",
    "access time",
    "swipe time",
    "timestamp",
    "record time",
    "check time",
    "attendance time",
  ],
}

function normalize(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function fieldFor(header: unknown): string | null {
  const h = normalize(header)
  if (!h) return null
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(h)) return field
  }
  return null
}

// Pull a plain value out of an ExcelJS cell value (rich text / formula / hyperlink).
function cellValue(v: unknown): unknown {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("result" in o) return o.result
    if ("text" in o) return o.text
    if (Array.isArray(o.richText))
      return (o.richText as { text: string }[]).map((t) => t.text).join("")
  }
  return v
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

function toDateStr(v: unknown): string {
  const val = cellValue(v)
  if (val == null || val === "") return ""
  if (val instanceof Date)
    return `${val.getUTCFullYear()}-${pad(val.getUTCMonth() + 1)}-${pad(val.getUTCDate())}`
  const s = String(val).trim()
  const iso = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) return `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`
  const dmy = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (dmy) return `${dmy[3]}-${pad(+dmy[2])}-${pad(+dmy[1])}`
  return ""
}

function toTimeStr(v: unknown): string {
  const val = cellValue(v)
  if (val == null || val === "") return ""
  if (val instanceof Date) return `${pad(val.getUTCHours())}:${pad(val.getUTCMinutes())}`
  const s = String(val).trim()
  const m = s.match(/(\d{1,2}):(\d{2})/)
  if (m) return `${pad(+m[1])}:${pad(+m[2])}`
  return ""
}

// RFC-4180-ish parser: a newline INSIDE a quoted cell does NOT end the row, so
// the Hikvision matrix's multi-line day cells (stacked punch times) survive.
function csvTo2d(text: string): unknown[][] {
  const src = text.replace(/^﻿/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cur = ""
  let quoted = false
  const endCell = () => {
    row.push(cur.trim())
    cur = ""
  }
  const endRow = () => {
    endCell()
    if (row.some((c) => c !== "")) rows.push(row)
    row = []
  }
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = false
      } else cur += c
    } else if (c === '"') quoted = true
    else if (c === ",") endCell()
    else if (c === "\r") {
      if (src[i + 1] === "\n") i++
      endRow()
    } else if (c === "\n") endRow()
    else cur += c
  }
  if (cur !== "" || row.length) endRow()
  return rows
}

// Many "Excel" exports (incl. Hikvision .xls) are UTF-16 or carry a BOM.
function decodeText(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le")
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf).swap16().toString("utf16le")
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString("utf8")
  return buf.toString("utf8")
}

function cleanCell(rawHtml: string): string {
  return rawHtml
    .replace(/<\s*br\s*\/?\s*>/gi, "\n") // line breaks (stacked punch times) → newlines
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .join("\n")
}

// Hikvision frequently exports a .xls that is actually an HTML <table>.
function htmlToGrid(html: string): unknown[][] {
  const grid: unknown[][] = []
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rm: RegExpExecArray | null
  while ((rm = rowRe.exec(html))) {
    const cells: unknown[] = []
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let cm: RegExpExecArray | null
    while ((cm = cellRe.exec(rm[1]))) cells.push(cleanCell(cm[1]))
    if (cells.length) grid.push(cells)
  }
  return grid
}

// ── Hikvision monthly "Attendance Record" matrix ────────────────────────────
// rows = employees; columns = Employee ID / Name / Department then days 1..31.
// Each day cell holds that day's punch times (one per line). The report month
// comes from the "Made Date:YYYY/MM/DD-YYYY/MM/DD" line above the header.

function extractTimes(v: unknown): string[] {
  const text = String(cellValue(v) ?? "")
  const matches = text.match(/(\d{1,2}):(\d{2})/g) ?? []
  return matches
    .map((m) => {
      const [h, min] = m.split(":")
      return `${pad(Number(h))}:${min}`
    })
    .sort()
}

function detectMatrix(
  grid: unknown[][],
): { headerIdx: number; empCol: number; dayCols: Record<number, number> } | null {
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const row = grid[i]
    let empCol = -1
    const dayCols: Record<number, number> = {}
    row.forEach((cell, ci) => {
      if (fieldFor(cell) === "employee_no") empCol = ci
      const val = cellValue(cell)
      const n =
        typeof val === "number"
          ? val
          : typeof val === "string" && /^\d{1,2}$/.test(val.trim())
            ? parseInt(val, 10)
            : NaN
      if (Number.isInteger(n) && n >= 1 && n <= 31) dayCols[ci] = n
    })
    if (empCol >= 0 && Object.keys(dayCols).length >= 10) {
      return { headerIdx: i, empCol, dayCols }
    }
  }
  return null
}

function findMonthYear(
  grid: unknown[][],
  beforeRow: number,
): { year: number; month: number } | null {
  const range = /(\d{4})[/.-](\d{1,2})[/.-]\d{1,2}\s*[-~–]\s*\d{4}[/.-]\d{1,2}[/.-]\d{1,2}/
  for (let i = 0; i < beforeRow; i++) {
    for (const cell of grid[i]) {
      const m = String(cellValue(cell) ?? "").match(range)
      if (m) return { year: Number(m[1]), month: Number(m[2]) }
    }
  }
  return null
}

function parseMatrix(
  grid: unknown[][],
  headerIdx: number,
  empCol: number,
  dayCols: Record<number, number>,
  year: number,
  month: number,
): ParsedRow[] {
  const out: ParsedRow[] = []
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i] ?? []
    const emp = String(cellValue(row[empCol]) ?? "").trim()
    if (!emp) continue
    for (const [ciStr, day] of Object.entries(dayCols)) {
      const times = extractTimes(row[Number(ciStr)])
      if (times.length === 0) continue
      out.push({
        employee_no: emp,
        date: `${year}-${pad(month)}-${pad(day)}`,
        check_in: times[0],
        check_out: times.length > 1 ? times[times.length - 1] : "",
      })
    }
  }
  return out
}

// Core: take a 2D grid of cell values → normalized rows.
function parseGrid(grid: unknown[][]): ParsedRow[] {
  // Hikvision monthly matrix (employees × days) takes priority when detected.
  const matrix = detectMatrix(grid)
  if (matrix) {
    const my = findMonthYear(grid, matrix.headerIdx)
    if (my) {
      return parseMatrix(grid, matrix.headerIdx, matrix.empCol, matrix.dayCols, my.year, my.month)
    }
  }

  // Otherwise: flat list matched by header name (our CSV template / other exports).
  // Find the header row: among the first 15 rows, the one matching the most fields.
  let headerIdx = -1
  let bestScore = 0
  let colMap: Record<number, string> = {}
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const map: Record<number, string> = {}
    let score = 0
    grid[i].forEach((cell, ci) => {
      const f = fieldFor(cell)
      if (f && !Object.values(map).includes(f)) {
        map[ci] = f
        score++
      }
    })
    if (score > bestScore) {
      bestScore = score
      headerIdx = i
      colMap = map
    }
  }
  if (headerIdx < 0 || bestScore < 2) return []

  const fields = Object.values(colMap)
  const hasInOut = fields.includes("check_in") || fields.includes("check_out")
  const hasDatetime = fields.includes("datetime")

  const records = grid
    .slice(headerIdx + 1)
    .map((cells) => {
      const rec: Record<string, unknown> = {}
      for (const [ci, field] of Object.entries(colMap)) rec[field] = cells[Number(ci)]
      return rec
    })
    .filter((rec) => String(cellValue(rec.employee_no) ?? "").trim() !== "")

  // Shape 1: explicit in/out columns → one row per record.
  if (hasInOut && !hasDatetime) {
    return records
      .map((rec) => ({
        employee_no: String(cellValue(rec.employee_no) ?? "").trim(),
        date: toDateStr(rec.date),
        check_in: toTimeStr(rec.check_in),
        check_out: toTimeStr(rec.check_out),
      }))
      .filter((r) => r.employee_no && r.date)
  }

  // Shape 2: per-punch → group by employee+day, earliest=in, latest=out.
  const groups = new Map<string, { employee_no: string; date: string; times: string[] }>()
  for (const rec of records) {
    const emp = String(cellValue(rec.employee_no) ?? "").trim()
    let date = ""
    let time = ""
    if (rec.datetime != null && rec.datetime !== "") {
      date = toDateStr(rec.datetime)
      time = toTimeStr(rec.datetime)
    } else {
      date = toDateStr(rec.date)
      time = toTimeStr(rec.check_in ?? rec.check_out ?? rec.date)
    }
    if (!emp || !date) continue
    const key = `${emp}|${date}`
    if (!groups.has(key)) groups.set(key, { employee_no: emp, date, times: [] })
    if (time) groups.get(key)!.times.push(time)
  }
  return [...groups.values()].map((g) => {
    const sorted = [...g.times].sort()
    return {
      employee_no: g.employee_no,
      date: g.date,
      check_in: sorted[0] ?? "",
      check_out: sorted.length > 1 ? sorted[sorted.length - 1] : "",
    }
  })
}

export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const form = await req.formData()
      const file = form.get("file")
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
      }

      const buf = Buffer.from(await file.arrayBuffer())
      // Detect the REAL format by content, not the extension - Hikvision's .xls
      // is often an HTML table (or old binary), not a true .xlsx.
      const isZip = buf[0] === 0x50 && buf[1] === 0x4b // "PK" → real .xlsx
      const isOle = buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 // old .xls

      let grid: unknown[][]
      if (isZip) {
        const wb = new ExcelJS.Workbook()
        // @types/node's generic Buffer vs ExcelJS's bundled Buffer type differ; cast through.
        await wb.xlsx.load(buf as never)
        const sheet = wb.worksheets[0]
        if (!sheet) {
          return NextResponse.json({ error: "The Excel file has no sheets" }, { status: 422 })
        }
        grid = []
        sheet.eachRow({ includeEmpty: false }, (row) => {
          const arr: unknown[] = []
          row.eachCell({ includeEmpty: true }, (cell, col) => {
            arr[col - 1] = cell.value
          })
          grid.push(arr)
        })
      } else {
        const text = decodeText(buf)
        if (/<table|<html|<!doctype html|<tr[\s>]/i.test(text.slice(0, 8192))) {
          // Hikvision .xls is usually an HTML table.
          grid = htmlToGrid(text)
        } else if (isOle) {
          return NextResponse.json(
            {
              error:
                "This is an old binary .xls. Open it in Excel and use Save As → .xlsx (or .csv), then upload again.",
            },
            { status: 422 },
          )
        } else {
          grid = csvTo2d(text)
        }
      }

      const rows = parseGrid(grid)
      return NextResponse.json({ rows })
    } catch (error) {
      console.error("[ATTENDANCE_IMPORT_PARSE]", error)
      return NextResponse.json(
        { error: "Could not read the file. Make sure it's a valid CSV or Excel export." },
        { status: 500 },
      )
    }
  },
)
