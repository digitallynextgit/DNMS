import { NextRequest, NextResponse } from "next/server"

import { withProjectManager } from "@/features/projects/server/project-access"
import {
  setWorkbookClientVisible,
  workbookBelongsToProject,
} from "@/features/projects/server/sheets.service"

// Manager only: this decides whether an outside party can read and write the sheet.
export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id: projectId, workbookId } = ctx.params
    if (!(await workbookBelongsToProject(workbookId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as { isClientVisible?: unknown }
    if (typeof body.isClientVisible !== "boolean") {
      return NextResponse.json({ error: "Say whether to share it" }, { status: 422 })
    }
    await setWorkbookClientVisible(workbookId!, body.isClientVisible)
    return NextResponse.json({ success: true })
  },
)
