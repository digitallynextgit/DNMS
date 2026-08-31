import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { addColumn, sheetBelongsToProject } from "@/features/projects/server/sheets.service"
import { SHEET_COLUMN_TYPES, type SheetColumnType } from "@/features/projects/lib/sheet-types"
import type { Session } from "next-auth"

/** POST - add a column. Anyone on the project; the sheet is theirs to shape. */
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      type?: string
      options?: string[]
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "A column needs a name" }, { status: 422 })
    }
    const type = (body.type ?? "TEXT") as SheetColumnType
    if (!SHEET_COLUMN_TYPES.includes(type)) {
      return NextResponse.json({ error: `Unknown column type "${body.type}"` }, { status: 422 })
    }
    const column = await addColumn(sheetId!, session.user.id, {
      name: body.name,
      type,
      options: Array.isArray(body.options) ? body.options.filter((o) => typeof o === "string") : [],
    })
    return NextResponse.json({ data: column }, { status: 201 })
  },
)
