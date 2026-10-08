import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { createWorkbook, listWorkbookIndex } from "@/features/projects/server/sheets.service"

// The picker's read: no columns or rows, since monthly editions grow this list by twelve a year.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) =>
    NextResponse.json({ data: await listWorkbookIndex(ctx.params.id!) }),
)

// Anyone on the project. `copyFrom` carries tabs, columns and the team plan forward, never rows
// (see createWorkbook).
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
