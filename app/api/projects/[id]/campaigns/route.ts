import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { ZodError } from "zod"

import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import { createCampaign, listCampaigns } from "@/features/projects/server/campaigns.service"
import { createCampaignSchema } from "@/features/projects/schemas/campaign.schema"
import { AppError } from "@/lib/errors"

// Planner campaigns: work across services with a start date and a deadline, each in its own calendar.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    return NextResponse.json({ data: await listCampaigns(ctx.params.id!) })
  },
)

export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const input = createCampaignSchema.parse(await req.json().catch(() => ({})))
      const data = await createCampaign(ctx.params.id!, session.user.id, input)
      return NextResponse.json({ data }, { status: 201 })
    } catch (e) {
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: e.issues[0]?.message ?? "Invalid input" },
          { status: 422 },
        )
      }
      if (e instanceof AppError) {
        return NextResponse.json({ error: e.message }, { status: e.statusCode })
      }
      console.error("[CAMPAIGNS_POST]", e)
      return NextResponse.json({ error: "Could not create the campaign" }, { status: 500 })
    }
  },
)
