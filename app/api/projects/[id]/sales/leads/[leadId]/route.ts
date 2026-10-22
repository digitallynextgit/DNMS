import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { deleteLead, updateLead } from "@/features/sales/server/sales.service"
import { salesFailure } from "@/features/sales/server/route-helpers"
import { updateLeadSchema } from "@/features/sales/schemas/sales.schema"

// Its assignee or the sales managers edit; only managers reassign or delete (checked in the service).
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const input = updateLeadSchema.parse(await req.json().catch(() => ({})))
      return NextResponse.json({
        data: await updateLead(session, ctx.params.id!, ctx.params.leadId!, input),
      })
    } catch (e) {
      return salesFailure(e, "LEAD_PATCH")
    }
  },
)

export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      await deleteLead(session, ctx.params.id!, ctx.params.leadId!)
      return NextResponse.json({ success: true })
    } catch (e) {
      return salesFailure(e, "LEAD_DELETE")
    }
  },
)
