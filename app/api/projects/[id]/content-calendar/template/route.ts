import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"

export const runtime = "nodejs"

const PLATFORMS = "Instagram,Meta,LinkedIn,YouTube,Website,Other"
const FORMATS = "Reel,Static,Carousel,Poll,Story,Video,Blog,Other"
const STATUSES = "PLANNED,IN_PROGRESS,READY,POSTED"

const COLUMNS = [
  { header: "Date", key: "date", width: 14 },
  { header: "Platform", key: "platform", width: 14 },
  { header: "Theme", key: "theme", width: 26 },
  { header: "Format", key: "format", width: 14 },
  { header: "Hook", key: "hook", width: 42 },
  { header: "Content", key: "content", width: 60 },
  { header: "Status", key: "status", width: 14 },
  { header: "Link", key: "link", width: 30 },
]

const EXAMPLES = [
  {
    date: new Date("2026-08-10"),
    platform: "Instagram",
    theme: "Independence Day",
    format: "Reel",
    hook: "The one thing nobody tells you about buying your first home…",
    content: "Scene 1 (hook) … Scene 2 (proof) … Scene 3 (CTA)",
    status: "PLANNED",
    link: "",
  },
  {
    date: new Date("2026-08-12"),
    platform: "LinkedIn",
    theme: "Thought leadership",
    format: "Carousel",
    hook: "5 lessons from scaling our agency to 50 clients",
    content: "Slide 1 - Hook · Slide 2 … Slide 6 - CTA",
    status: "POSTED",
    link: "https://linkedin.com/…",
  },
]

// GET - download a ready-to-fill .xlsx template for the content calendar.
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }) => {
    const wb = new ExcelJS.Workbook()
    wb.creator = "DNMS"
    wb.created = new Date()

    // ── Sheet 1: the fillable calendar ──
    const ws = wb.addWorksheet("Content Calendar", {
      views: [{ state: "frozen", ySplit: 1 }],
    })
    ws.columns = COLUMNS

    const header = ws.getRow(1)
    header.font = { bold: true, color: { argb: "FFFFFFFF" } }
    header.height = 22
    header.alignment = { vertical: "middle" }
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } }
      cell.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } }
    })

    // Example rows (delete them before importing).
    for (const ex of EXAMPLES) {
      const row = ws.addRow(ex)
      row.font = { italic: true, color: { argb: "FF888888" } }
      row.alignment = { vertical: "top", wrapText: true }
    }

    // Dropdowns + date format for the fillable range.
    for (let r = 2; r <= 400; r++) {
      ws.getCell(`A${r}`).numFmt = "yyyy-mm-dd"
      ws.getCell(`B${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${PLATFORMS}"`],
      }
      ws.getCell(`D${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${FORMATS}"`],
      }
      ws.getCell(`G${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${STATUSES}"`],
      }
    }

    // ── Sheet 2: how to fill it in ──
    const help = wb.addWorksheet("How to fill")
    help.columns = [
      { header: "Column", key: "c", width: 16 },
      { header: "Required?", key: "r", width: 12 },
      { header: "What to put", key: "w", width: 78 },
    ]
    const hh = help.getRow(1)
    hh.font = { bold: true, color: { argb: "FFFFFFFF" } }
    hh.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } }
    })
    const rows: [string, string, string][] = [
      ["Date", "Recommended", "The publish date, e.g. 2026-08-10. Leave blank for undated ideas."],
      [
        "Platform",
        "Optional",
        `One of: ${PLATFORMS.split(",").join(", ")}. (Pick from the dropdown.)`,
      ],
      ["Theme", "Optional", "The occasion or topic, e.g. Independence Day, Founder story."],
      ["Format", "Optional", `One of: ${FORMATS.split(",").join(", ")}. (Pick from the dropdown.)`],
      ["Hook", "Optional", "The scroll-stopping opening line / headline."],
      ["Content", "Optional", "The full caption, slide-by-slide copy, or script."],
      ["Status", "Optional", `One of: ${STATUSES.split(",").join(", ")}. Defaults to PLANNED.`],
      ["Link", "Optional", "Link to the published post or the asset."],
    ]
    for (const [c, r, w] of rows) {
      const row = help.addRow({ c, r, w })
      row.alignment = { vertical: "top", wrapText: true }
    }
    help.addRow({})
    help.addRow({
      c: "NOTE",
      r: "",
      w: "A row is imported only if it has at least a Theme, Format, Hook or Content - empty days are skipped. Delete the grey example rows before importing. You can add more sheets (e.g. one per month or platform); every sheet with a Date header is read, and the platform is taken from the Platform column (or guessed from the sheet name).",
    }).alignment = { vertical: "top", wrapText: true }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="content-calendar-template.xlsx"',
        "Cache-Control": "no-store",
      },
    })
  },
)
