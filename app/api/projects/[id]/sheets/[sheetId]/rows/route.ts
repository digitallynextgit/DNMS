import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { addRow, sheetBelongsToProject } from "@/features/projects/server/sheets.service"
import type { Session } from "next-auth"

/** POST - append a row. Anyone on the project. */
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
