import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { getSheetHistory, sheetBelongsToProject } from "@/features/projects/server/sheets.service"

/** Everyone who can see the sheet can see who changed it. That is the deal. */
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id: projectId, sheetId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    return NextResponse.json({ data: await getSheetHistory(sheetId!) })
  },
)
