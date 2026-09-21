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

/**
 * GET - ONE calendar in full: its tabs, their columns and rows, and the team
 * plan.
 *
 * The heavy read, and the only one. GET /workbooks lists every edition of every
 * calendar without any of that, because monthly editions mean that list grows
 * by twelve a year per calendar and the picker only needs their names.
 */
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const workbook = await getWorkbook(ctx.params.id!, ctx.params.workbookId!)
    if (!workbook) return NextResponse.json({ error: "Calendar not found" }, { status: 404 })
    return NextResponse.json({ data: workbook })
  },
)

/**
 * PATCH - rename a calendar, or set the month this edition covers. Anyone on
 * the project.
 *   body { name?: string, periodMonth?: "2026-09" | null }
 *
 * RENAMING RENAMES EVERY MONTH of the calendar - see renameWorkbook. Setting
 * the month is how a legacy calendar called "…(H2S-Sept)" gets a real month,
 * by the person who knows which one it was.
 */
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
      // Both in one request is allowed; the month goes last so a failed rename
      // does not leave the month moved.
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

/**
 * DELETE - manager only. Takes every tab with it (columns, rows, history),
 * which is why it sits on the same side as deleting a tab.
 *
 * Deletes ONE MONTH, not the series. A month is a thing somebody made and can
 * decide was a mistake; "delete every edition of this calendar" is not an
 * action anybody has asked for and would be far too easy to do by accident.
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
