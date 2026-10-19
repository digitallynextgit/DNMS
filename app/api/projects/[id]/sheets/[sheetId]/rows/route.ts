import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  MAX_ROWS_PER_DELETE,
  addRow,
  deleteRowsAt,
  sheetBelongsToProject,
} from "@/features/projects/server/sheets.service"
import type { Session } from "next-auth"

export const POST = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    await addRow(sheetId!, session.user.id)
    return NextResponse.json({ success: true }, { status: 201 })
  },
)

// Several rows by position (empty ones too); the rows below move up. Values are kept in the history.
export const DELETE = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as { positions?: unknown }
    const positions = Array.isArray(body.positions)
      ? body.positions.filter((p): p is number => Number.isInteger(p) && (p as number) >= 0)
      : []
    if (positions.length === 0) {
      return NextResponse.json({ error: "No rows to delete" }, { status: 400 })
    }
    if (positions.length > MAX_ROWS_PER_DELETE) {
      return NextResponse.json(
        { error: `At most ${MAX_ROWS_PER_DELETE} rows at once` },
        { status: 422 },
      )
    }
    const result = await deleteRowsAt(sheetId!, positions, session.user.id)
    return NextResponse.json({ data: result })
  },
)
