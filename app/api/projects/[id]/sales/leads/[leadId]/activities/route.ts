import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { addActivity, listActivities } from "@/features/sales/server/sales.service"
import { salesFailure } from "@/features/sales/server/route-helpers"
import { leadActivitySchema } from "@/features/sales/schemas/sales.schema"

// A lead's history: calls, WhatsApps, visits, notes and stage changes, newest first.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    try {
      return NextResponse.json({ data: await listActivities(ctx.params.id!, ctx.params.leadId!) })
    } catch (e) {
      return salesFailure(e, "ACTIVITY_GET")
    }
  },
)

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const input = leadActivitySchema.parse(await req.json().catch(() => ({})))
      return NextResponse.json(
        { data: await addActivity(session, ctx.params.id!, ctx.params.leadId!, input) },
        { status: 201 },
      )
    } catch (e) {
      return salesFailure(e, "ACTIVITY_POST")
    }
  },
)
