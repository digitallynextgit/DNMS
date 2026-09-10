import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { createWorkbook } from "@/features/projects/server/sheets.service"

/**
 * POST - create a workbook (what the Calendars UI calls a "sheet"). It opens
 * with one tab. Anyone on the project, same as creating a tab: starting a
 * sheet is how work begins, not a privilege.
 *   body { name, firstTab? }
 */
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const body = (await req.json().catch(() => ({}))) as { name?: string; firstTab?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "A sheet needs a name" }, { status: 422 })
    }
    try {
      const workbook = await createWorkbook(ctx.params.id!, session.user.id, {
        name: body.name,
        firstTab: body.firstTab ?? null,
      })
      return NextResponse.json({ data: workbook }, { status: 201 })
    } catch (e) {
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
