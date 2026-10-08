import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  deleteColumn,
  sheetBelongsToProject,
  updateColumn,
} from "@/features/projects/server/sheets.service"
import { SHEET_COLUMN_TYPES, type SheetColumnType } from "@/features/projects/lib/sheet-types"
import { AppError } from "@/lib/errors"
import type { Session } from "next-auth"

export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId, columnId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      type?: string
      options?: string[]
      width?: number | null
    }
    if (body.type && !SHEET_COLUMN_TYPES.includes(body.type as SheetColumnType)) {
      return NextResponse.json({ error: `Unknown column type "${body.type}"` }, { status: 422 })
    }
    try {
      const column = await updateColumn(sheetId!, columnId!, session.user.id, {
        name: body.name,
        type: body.type as SheetColumnType | undefined,
        options: body.options,
        width: body.width,
      })
      return NextResponse.json({ data: column })
    } catch (e) {
      // A NotFoundError (column not on this sheet) must stay a 404, not a 422.
      if (e instanceof AppError) throw e
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not update the column" },
        { status: 422 },
      )
    }
  },
)

// Manager only: discards this column in every row (the values are copied to history first).
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId, columnId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    await deleteColumn(sheetId!, columnId!, session.user.id)
    return NextResponse.json({ success: true })
  },
)
