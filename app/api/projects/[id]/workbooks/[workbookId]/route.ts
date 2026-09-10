import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  deleteWorkbook,
  renameWorkbook,
  workbookBelongsToProject,
} from "@/features/projects/server/sheets.service"

/** PATCH - rename a workbook ("sheet" in the UI). Anyone on the project. */
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id: projectId, workbookId } = ctx.params
    if (!(await workbookBelongsToProject(workbookId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as { name?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "A sheet needs a name" }, { status: 422 })
    }
    try {
      return NextResponse.json({ data: await renameWorkbook(workbookId!, body.name) })
    } catch (e) {
      const msg =
        e instanceof Error && e.message.includes("Unique")
          ? "A sheet with that name already exists on this project"
          : e instanceof Error
            ? e.message
            : "Could not rename the sheet"
      return NextResponse.json({ error: msg }, { status: 422 })
    }
  },
)

/**
 * DELETE - manager only. Takes every tab with it (columns, rows, history),
 * which is why it sits on the same side as deleting a tab.
 */
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id: projectId, workbookId } = ctx.params
    if (!(await workbookBelongsToProject(workbookId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    await deleteWorkbook(workbookId!)
    return NextResponse.json({ success: true })
  },
)
