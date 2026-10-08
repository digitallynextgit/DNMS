import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  deleteWorkbook,
  getWorkbook,
  renameWorkbook,
  setWorkbookMonth,
  workbookBelongsToProject,
} from "@/features/projects/server/sheets.service"

// The only heavy read: one calendar in full. GET /workbooks lists editions without grids.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const workbook = await getWorkbook(ctx.params.id!, ctx.params.workbookId!)
    if (!workbook) return NextResponse.json({ error: "Calendar not found" }, { status: 404 })
    return NextResponse.json({ data: workbook })
  },
)

// Renaming renames every month of the calendar (see renameWorkbook).
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id: projectId, workbookId } = ctx.params
    if (!(await workbookBelongsToProject(workbookId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      periodMonth?: string | null
    }
    const wantsName = body.name !== undefined
    const wantsMonth = body.periodMonth !== undefined
    if (!wantsName && !wantsMonth) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 422 })
    }
    if (wantsName && !body.name?.trim()) {
      return NextResponse.json({ error: "A sheet needs a name" }, { status: 422 })
    }

    try {
      // The month goes last so a failed rename doesn't leave the month moved.
      let data = wantsName ? await renameWorkbook(workbookId!, body.name!) : null
      if (wantsMonth) data = await setWorkbookMonth(workbookId!, body.periodMonth ?? null)
      return NextResponse.json({ data })
    } catch (e) {
      const msg =
        e instanceof Error && e.message.includes("Unique")
          ? "A calendar with that name already exists for that month"
          : e instanceof Error
            ? e.message
            : "Could not update the calendar"
      return NextResponse.json({ error: msg }, { status: 422 })
    }
  },
)

// Manager only. Deletes ONE month (with its tabs, columns, rows and history), never the whole series.
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
