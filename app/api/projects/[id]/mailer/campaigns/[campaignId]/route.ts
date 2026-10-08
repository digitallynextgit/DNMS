import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import {
  getCampaignSends,
  cancelCampaign,
  deleteCampaign,
} from "@/features/project-mailer/server/project-mailer.service"

// DELETE cancels (keeps the log of what went out); ?purge=1 removes the campaign and its log.
// Explicit, never inferred from status, so stopping a send can't erase its record.
export const GET = withMailerAccess(async (_req, { params }) =>
  respond(await getCampaignSends(params.id, params.campaignId)),
)

export const DELETE = withMailerAccess(async (req: NextRequest, { params }, session) =>
  req.nextUrl.searchParams.get("purge") === "1"
    ? respond(await deleteCampaign(params.id, params.campaignId, session))
    : respond(await cancelCampaign(params.id, params.campaignId, session)),
)
