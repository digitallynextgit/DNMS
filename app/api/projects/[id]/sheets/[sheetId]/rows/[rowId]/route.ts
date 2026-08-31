import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  deleteRow,
  sheetBelongsToProject,
  updateCells,
} from "@/features/projects/server/sheets.service"
import type { Session } from "next-auth"

/**
 * PATCH - write cells. Anyone on the project.
 *
 * The body is { cells: { <columnId>: value } } and is MERGED, so two people
 * editing different columns of the same row do not overwrite each other.
 */
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId, rowId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as { cells?: Record<string, unknown> }
    if (!body.cells || typeof body.cells !== "object") {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }
    await updateCells(rowId!, session.user.id, body.cells)
    return NextResponse.json({ success: true })
  },
)

/** DELETE - manager only. The row's values are kept in the history. */
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId, rowId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    await deleteRow(rowId!, session.user.id)
    return NextResponse.json({ success: true })
  },
)
