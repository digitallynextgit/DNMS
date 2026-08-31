import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { resize, sheetBelongsToProject } from "@/features/projects/server/sheets.service"

/**
 * PATCH - a column width or a row height.
 *
 * Separate from the content endpoints because resizing is not an edit: it
 * writes no history, and it is the one write that fires repeatedly while a
 * pointer is moving. Keeping it apart is what stops a drag from burying the
 * history under fifty entries.
 */
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id: projectId, sheetId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      rowHeight?: { position: number; height: number }
      columnWidth?: { columnId: string; width: number }
    }
    const okRow =
      body.rowHeight &&
      Number.isInteger(body.rowHeight.position) &&
      body.rowHeight.position >= 0 &&
      Number.isFinite(body.rowHeight.height)
    const okCol =
      body.columnWidth && body.columnWidth.columnId && Number.isFinite(body.columnWidth.width)
    if (!okRow && !okCol) {
      return NextResponse.json({ error: "Nothing to resize" }, { status: 422 })
    }
    await resize(sheetId!, {
      rowHeight: okRow ? body.rowHeight : undefined,
      columnWidth: okCol ? body.columnWidth : undefined,
    })
    return NextResponse.json({ success: true })
  },
)
