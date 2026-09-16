import { NextRequest, NextResponse } from "next/server"

import { withProjectManager } from "@/features/projects/server/project-access"
import {
  setWorkbookClientVisible,
  workbookBelongsToProject,
} from "@/features/projects/server/sheets.service"

/**
 * PATCH - publish this calendar to the client portal, or withdraw it.
 *
 * MANAGER ONLY, unlike renaming a workbook beside it, which anyone on the
 * project may do. The difference is who is affected: renaming is internal
 * housekeeping, and this decides whether an OUTSIDE party can read and write a
 * sheet. That is the same line the resource-sharing and module-granting
 * decisions sit on.
 */
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
