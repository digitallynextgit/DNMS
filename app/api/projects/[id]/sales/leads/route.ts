import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { createLead, listLeads, salesAccess } from "@/features/sales/server/sales.service"
import { salesFailure } from "@/features/sales/server/route-helpers"
import { createLeadSchema } from "@/features/sales/schemas/sales.schema"

// The Sales tab's leads. `canManage` tells the page whether to offer add, import and assign.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    const access = await salesAccess(session, projectId)
    return NextResponse.json({
      data: await listLeads(projectId),
      canManage: access.canManage,
    })
  },
)

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    if (!(await salesAccess(session, projectId)).canManage) {
      return NextResponse.json({ error: "Only the sales managers can add leads" }, { status: 403 })
    }
    try {
      const input = createLeadSchema.parse(await req.json().catch(() => ({})))
      return NextResponse.json(
        { data: await createLead(projectId, session.user.id, input) },
        { status: 201 },
      )
    } catch (e) {
      return salesFailure(e, "LEAD_POST")
    }
  },
)
