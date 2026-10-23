import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  applyTemplateToSheet,
  sheetBelongsToProject,
} from "@/features/projects/server/sheets.service"
import type { Session } from "next-auth"

// Gives an older tab the service calendar's fixed columns. Additive (nothing with a value is
// removed), so anyone on the project may run it. A calendar with no service names one in the
// body (`service`), and its whole series becomes that service's.
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId } = ctx.params
    if (!(await sheetBelongsToProject(sheetId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as { service?: unknown }
    const service = typeof body.service === "string" ? body.service : null
    try {
      return NextResponse.json({
        data: await applyTemplateToSheet(sheetId!, session.user.id, service),
      })
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not apply the template" },
        { status: 422 },
      )
    }
  },
)
