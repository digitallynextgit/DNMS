import { NextRequest, NextResponse } from "next/server"

import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  listWorkbookTeams,
  workbookBelongsToProject,
} from "@/features/projects/server/sheets.service"

// Readable by anyone on the project. Also served inside GET /workbooks/[workbookId]; this is for refetching.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id: projectId, workbookId } = ctx.params
    if (!(await workbookBelongsToProject(workbookId!, projectId!))) {
      return NextResponse.json({ error: "Calendar not found" }, { status: 404 })
    }
    return NextResponse.json({ data: await listWorkbookTeams(workbookId!) })
  },
)
