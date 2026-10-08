import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { createSheet, listWorkbookIndex } from "@/features/projects/server/sheets.service"
import type { Session } from "next-auth"

// GET returns tab names only (a calendar has one edition per month); grids come from /workbooks/[workbookId].
// Any project member may create tabs; only DELETE (on [sheetId]) is restricted.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) =>
    NextResponse.json({ data: await listWorkbookIndex(ctx.params.id!) }),
)

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const body = (await req.json().catch(() => ({}))) as {
      workbookId?: string
      name?: string
      description?: string
    }
    if (!body.workbookId) {
      return NextResponse.json({ error: "A tab needs a sheet to live in" }, { status: 422 })
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "A tab needs a name" }, { status: 422 })
    }
    try {
      const sheet = await createSheet(ctx.params.id!, session.user.id, {
        workbookId: body.workbookId,
        name: body.name,
        description: body.description ?? null,
      })
      return NextResponse.json({ data: sheet }, { status: 201 })
    } catch (e) {
      // The (workbook, name) unique index is what produces this in practice.
      const msg =
        e instanceof Error && e.message.includes("Unique")
          ? "A tab with that name already exists in this sheet"
          : e instanceof Error
            ? e.message
            : "Could not create the tab"
      return NextResponse.json({ error: msg }, { status: 422 })
    }
  },
)
