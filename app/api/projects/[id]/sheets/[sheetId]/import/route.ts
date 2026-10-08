import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { importRows, sheetBelongsToProject } from "@/features/projects/server/sheets.service"

const MAX_ROWS = 2000

// The browser parses the CSV/XLSX/Google Sheet, maps the columns and sends rows here in batches.
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as { rows?: unknown }
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 422 })
    }
    if (body.rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Import at most ${MAX_ROWS} rows at a time` },
        { status: 422 },
      )
    }
    const rows = body.rows.filter(
      (r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r),
    )
    const data = await importRows(sheetId!, session.user.id, rows)
    return NextResponse.json({ data })
  },
)
