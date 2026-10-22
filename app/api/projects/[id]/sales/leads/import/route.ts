import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { importLeads, salesAccess } from "@/features/sales/server/sales.service"
import { salesFailure } from "@/features/sales/server/route-helpers"
import { importLeadsSchema } from "@/features/sales/schemas/sales.schema"

// Rows mapped from a spreadsheet in the browser; duplicates (same phone, or business + area) skipped.
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    if (!(await salesAccess(session, projectId)).canManage) {
      return NextResponse.json(
        { error: "Only the sales managers can import leads" },
        { status: 403 },
      )
    }
    try {
      const input = importLeadsSchema.parse(await req.json().catch(() => ({})))
      return NextResponse.json({ data: await importLeads(projectId, session.user.id, input) })
    } catch (e) {
      return salesFailure(e, "IMPORT")
    }
  },
)
