import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { sheetBelongsToProject, writeCellsAt } from "@/features/projects/server/sheets.service"
import type { Session } from "next-auth"

// Addressed by row position: the grid draws a thousand rows and only typed-in ones exist (no id yet).
// Merged, so two people editing different columns of one row don't overwrite each other.
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      position?: number
      cells?: Record<string, unknown>
    }
    if (
      typeof body.position !== "number" ||
      body.position < 0 ||
      !Number.isInteger(body.position)
    ) {
      return NextResponse.json({ error: "A row position is required" }, { status: 422 })
    }
    if (!body.cells || typeof body.cells !== "object") {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }
    await writeCellsAt(sheetId!, body.position, session.user.id, body.cells)
    return NextResponse.json({ success: true })
  },
)
