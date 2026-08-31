import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { createSheet, listSheets } from "@/features/projects/server/sheets.service"
import type { Session } from "next-auth"

/**
 * GET  - every sheet on the project, with its columns and rows.
 * POST - create one.
 *
 * Both are behind withProjectAccess, not withProjectManager, and that is the
 * feature: anyone working on the project can start a sheet and fill it in.
 * Only DELETE is restricted, and it lives on the [sheetId] routes.
 */
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) =>
    NextResponse.json({ data: await listSheets(ctx.params.id!) }),
)

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const body = (await req.json().catch(() => ({}))) as { name?: string; description?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "A sheet needs a name" }, { status: 422 })
    }
    try {
      const sheet = await createSheet(ctx.params.id!, session.user.id, {
        name: body.name,
        description: body.description ?? null,
      })
      return NextResponse.json({ data: sheet }, { status: 201 })
    } catch (e) {
      // The (project, name) unique index is what produces this in practice.
      const msg =
        e instanceof Error && e.message.includes("Unique")
          ? "A sheet with that name already exists on this project"
          : e instanceof Error
            ? e.message
            : "Could not create the sheet"
      return NextResponse.json({ error: msg }, { status: 422 })
    }
  },
)
