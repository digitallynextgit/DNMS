import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { createWorkbook, listWorkbookIndex } from "@/features/projects/server/sheets.service"

/**
 * GET - every calendar on the project: name, month, manager, tab names.
 *
 * The PICKER's read. No columns and no rows, deliberately: a calendar now has
 * one edition per month, so this list grows by twelve a year per calendar, and
 * sending each one's whole grid just to draw a dropdown would make opening the
 * Calendars tab cost more every month the project runs. The open edition is
 * fetched on its own from GET /workbooks/[workbookId].
 */
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) =>
    NextResponse.json({ data: await listWorkbookIndex(ctx.params.id!) }),
)

/**
 * POST - create a calendar, or another MONTH of one that exists.
 *   body {
 *     name, firstTab?,
 *     periodMonth?: "2026-09" | null,
 *     copyFrom?: { workbookId, structure?: boolean, teamPlan?: boolean }
 *   }
 *
 * Anyone on the project, same as creating a tab: starting a calendar is how
 * work begins, not a privilege. `copyFrom` is what makes a new month cheap -
 * it carries the tabs, their columns and the team plan forward, and never the
 * rows. See createWorkbook for what is deliberately NOT copied and why.
 */
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      firstTab?: string
      periodMonth?: string | null
      copyFrom?: { workbookId?: string; structure?: boolean; teamPlan?: boolean } | null
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "A sheet needs a name" }, { status: 422 })
    }
    if (body.copyFrom && !body.copyFrom.workbookId) {
      return NextResponse.json({ error: "Say which calendar to copy from" }, { status: 422 })
    }
    try {
      const workbook = await createWorkbook(ctx.params.id!, session.user.id, {
        name: body.name,
        firstTab: body.firstTab ?? null,
        periodMonth: body.periodMonth ?? null,
        copyFrom: body.copyFrom?.workbookId
          ? {
              workbookId: body.copyFrom.workbookId,
              structure: body.copyFrom.structure,
              teamPlan: body.copyFrom.teamPlan,
            }
          : null,
      })
      return NextResponse.json({ data: workbook }, { status: 201 })
    } catch (e) {
      const msg =
        e instanceof Error && e.message.includes("Unique")
          ? "That calendar already has an edition for that month"
          : e instanceof Error
            ? e.message
            : "Could not create the sheet"
      return NextResponse.json({ error: msg }, { status: 422 })
    }
  },
)
