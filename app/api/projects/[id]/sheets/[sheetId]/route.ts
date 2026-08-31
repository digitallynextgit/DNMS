import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  deleteSheet,
  renameSheet,
  sheetBelongsToProject,
} from "@/features/projects/server/sheets.service"
import type { Session } from "next-auth"

/** PATCH - rename or re-describe. Anyone on the project. */
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      description?: string | null
    }
    try {
      return NextResponse.json({ data: await renameSheet(sheetId!, session.user.id, body) })
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not update the sheet" },
        { status: 422 },
      )
    }
  },
)

/**
 * DELETE - manager only.
 *
 * Takes the columns, the rows and the sheet's own history with it. That is why
 * it is the one verb on this feature that a plain project member cannot reach.
 */
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id: projectId, sheetId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    await deleteSheet(sheetId!)
    return NextResponse.json({ success: true })
  },
)
