import { NextRequest, NextResponse } from "next/server"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { exportWorkbook } from "@/features/projects/server/sheet-export.service"

// GET ?format=xlsx|csv &sheetId= - the calendar as a file, the same as its Download menu: one tab
// (CSV or Excel) with sheetId, or every tab of the month in one Excel file without it.
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }) => {
    const q = req.nextUrl.searchParams
    const format = q.get("format") || "xlsx"
    if (format !== "xlsx" && format !== "csv") {
      return NextResponse.json({ error: "format must be xlsx or csv" }, { status: 422 })
    }
    const out = await exportWorkbook(
      ctx.params.id!,
      ctx.params.workbookId!,
      format,
      q.get("sheetId") || undefined,
    )
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status })

    const asciiName = out.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'")
    return new NextResponse(out.body as BodyInit, {
      headers: {
        "Content-Type": out.contentType,
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(out.fileName)}`,
        "Cache-Control": "no-store",
      },
    })
  },
)
