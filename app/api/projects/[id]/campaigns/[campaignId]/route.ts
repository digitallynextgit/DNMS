import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { ZodError } from "zod"

import {
  canManageProject,
  withProjectAccess,
  withProjectManager,
} from "@/features/projects/server/project-access"
import {
  deleteCampaign,
  getCampaign,
  updateCampaign,
} from "@/features/projects/server/campaigns.service"
import { updateCampaignSchema } from "@/features/projects/schemas/campaign.schema"
import { AppError } from "@/lib/errors"

function failure(e: unknown, what: string) {
  if (e instanceof ZodError) {
    return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 422 })
  }
  if (e instanceof AppError)
    return NextResponse.json({ error: e.message }, { status: e.statusCode })
  console.error(`[CAMPAIGN_${what}]`, e)
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
}

// The project's managers, or the campaign's own owner.
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    const campaign = await getCampaign(projectId, ctx.params.campaignId!)
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    const allowed =
      campaign.ownerId === session.user.id || (await canManageProject(session, projectId))
    if (!allowed) {
      return NextResponse.json(
        { error: "Only the campaign owner or an Account Manager can change this" },
        { status: 403 },
      )
    }
    try {
      const input = updateCampaignSchema.parse(await req.json().catch(() => ({})))
      return NextResponse.json({ data: await updateCampaign(projectId, campaign.id, input) })
    } catch (e) {
      return failure(e, "PATCH")
    }
  },
)

// Deletes its calendar too.
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    try {
      await deleteCampaign(ctx.params.id!, ctx.params.campaignId!)
      return NextResponse.json({ success: true })
    } catch (e) {
      return failure(e, "DELETE")
    }
  },
)
