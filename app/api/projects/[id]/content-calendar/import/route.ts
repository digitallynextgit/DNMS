import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const runtime = "nodejs"

// Pull a plain string out of any ExcelJS cell value shape.
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return ""
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (v instanceof Date) return v.toISOString()
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>
    if (typeof o.text === "string") return o.text.trim()
    if (typeof o.result !== "undefined") return String(o.result).trim()
    if (Array.isArray(o.richText))
      return (o.richText as { text: string }[])
        .map((t) => t.text)
        .join("")
        .trim()
    if (typeof o.hyperlink === "string") return String(o.hyperlink)
  }
  return ""
}

function parseDate(v: ExcelJS.CellValue): Date | null {
  if (v instanceof Date) return v
  const s = cellText(v)
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function platformFromSheet(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes("instagram")) return "Instagram"
  if (n.includes("linkedin")) return "LinkedIn"
  if (n.includes("meta") || n.includes("facebook")) return "Meta"
  if (n.includes("youtube")) return "YouTube"
  return null
}

// POST - bulk-import content-calendar entries from an uploaded .xlsx.
// Reads every sheet that has a "Date" header, maps columns by header name, and
// creates one entry per row that actually has content (empty days are skipped).
export const POST = withAuth(
  PERMISSIONS.PROJECT_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const projectId = ctx.params.id
      const form = await req.formData().catch(() => null)
      const file = form?.get("file")
      if (!(file instanceof File))
        return NextResponse.json({ error: "No spreadsheet uploaded" }, { status: 400 })

      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())

      const rows: {
        projectId: string
        date: Date | null
        platform: string | null
        theme: string | null
        format: string | null
        hook: string | null
        content: string | null
        status: string
        link: string | null
      }[] = []
      const sheetsUsed: string[] = []

      for (const ws of wb.worksheets) {
        // Find a header row (one containing a "Date" cell) in the first 6 rows.
        let headerRow = -1
        const colMap: Record<string, number> = {}
        for (let r = 1; r <= Math.min(6, ws.rowCount); r++) {
          const row = ws.getRow(r)
          const map: Record<string, number> = {}
          row.eachCell({ includeEmpty: false }, (cell, cn) => {
            const h = cellText(cell.value).toLowerCase()
            if (h.includes("date")) map.date = cn
            else if (h.includes("platform") || h.includes("channel")) map.platform = cn
            else if (h.includes("theme") || h.includes("occasion")) map.theme = cn
            else if (h.includes("format")) map.format = cn
            else if (h.includes("hook")) map.hook = cn
            else if (h.includes("content") || h === "caption") map.content = cn
            else if (h.includes("status")) map.status = cn
            else if (h.includes("link") || h.includes("url")) map.link = cn
          })
          if (map.date && (map.theme || map.format || map.hook || map.content)) {
            headerRow = r
            Object.assign(colMap, map)
            break
          }
        }
        if (headerRow === -1) continue // not a calendar-shaped sheet

        const sheetPlatform = platformFromSheet(ws.name)
        let used = 0
        for (let r = headerRow + 1; r <= ws.rowCount; r++) {
          const row = ws.getRow(r)
          const get = (col?: number) => (col ? cellText(row.getCell(col).value) : "")
          const theme = get(colMap.theme)
          const format = get(colMap.format)
          const hook = get(colMap.hook)
          const content = get(colMap.content)
          // Skip empty days (a date with nothing planned).
          if (!theme && !format && !hook && !content) continue
          const date = colMap.date ? parseDate(row.getCell(colMap.date).value) : null
          // The Platform column wins; otherwise fall back to the sheet name.
          rows.push({
            projectId,
            date,
            platform: get(colMap.platform) || sheetPlatform,
            theme: theme || null,
            format: format || null,
            hook: hook || null,
            content: content || null,
            status: /post/i.test(get(colMap.status)) ? "POSTED" : "PLANNED",
            link: get(colMap.link) || null,
          })
          used++
        }
        if (used > 0) sheetsUsed.push(`${ws.name} (${used})`)
      }

      if (rows.length === 0)
        return NextResponse.json(
          {
            error:
              "No content rows found. Expected sheets with Date / Theme / Format / Content columns.",
          },
          { status: 422 },
        )

      await db.contentCalendarEntry.createMany({ data: rows })
      return NextResponse.json({ data: { imported: rows.length, sheets: sheetsUsed } })
    } catch (error) {
      console.error("[CONTENT_CALENDAR_IMPORT]", error)
      return NextResponse.json({ error: "Could not read the spreadsheet" }, { status: 500 })
    }
  },
)
